import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SYSTEM_PROMPT = `You are a logistics assistant for Ets. BINA'A, a construction materials company in Mauritania. Analyze ALL the delivery order texts (separated by ---) and extract TOTAL combined quantities. Return ONLY a valid JSON object with exactly these keys:
{
  "ciment_tonnes": number,
  "barigs": number,
  "fer_tonnes": number,
  "plater_tonnes": number,
  "plater_units": number,
  "tachinti_units": number,
  "flycont_units": number,
  "coulcro_tonnes": number,
  "coulcro_units": number,
  "vilas_units": number
}

Rules for each key:

CEMENT (ciment_tonnes):
- Total cement in TONNES. Words: طن/tonne/tn + سيمان/ciment/سمنت/اسمنت + grade 42/32/42.5/32.5/52.5
- SHORTHAND: "2 طن42" or "2 tn42" or "2 طن 42" = 2 tonnes cement even without سيمان word
- 1 sac/كيس/خنشة = 0.05 tonne

IRON BARIQUES (barigs):
- Count: باريك/بريك/barig units of iron
- SHORTHAND: "2 فير 12" or "2 fer 12" = 2 barigs (fer/فير followed by size number = barig)
- "3 بريكة 12 صيني 1 بريكة 14" = 4 barigs total
- IGNORE these words after numbers (iron descriptors, NOT separate quantities): تركي, ابوينت, فيل دتاش, صيني, تام, 3مم, دتاش, بونت, chinois, pointe, vildatach, ج (suffix like 14ج means grade 14)

IRON TONNES (fer_tonnes):
- ONLY when explicitly "طن حديد" or "tonne fer" or "طن فير 12" (طن BEFORE فير)
- "1 طن فير 12" = 1 tonne iron (fer_tonnes), NOT a barig

PLATER (plater_tonnes and plater_units):
- Words: بلاتر/ابلاتر/blater/plater
- With طن/tonne/tn before it = plater_tonnes
- Without طن = plater_units (sacs/pieces)
- "20 صاك ابلاتر" = 20 plater_units
- "2 طن بلاتر" = 2 plater_tonnes

TACHINTI (tachinti_units):
- Words: تانشتي/تانشيتي/تانشبتى/tachinti
- Always counted as units (pieces), never tonnes
- "8 تانشتي 3مم" = 8 tachinti_units (3مم is the size, ignore it)

FLYCONT (flycont_units):
- Words: فليكونت/flycont/flexcont
- Always units

COULCRO (coulcro_tonnes and coulcro_units):
- Words: كول كرو/كولكرو/coulcro/coolcro
- With طن = coulcro_tonnes, without = coulcro_units

VILAS (vilas_units):
- Words: فيلاص/فيلص/vilas/villas
- Always units

GENERAL:
- Sum quantities across ALL texts (separated by ---)
- Return 0 for any type not found
- Numbers may be Arabic-Indic or Latin digits
- Return ONLY the JSON object, no explanation, no markdown, no code fences`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

type WageQuantities = {
  ciment_tonnes: number;
  barigs: number;
  fer_tonnes: number;
  plater_tonnes: number;
  plater_units: number;
  tachinti_units: number;
  flycont_units: number;
  coulcro_tonnes: number;
  coulcro_units: number;
  vilas_units: number;
};

function normalizeDigits(input: string) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return input
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[,،]/g, ".")
    .toLowerCase();
}

