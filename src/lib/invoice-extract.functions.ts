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
  "customer_phone": "<رقم الواتساب للعميل بالأرقام فقط مع رمز الدولة إن وُجد>" | null,
  "invoice_number": "<رقم الفاتورة>" | null
}

قواعد صارمة لاستخراج بيانات العميل:
1. ابحث في النص عن سطر يبدأ بكلمة "Client" (أو Client: أو العميل).
2. اسم العميل = النص الموجود مباشرة بعد كلمة Client وقبل أول رقم.
3. رقم واتساب العميل = الرقم الموجود مباشرة بعد اسم العميل في نفس السطر.
4. لا تستخدم رقم الفاتورة أو أرقام المواد أو الكميات أو الأسعار أو التاريخ كرقم للعميل أبداً.
5. إذا لم يوجد سطر يبدأ بـ Client، اجعل customer_name و customer_phone = null.
6. raw_text يجب أن يحتوي على النص الكامل المستخرج كما هو (مهم للتشخيص).`;

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
    return {
      customer_name: parsed.customer_name?.toString().trim() || null,
      customer_phone:
        parsed.customer_phone?.toString().replace(/[^\d+]/g, "") || null,
      invoice_number: parsed.invoice_number?.toString().trim() || null,
      raw_text: parsed.raw_text?.toString() ?? "",
    };
  });
