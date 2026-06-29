import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SYSTEM_PROMPT = `You are an assistant for Ets. BINA'A, a construction materials company in Mauritania. Analyze the order text and extract information, returning ONLY a valid JSON object with exactly these 3 keys, nothing else:
{"libelle": "the chantier or location name found in the text, or empty string if none", "products": "the RIMSoft clipboard lines, one per product, format: CODE,DESIGNATION,0,QUANTITY,0", "phone": ""}

For products, use this product list to match by code:
P0001 CIMENT 42.5, P0002 CIMENT 32.5, P0003 CIMENT ANTISEL SR, P0003s CIMENT ANTISEL PM, P0004 PLATER MAMCO TAIBA, P0005 PLATER ATLANTIC, P0006 FILASSE, P0006s FILASSE PAR KG, P0007 FIL DE FER, P0008 POINTE, P0009 PLATER SAMIA, P052 PLATER SAMIA, P0010 ZAZOU L2 par kg, P0010s L4, P0010c ZAZOU par metre, P0011 FER 12 CHEMALI, P0012 FER 10 CHEMALI, P0013 FER 12 TURKEY, P0014 FER 10 TURKEY, P0015 FER 12 CHINE, P0016 FER 10 CHINE, P0017 FER 8, p01147 FER 8 Turkey, P0022 FER 14 CHEMALI, P0023 BAR 8, P0024 BRIQUE 15, P0024S BRIQUE 20 P, P0024SS BRIQUE 15P, P4141 BRIQUE 20 CRE, P0025 ORDI, P00301 BAR 10 TURKEY, P0027 BAR 14 CHEMALI, P0027S BAR 14 TURK, P0028 BAR 4.5, P0029 BAR 5.5, P0030 BAR 10 CHEMALI, p0032 CONTRE PLAC 8MM, P01a1 CONTRE PLAC 15, P0033 FER 12 ALGERIE, P0034 GRAVIER CRBLE PAR TONNE, P00341 GRAVIER CONCSER PAR TONNE, P0044 SABLE, P0045 COQUILLAGE, P0046 EAU, POO47 TUBE 9 INJELEC, P0048 TUBE 11 IJELEC, P0049 FER 4.2, P0050 FER 6 PLEIN, P05214 FER 5 PLEIN, P0051 FER 16, P0051s FER 16 ALG, P0512 FER 16 TURKEY, P0051B BAR 16, P0014Q FLICONT, P0014Q2 FLICONT 20 KG, P0020s FER 4.7, p0100 PLATR SOMIP, P0053 POINTE AC, P0055 ETANCHEITE TAPIS GUEDRON 3M, P0055S ETANCHEITE TAPIS GUEDRON 4MM, P0056 COLLE GUEDRON, P0057 FIL 1.5, P0058 FIL 2.5, P0060 SMCI 30KG, P0061 SMCI 25KG, P0062 SMCI 20KG, P0063 A L'HUIL SMCI 20KG, P0064 CARREAU, P0064S FER 20, P00152 BAR 20, P0065 CARREAU SOL, P055 CIMENT 52.5, P0066 COLORANT, p0125 CABLE 3X1.5, P00091 FER 14 ALGERIE, P00991t FER 14 TURKEY, P0014A FER 10 ALGERIE, P00992 FER 14 CHINE, P0339 CIMENT BLANC 25 KG, p00145 BAR 6 P, P001247 ENDUI, P001247s ENDUI GOLD, P02415 ENDUI SMCI, P0021s FER 4.5, P00524 BERWETT, P012S1 SURJOINT, P012S3 COFREE 24, P01C5 COFREE 12, p021145 CABLE 2X25, P0197 COLLE CARREAU MR, P0197S COLLE CARREAU TURQUE, P01121 COLLE GREFIER 30 KG ATLAS, p0124 PAPIER SABLE, P00143 BOITIER ROUGE, P00415 CABLE CUIVRE 4X16, P05241 PLANCHE MC, p01204 CHEVRON, P012004 DULIAN GM, P01210 DULIAN, P03214 PEL, PTRSP TRANSPORT, P0101 FER 12 MR, P02141 FER 10 MR, P10001 BACHE L'EAU 5 TN, P01354 BACHE 7/5, P013544 BACHE 6/5, P013544s BACHE 4/5, P01354sq BACHE 4/3, P02100 BACH 10TN, P101 SEAU MACON GM, P101S SEAU MACON M, P101SS SEAU MACON, P101SSS SEAU PLATER, p10241 SIKA 1KG, p10241s SIKA LIQUID 5L, P00991 TALOUCHE, 40026 BAR 12 CHEMALI, 40026S BAR 12 TURK, P0000 PRODUIT VIDE.

DEFAULT RULES when origin/brand not specified:
- FER 12 / حديد 12 without brand → P0011 FER 12 CHEMALI
- FER 10 / حديد 10 without brand → P0012 FER 10 CHEMALI
- FER 14 / حديد 14 without brand → P0022 FER 14 CHEMALI
- PLATER / جبس without brand → P0005 PLATER ATLANTIC
- CIMENT / سمنت without grade → P0001 CIMENT 42.5
- GRAVIER / حصى without type → P0034 GRAVIER CRBLE PAR TONNE

BRAND KEYWORDS:
- شمالي / chemali → CHEMALI
- تركي / turkey / turk → TURKEY
- صيني / chine → CHINE
- جزائري / algerie / alg → ALGERIE
- أطلنتيك / atlantic → ATLANTIC
- مامكو / mamco → MAMCO TAIBA
- سامية / samia → SAMIA

Unit conversions: 1 tonne = 10 bariques. 0.5 barique = half barique. sac stays as SAC. kg stays as KG.
Do NOT include chantier or location name in products lines.
Return ONLY the JSON object, no explanation, no markdown.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY is not configured" }, 500);
    }

    const { details } = await req.json().catch(() => ({ details: "" }));
    const userText = (details ?? "").toString().trim();
    if (!userText) {
      return jsonResponse({ error: "Empty order details" }, 400);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      console.error("[gemini-rimsoft] HTTP", resp.status, raw);
      let message = `Gemini API error ${resp.status}`;
      try {
        const j = JSON.parse(raw);
        message = j?.error?.message ?? message;
      } catch {
        /* ignore */
      }
      return jsonResponse({ error: message }, 502);
    }

    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return jsonResponse({ error: "Invalid JSON from Gemini" }, 502);
    }

    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    if (!text || !text.trim()) {
      const finish = data?.candidates?.[0]?.finishReason ?? "unknown";
      return jsonResponse({ error: `Empty response from Gemini (finishReason: ${finish})` }, 502);
    }

    // Fix line endings for RIMSoft (Windows expects \r\n)
    const fixedText = text.replace(/\\r\\n|\\r|\\n/g, "\r\n");
    return jsonResponse({ text: fixedText });
  } catch (e: any) {
    console.error("[gemini-rimsoft] error", e);
    return jsonResponse({ error: e?.message ?? "Unknown error" }, 500);
  }
});
