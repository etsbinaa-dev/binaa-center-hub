import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { imageBase64: string; mimeType?: string };
type Output = {
  customer_name: string | null;
  customer_phone: string | null;
  invoice_number: string | null;
  raw_text: string;
  error?: string;
};

const SYSTEM = `أنت تستخرج بيانات من صور فواتير عربية/إنجليزية.
أعد JSON فقط بالحقول التالية بدون أي شرح:
{
  "raw_text": "النص الكامل المستخرج من الصورة كما هو سطراً بسطر",
  "customer_name": "<اسم العميل>" | null,
  "customer_phone": "<رقم الواتساب للعميل>" | null,
  "invoice_number": "<رقم الفاتورة>" | null
}

قواعد صارمة وإلزامية لاستخراج بيانات العميل (تعلو على أي منطق آخر):
1. ابحث فقط عن السطر الذي يبدأ بكلمة "Client" (أو Client: أو العميل).
2. اسم العميل = النص الموجود مباشرة بعد كلمة Client وقبل أول رقم في نفس السطر.
3. رقم واتساب العميل = رقم موريتاني صالح مكوّن من 8 أرقام يبدأ بـ 2 أو 3 أو 4، موجود في نفس سطر Client فقط (مع تجاهل بادئة +222 أو 222 إن وُجدت).
4. ممنوع منعاً باتاً استخراج رقم العميل من: رقم الفاتورة، كود العميل، أسطر المواد، الكميات، الأسعار، الإجماليات، التاريخ، أو أي سطر آخر.
5. إذا لم يحتوِ سطر Client على رقم موريتاني صالح، اجعل customer_phone = null. لا تخمّن ولا تخترع رقماً أبداً.
6. إذا لم يوجد سطر يبدأ بـ Client، اجعل customer_name و customer_phone = null.
7. raw_text يجب أن يحتوي على النص الكامل المستخرج كما هو سطراً بسطر (إلزامي للتحقق).`;

// Mauritanian phone: 8 digits starting with 2, 3 or 4. Optional +222/222 prefix.
function extractMauritanianPhoneFromClientLine(rawText: string): string | null {
  if (!rawText) return null;
  const lines = rawText.split(/\r?\n/);
  const clientLine = lines.find((l) => /^\s*(client|العميل)\b/i.test(l));
  if (!clientLine) return null;
  // Strip the label so we don't accidentally match digits before "Client"
  const afterLabel = clientLine.replace(/^\s*(client\s*:?|العميل\s*:?)/i, " ");
  // Normalize: keep digits, +, and spaces/dashes as separators
  const digits = afterLabel.replace(/[^\d+]/g, " ");
  // Match: optional +222 / 222, then 8-digit number starting with 2/3/4
  const re = /(?:\+?222)?\s*([234]\d{7})(?!\d)/g;
  const m = re.exec(digits);
  if (!m) return null;
  return m[1];
}

export const extractInvoiceFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => d)
  .handler(async ({ data }): Promise<Output> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        customer_name: null,
        customer_phone: null,
        invoice_number: null,
        raw_text: "",
        error: "LOVABLE_API_KEY is not configured",
      };
    }
    const mime = data.mimeType || "image/jpeg";
    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${mime};base64,${data.imageBase64}`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "استخرج البيانات من هذه الفاتورة وأعد JSON فقط." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[extract-invoice] gateway error", res.status, text);
      return {
        customer_name: null,
        customer_phone: null,
        invoice_number: null,
        raw_text: "",
        error: `AI gateway error ${res.status}`,
      };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    let parsed: Partial<Output> = {};
    try {
      parsed = JSON.parse(typeof content === "string" ? content : "");
    } catch {
      const m = typeof content === "string" ? content.match(/\{[\s\S]*\}/) : null;
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          /* ignore */
        }
      }
    }

    const raw_text = parsed.raw_text?.toString() ?? "";

    // MANDATORY: phone must come from the "Client" line and be a valid Mauritanian number.
    // This deterministic post-processing overrides any phone the model produced.
    const phoneFromClientLine = extractMauritanianPhoneFromClientLine(raw_text);

    return {
      customer_name: parsed.customer_name?.toString().trim() || null,
      customer_phone: phoneFromClientLine,
      invoice_number: parsed.invoice_number?.toString().trim() || null,
      raw_text,
    };
  });