function roundQ(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function parseLocalQuantities(details: string): WageQuantities {
  const text = normalizeDigits(details);
  const num = "(\\d+(?:\\.\\d+)?)";
  const ton = "(?:طن|tonnes?|tn)";
  const cement = "(?:سيمان|سمنت|اسمنت|ciment|cement)";
  const sac = "(?:sacs?|كيس|اكياس|أكياس|خنشة)";
  const iron = "(?:حديد)";
  const barigW = "(?:باريك(?:ات)?|بريك(?:ات)?|barigs?|bariques?|barriques?)";
  const cGrade = "(?:42(?:\\.5)?|32(?:\\.5)?|52\\.5)";
  const fer = "(?:فير|fer)";
  const plater = "(?:بلاتر|ابلاتر|blater|plater)";
  const tach = "(?:تانشتي|تانشيتي|تانشبتى|tachinti)";
  const fly = "(?:فليكونت|flycont|flexcont)";
  const coulcro = "(?:كول\\s*كرو|كولكرو|coulcro|coolcro)";
  const vilas = "(?:فيلاص|فيلص|vilas|villas)";

  let ciment_tonnes = 0, barigs = 0, fer_tonnes = 0;
  let plater_tonnes = 0, plater_units = 0;
  let tachinti_units = 0, flycont_units = 0;
  let coulcro_tonnes = 0, coulcro_units = 0;
  let vilas_units = 0;

  const add = (re: RegExp, fn: (v: number) => void) => {
    for (const m of text.matchAll(re)) {
      const v = Number(m[1] ?? m[2] ?? 0);
      if (Number.isFinite(v)) fn(v);
    }
  };

  add(new RegExp(`${num}\\s*${ton}[^\n\r-]{0,35}${cement}`, "giu"), v => ciment_tonnes += v);
  add(new RegExp(`${cement}[^\n\r-]{0,35}${num}\\s*${ton}`, "giu"), v => ciment_tonnes += v);
  add(new RegExp(`${num}\\s*${sac}[^\n\r-]{0,35}${cement}`, "giu"), v => ciment_tonnes += v * 0.05);
  add(new RegExp(`${cement}[^\n\r-]{0,35}${num}\\s*${sac}`, "giu"), v => ciment_tonnes += v * 0.05);
  add(new RegExp(`${num}\\s*${ton}\\s*${cGrade}\\b`, "giu"), v => ciment_tonnes += v);

  add(new RegExp(`${num}\\s*${barigW}(?:[^\n\r-]{0,35}${iron})?`, "giu"), v => barigs += v);
  add(new RegExp(`${iron}[^\n\r-]{0,35}${num}\\s*${barigW}`, "giu"), v => barigs += v);
  add(new RegExp(`(?<!${ton}\\s{0,5})${num}\\s*${fer}\\s*\\d+(?:\\.\\d+)?`, "giu"), v => barigs += v);

  add(new RegExp(`${num}\\s*${ton}[^\n\r-]{0,35}${iron}`, "giu"), v => fer_tonnes += v);
  add(new RegExp(`${iron}[^\n\r-]{0,35}${num}\\s*${ton}`, "giu"), v => fer_tonnes += v);
  add(new RegExp(`${num}\\s*${ton}\\s*${fer}\\s*\\d+(?:\\.\\d+)?`, "giu"), v => fer_tonnes += v);

  add(new RegExp(`${num}\\s*${ton}\\s*${plater}`, "giu"), v => plater_tonnes += v);
  add(new RegExp(`${num}\\s*(?:${sac}\\s*)?${plater}(?!\\s*${ton})`, "giu"), v => plater_units += v);

  add(new RegExp(`${num}\\s*${tach}`, "giu"), v => tachinti_units += v);
  add(new RegExp(`${num}\\s*${fly}`, "giu"), v => flycont_units += v);

  add(new RegExp(`${num}\\s*${ton}\\s*${coulcro}`, "giu"), v => coulcro_tonnes += v);
  add(new RegExp(`${num}\\s*${coulcro}(?!\\s*${ton})`, "giu"), v => coulcro_units += v);

  add(new RegExp(`${num}\\s*${vilas}`, "giu"), v => vilas_units += v);

  return {
    ciment_tonnes: roundQ(ciment_tonnes), barigs: roundQ(barigs), fer_tonnes: roundQ(fer_tonnes),
    plater_tonnes: roundQ(plater_tonnes), plater_units: roundQ(plater_units),
    tachinti_units: roundQ(tachinti_units), flycont_units: roundQ(flycont_units),
    coulcro_tonnes: roundQ(coulcro_tonnes), coulcro_units: roundQ(coulcro_units),
    vilas_units: roundQ(vilas_units),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { details } = await req.json().catch(() => ({ details: "" }));
    const userText = (details ?? "").toString().trim();
    const empty = { ciment_tonnes: 0, barigs: 0, fer_tonnes: 0, plater_tonnes: 0, plater_units: 0, tachinti_units: 0, flycont_units: 0, coulcro_tonnes: 0, coulcro_units: 0, vilas_units: 0 };
    if (!userText) return jsonResponse(empty);

    const localFallback = parseLocalQuantities(userText);
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonResponse({ ...localFallback, fallback: "local-parser" });

    const body = {
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    };

    const models = ["gemini-2.5-flash-lite", "gemini-2.0-flash"];
    let resp: Response | null = null, raw = "", lastErr = "", lastStatus = 0;

    outer: for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        raw = await resp.text();
        if (resp.ok) break outer;
        lastErr = raw; lastStatus = resp.status;
        if (resp.status !== 503 && resp.status !== 429 && resp.status !== 500) break;
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }

    if (!resp || !resp.ok) {
      let message = `Gemini API error ${lastStatus}`;
      try { const j = JSON.parse(lastErr); message = j?.error?.message ?? message; } catch { }
      return jsonResponse({ ...localFallback, fallback: "local-parser", warning: message });
    }

    let data: any = null;
    try { data = JSON.parse(raw); } catch { return jsonResponse({ ...localFallback, fallback: "local-parser" }); }

    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    if (!text?.trim()) return jsonResponse({ ...localFallback, fallback: "local-parser" });

    let parsed: any;
    try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return jsonResponse({ ...localFallback, fallback: "local-parser" }); }

    return jsonResponse({
      ciment_tonnes: Number(parsed.ciment_tonnes ?? 0),
      barigs: Number(parsed.barigs ?? 0),
      fer_tonnes: Number(parsed.fer_tonnes ?? 0),
      plater_tonnes: Number(parsed.plater_tonnes ?? 0),
      plater_units: Number(parsed.plater_units ?? 0),
      tachinti_units: Number(parsed.tachinti_units ?? 0),
      flycont_units: Number(parsed.flycont_units ?? 0),
      coulcro_tonnes: Number(parsed.coulcro_tonnes ?? 0),
      coulcro_units: Number(parsed.coulcro_units ?? 0),
      vilas_units: Number(parsed.vilas_units ?? 0),
    });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? "Unknown error" }, 500);
  }
});
