import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { imageBase64: string; mimeType?: string };
type Output = {
  customer_name: string | null;
  customer_phone: string | null;
  invoice_number: string | null;
  amount: number | null;
  printed_ttc: number | null;
  raw_text: string;
  error?: string;
};

const SYSTEM = `أنت تستخرج بيانات من صور فواتير "مؤسسة بناء - rimsoft". كل الفواتير لها نفس التصميم.

أعد JSON فقط بدون أي شرح بالحقول التالية:
{
  "raw_text": "النص الكامل من الصورة سطراً بسطر، شاملاً ما هو مكتوب بخط اليد",
  "client_line": "<السطر الكامل الذي يبدأ بكلمة Client كما هو>" | null,
  "customer_name": "<اسم العميل>" | null,
  "customer_phone": "<رقم الواتساب 8 أرقام يبدأ بـ 2 أو 3 أو 4>" | null,
  "invoice_number": "<رقم الفاتورة الذي يأتي بعد /f>" | null,
  "handwritten_amount": "<الرقم المكتوب بخط اليد بقلم أزرق في منتصف الفاتورة>" | null,
  "handwritten_confidence": "high" | "medium" | "low" | null,
  "printed_ttc": "<قيمة TTC المطبوعة في أسفل الفاتورة>" | null
}

== بنية سطر Client الثابتة ==
السطر دائماً بهذا الشكل بالضبط:
Client {رقم_حساب} {اسم_العميل} {رقم_واتساب} /f {رقم_فاتورة} {اسم_آخر}

أمثلة:
- "Client 1042 محمد ولد أحمد 22334455 /f 2031 مؤسسة بناء"
  → customer_name = "محمد ولد أحمد"
  → customer_phone = "22334455"
  → invoice_number = "2031"

- "Client 305 الشيخ ولد محمدن 41221199 /f 1875 rimsoft"
  → customer_name = "الشيخ ولد محمدن"
  → customer_phone = "41221199"
  → invoice_number = "1875"

قواعد صارمة:
1. رقم الحساب: أول رقم في السطر مباشرة بعد كلمة Client. ليس رقم الواتساب وليس رقم الفاتورة.
2. اسم العميل: النص الذي يأتي بين رقم الحساب وبين رقم الواتساب (الذي يسبق /f مباشرة).
3. رقم الواتساب: 8 أرقام بالضبط، يبدأ بـ 2 أو 3 أو 4، ويأتي مباشرة قبل "/f".
4. رقم الفاتورة: الرقم الذي يأتي مباشرة بعد "/f".
5. إذا لم يحتوِ سطر Client على رقم 8 خانات يسبق /f، اجعل customer_phone = null.
6. ممنوع استخراج رقم الهاتف أو رقم الفاتورة من أي سطر آخر.

== استخراج المبلغ ==
- handwritten_amount: ابحث عن رقم مكتوب بخط اليد بقلم أزرق في منتصف الفاتورة، غالباً بصيغة "To =" أو "T=" أو "TO =" أو بدون أي علامة. أعد الأرقام فقط بدون فواصل ولا نقاط ولا مسافات.
  • "To = 822950" → "822950"
  • "T= 4.550.000" → "4550000"
  • "1 250 000" → "1250000"
- إذا لم يوجد خط يد، اقرأ قيمة سطر TTC في أسفل الفاتورة وأعدها في printed_ttc.
- handwritten_confidence: "high" إذا كان واضحاً، "medium" مع شك بسيط، "low" إذا غير واضح (وفي هذه الحالة اجعل handwritten_amount = null).
- تجاهل الأختام والتواقيع والشعارات.`;

function extractMauritanianPhoneFromClientLine(rawText: string): string | null {
  if (!rawText) return null;
  const lines = rawText.split(/\r?\n/);
  const clientLine = lines.find((l) => /^\s*(client|العميل)\b/i.test(l));
  if (!clientLine) return null;
  const beforeF = clientLine.match(/(\+?222)?\s*([234]\d{7})\s*\/\s*f\b/i);
  if (beforeF) return beforeF[2];
  const all = clientLine.match(/(?<!\d)([234]\d{7})(?!\d)/g);
  if (all && all.length > 0) return all[all.length - 1];
  return null;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

function extractTtc(rawText: string): number | null {
  if (!rawText) return null;
  const re = /\bttc\b[^\d]{0,10}([\d][\d.,\s]{2,30})/gi;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawText)) !== null) {
    const n = toNumber(m[1]);
    if (n != null && (best == null || n > best)) best = n;
  }
  return best;
}

function extractInvoiceNumberFromClientLine(rawText: string): string | null {
  if (!rawText) return null;
  const lines = rawText.split(/\r?\n/);
  const clientLine = lines.find((l) => /^\s*(client|العميل)\b/i.test(l));
  if (!clientLine) return null;
  const m = clientLine.match(/\/\s*f\s*(\d{1,8})/i);
  return m ? m[1] : null;
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
        printed_ttc: null,
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
        printed_ttc: null,
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
    const clientLineFromModel = (parsed.client_line as string | undefined)?.toString() ?? "";
    const searchSource = clientLineFromModel
      ? `Client ${clientLineFromModel}\n${raw_text}`
      : raw_text;

    const phoneFromClientLine = extractMauritanianPhoneFromClientLine(searchSource);
    const invoiceFromClientLine = extractInvoiceNumberFromClientLine(searchSource);

    const confidence = (parsed.handwritten_confidence as string | undefined)?.toLowerCase() ?? null;
    const handwrittenFromModel =
      confidence === "low" ? null : toNumber(parsed.handwritten_amount);
    const handwrittenFromText = extractHandwrittenAmount(raw_text);
    const handwritten = handwrittenFromModel ?? handwrittenFromText;
    const ttcFromModel = toNumber(parsed.printed_ttc);
    const ttcFromText = extractTtc(raw_text);
    const ttc = ttcFromModel ?? ttcFromText;
    const amount = handwritten ?? ttc;

    console.log("[extract-invoice] amount", {
      handwrittenFromModel,
      handwrittenFromText,
      ttcFromModel,
      ttcFromText,
      confidence,
      chosen: amount,
    });

    return {
      customer_name: (parsed.customer_name as string | undefined)?.toString().trim() || null,
      customer_phone: phoneFromClientLine,
      invoice_number:
        invoiceFromClientLine ||
        (parsed.invoice_number as string | undefined)?.toString().trim() ||
        null,
      amount,
      printed_ttc: ttc,
      raw_text,
    };
  });
