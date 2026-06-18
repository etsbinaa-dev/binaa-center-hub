import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { imageBase64: string; mimeType?: string };
type Output = {
  customer_name: string | null;
  customer_phone: string | null;
  invoice_number: string | null;
  amount: number | null;
  raw_text: string;
  error?: string;
};


const SYSTEM = `أنت تستخرج بيانات من صور فواتير عربية/إنجليزية.
أعد JSON فقط بالحقول التالية بدون أي شرح:
{
  "raw_text": "النص الكامل المستخرج من الصورة كما هو سطراً بسطر، شاملاً أي أرقام مكتوبة بخط اليد",
  "customer_name": "<اسم العميل>" | null,
  "customer_phone": "<رقم الواتساب للعميل>" | null,
  "invoice_number": "<رقم الفاتورة>" | null,
  "handwritten_amount": "<الرقم المكتوب بخط اليد في أي مكان من الفاتورة>" | null,
  "handwritten_confidence": "high" | "medium" | "low" | null,
  "printed_total_max": "<أكبر رقم مطبوع تحت عمود Total أو Amount (AUM)>" | null
}

قواعد لاستخراج بيانات العميل:
1. ابحث عن السطر الذي يبدأ بكلمة "Client" (أو Client: أو العميل).
2. اسم العميل = النص الموجود مباشرة بعد كلمة Client وقبل أول رقم في نفس السطر.
3. رقم واتساب العميل = رقم موريتاني صالح مكوّن من 8 أرقام يبدأ بـ 2 أو 3 أو 4، موجود في نفس سطر Client فقط.
4. ممنوع استخراج رقم العميل من أي سطر آخر.
5. إذا لم يحتوِ سطر Client على رقم موريتاني صالح، اجعل customer_phone = null.

قواعد لاستخراج المبلغ (مهمة جداً):
- handwritten_amount: ابحث في كامل الصورة عن أي رقم مكتوب بخط اليد (غالباً بقلم أزرق أو أسود)، سواء بجانب "To =" أو "TO =" أو "Total =" أو "TOTAL =" أو "T=" أو بدون أي علامة، في أعلى الفاتورة أو أسفلها أو على الجانب.
- ادعم خط اليد بالقلم الأزرق وتجاهل الأختام والتواقيع والشعارات تماماً.
- اقبل النقاط والفواصل والمسافات داخل الرقم وأعد الأرقام فقط بدون فواصل:
  • "To = 822950" → "822950"
  • "4.550.000" → "4550000"
  • "1 250 000" → "1250000"
  • "Total = 75,000" → "75000"
- إذا كان الرقم المكتوب بخط اليد غير واضح أو يحتمل أكثر من قراءة، اجعل handwritten_amount = null واجعل handwritten_confidence = "low".
- إذا كان الرقم واضحاً تماماً اجعل handwritten_confidence = "high"، وإذا كان مقروءاً مع شك بسيط فاجعله "medium".
- printed_total_max: أعد أكبر مبلغ مطبوع ظاهر في عمود Total أو Amount (AUM) داخل جدول الفاتورة كأرقام فقط بدون فواصل. إن لم يوجد، اجعله null.
- raw_text يجب أن يحتوي على كل النصوص بما فيها المكتوبة بخط اليد.`;

// Mauritanian phone: 8 digits starting with 2, 3 or 4. Optional +222/222 prefix.
function extractMauritanianPhoneFromClientLine(rawText: string): string | null {
  if (!rawText) return null;
  const lines = rawText.split(/\r?\n/);
  const clientLine = lines.find((l) => /^\s*(client|العميل)\b/i.test(l));
  if (!clientLine) return null;
  const afterLabel = clientLine.replace(/^\s*(client\s*:?|العميل\s*:?)/i, " ");
  const digits = afterLabel.replace(/[^\d+]/g, " ");
  const re = /(?:\+?222)?\s*([234]\d{7})(?!\d)/g;
  const m = re.exec(digits);
  if (!m) return null;
  return m[1];
}

// Parse an amount: strip dots, commas and spaces used as thousand separators,
// keep digits only. "4.550.000" -> 4550000, "1 250 000" -> 1250000.
function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Deterministic re-scan of raw_text for handwritten amount markers anywhere in
// the text. Accepts dots/commas/spaces as separators; returns digits only.
function extractHandwrittenAmount(rawText: string): number | null {
  if (!rawText) return null;
  const re = /\b(?:to|total|t)\s*[=:]\s*([\d][\d.,\s]{2,30})/gi;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawText)) !== null) {
    const n = toNumber(m[1]);
    if (n != null && (best == null || n > best)) best = n;
  }
  return best;
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
        amount: null,
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
        amount: null,
        raw_text: "",
        error: `AI gateway error ${res.status}`,
      };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown> = {};
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

    const raw_text = (parsed.raw_text as string | undefined)?.toString() ?? "";
    const phoneFromClientLine = extractMauritanianPhoneFromClientLine(raw_text);

    // Amount: prefer handwritten "To = / Total =" (model output then deterministic re-scan),
    // fall back to largest printed total.
    const handwritten =
      toNumber(parsed.handwritten_amount) ?? extractHandwrittenAmount(raw_text);
    const printed = toNumber(parsed.printed_total_max);
    const amount = handwritten ?? printed;

    return {
      customer_name: (parsed.customer_name as string | undefined)?.toString().trim() || null,
      customer_phone: phoneFromClientLine,
      invoice_number: (parsed.invoice_number as string | undefined)?.toString().trim() || null,
      amount,
      raw_text,
    };
  });

