import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SYSTEM_PROMPT = `You are a logistics assistant for Ets. BINA'A, a construction materials company in Mauritania. Analyze ALL the delivery order texts (separated by ---) and extract TOTAL combined quantities, returning ONLY a valid JSON object with exactly these 3 keys:
{"ciment_tonnes": number, "barigs": number, "fer_tonnes": number}

Rules:
- ciment_tonnes: total cement in TONNES. Recognize: طن/tonne/tn + سيمان/ciment/سمنت + grade like 42/32/42.5/32.5/52.5. 1 sac = 0.05 tonne.
- SHORTHAND cement: "2 طن42" or "2 tn42" or "2 طن 42" or "2 tn 42" = cement even without سيمان/ciment word.
- barigs: total bariques of iron. "2 فير 12" or "2 fer 12" = 2 barigs. Count only when NOT preceded by طن/tn.
- IMPORTANT: "1 طن فير 12" or "1 tn fer 12" = 1 tonne of iron (fer_tonnes), NOT barigs.
- fer_tonnes: iron in TONNES. Explicit "طن حديد" or "tonne fer" or "طن فير 12" (with طن before فير).
- IGNORE: بلاتر/plater, تانشتي/tachinti, فليكونت/flycont, كول كرو/coulcro, فيلاص/vilas — these are handled separately.
- Sum all order texts (separated by ---). Return 0 if not mentioned.
- Numbers may be Arabic-Indic or Latin.
Return ONLY the JSON object, no explanation, no markdown, no code fences.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

type WageQuantities = { ciment_tonnes: number; barigs: number; fer_tonnes: number };

function normalizeDigits(input: string) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return input
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[,،]/g, ".")
    .toLowerCase();
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function parseLocalQuantities(details: string): WageQuantities {
  const text = normalizeDigits(details);
  const number = "(\\d+(?:\\.\\d+)?)";
  const tonUnit = "(?:طن|tonnes?|tn)";
  const cementWord = "(?:سيمان|سمنت|اسمنت|ciment|cement)";
  const sacUnit = "(?:sacs?|كيس|اكياس|أكياس)";
  const ironWord = "(?:حديد)";
  const barigUnit = "(?:باريك(?:ات)?|بريك(?:ات)?|barigs?|bariques?|barriques?)";
  const cementGrade = "(?:42(?:\\.5)?|32(?:\\.5)?|52\\.5)";
  const ferWord = "(?:فير|fer)";

  let ciment_tonnes = 0;
  let barigs = 0;
  let fer_tonnes = 0;

  const addMatches = (regex: RegExp, add: (value: number) => void) => {
    for (const match of text.matchAll(regex)) {
      const value = Number(match[1] ?? match[2] ?? 0);
      if (Number.isFinite(value)) add(value);
    }
  };

  addMatches(new RegExp(`${number}\\s*${tonUnit}[^\n\r-]{0,35}${cementWord}`, "giu"), (v) => (ciment_tonnes += v));
  addMatches(new RegExp(`${cementWord}[^\n\r-]{0,35}${number}\\s*${tonUnit}`, "giu"), (v) => (ciment_tonnes += v));
  addMatches(new RegExp(`${number}\\s*${sacUnit}[^\n\r-]{0,35}${cementWord}`, "giu"), (v) => (ciment_tonnes += v * 0.05));
  addMatches(new RegExp(`${cementWord}[^\n\r-]{0,35}${number}\\s*${sacUnit}`, "giu"), (v) => (ciment_tonnes += v * 0.05));
  addMatches(new RegExp(`${number}\\s*${tonUnit}\\s*${cementGrade}\\b`, "giu"), (v) => (ciment_tonnes += v));

  addMatches(new RegExp(`${number}\\s*${barigUnit}(?:[^\n\r-]{0,35}${ironWord})?`, "giu"), (v) => (barigs += v));
  addMatches(new RegExp(`${ironWord}[^\n\r-]{0,35}${number}\\s*${barigUnit}`, "giu"), (v) => (barigs += v));
  addMatches(new RegExp(`(?<!${tonUnit}\\s{0,5})${number}\\s*${ferWord}\\s*\\d+(?:\\.\\d+)?`, "giu"), (v) => (barigs += v));

  addMatches(new RegExp(`${number}\\s*${tonUnit}[^\n\r-]{0,35}${ironWord}`, "giu"), (v) => (fer_tonnes += v));
  addMatches(new RegExp(`${ironWord}[^\n\r-]{0,35}${number}\\s*${tonUnit}`, "giu"), (v) => (fer_tonnes += v));
  addMatches(new RegExp(`${number}\\s*${tonUnit}\\s*${ferWord}\\s*\\d+(?:\\.\\d+)?`, "giu"), (v) => (fer_tonnes += v));

  return {
    ciment_tonnes: roundQuantity(ciment_tonnes),
    barigs: roundQuantity(barigs),
    fer_tonnes: roundQuantity(fer_tonnes),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { details } = await req.json().catch(() => ({ details: "" }));
    const userText = (details ?? "").toString().trim();
    if (!userText) {
      return jsonResponse({ ciment_tonnes: 0, barigs: 0, fer_tonnes: 0 });
    }

    const localFallback = parseLocalQuantities(userText);
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonResponse({ ...localFallback, fallback: "local-parser", warning: "Gemini API key is not configured" });
    }

    const body = {
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    };

    const models = ["gemini-2.5-flash-lite", "gemini-2.0-flash"];
    let resp: Response | null = null;
    let raw = "";
    let lastErr = "";
    let lastStatus = 0;

    outer: for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        raw = await resp.text();
        if (resp.ok) break outer;
        lastErr = raw;
        lastStatus = resp.status;
        console.error(`[gemini-driver-wages] ${model} attempt ${attempt + 1} HTTP ${resp.status}`);
        if (resp.status !== 503 && resp.status !== 429 && resp.status !== 500) break;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }

    if (!resp || !resp.ok) {
      let message = `Gemini API error ${lastStatus}`;
      try { const j = JSON.parse(lastErr); message = j?.error?.message ?? message; } catch { }
      return jsonResponse({ ...localFallback, fallback: "local-parser", warning: message });
    }

    let data: any = null;
    try { data = JSON.parse(raw); } catch {
      return jsonResponse({ ...localFallback, fallback: "local-parser", warning: "Invalid JSON from Gemini" });
    }

    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    if (!text || !text.trim()) {
      const finish = data?.candidates?.[0]?.finishReason ?? "unknown";
      return jsonResponse({ ...localFallback, fallback: "local-parser", warning: `Empty response from Gemini (finishReason: ${finish})` });
    }

    const clean = text.replace(/```json|```/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(clean); } catch {
      return jsonResponse({ ...localFallback, fallback: "local-parser", warning: "Could not parse Gemini JSON output" });
    }

    return jsonResponse({
      ciment_tonnes: Number(parsed.ciment_tonnes ?? 0),
      barigs: Number(parsed.barigs ?? 0),
      fer_tonnes: Number(parsed.fer_tonnes ?? 0),
    });
  } catch (e: any) {
    console.error("[gemini-driver-wages] error", e);
    return jsonResponse({ error: e?.message ?? "Unknown error" }, 500);
  }
});
