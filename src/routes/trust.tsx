import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "الأمان والخصوصية — بِناء HUB" },
      {
        name: "description",
        content:
          "صفحة الأمان والخصوصية لمنصة بِناء HUB: شرح لضوابط الوصول وحماية البيانات والممارسات المتبعة.",
      },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="mb-6">
          <Link
            to="/"
            className="text-sm text-primary hover:underline"
          >
            ← الصفحة الرئيسية
          </Link>
        </div>

        <header className="border-b border-border pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">
            الأمان والخصوصية
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            تُحرَّر هذه الصفحة من قِبَل فريق <strong>بِناء HUB</strong> للإجابة
            عن الأسئلة الشائعة حول الأمان والخصوصية في المنصة. المحتوى أدناه
            يصف الضوابط والممارسات الحالية كما هي مفعَّلة داخل التطبيق، وهو
            ليس شهادة مستقلة ولا يُمثِّل اعتماداً أو تدقيقاً خارجياً.
          </p>
        </header>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">الوصول والمصادقة</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            الوصول إلى التطبيق يتطلب تسجيل دخول بحساب مُصرَّح به. تُدار جلسات
            المستخدمين عبر مزود المصادقة المُدمَج، وتُطبَّق صلاحيات قائمة على
            الأدوار (مدير، محاسب، مسؤول توصيل، مراقب) لتحديد ما يمكن لكل مستخدم
            عرضه أو تعديله.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">حماية البيانات</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            تُطبَّق سياسات الوصول على مستوى الصف (Row-Level Security) في قاعدة
            البيانات بحيث لا يستطيع المستخدم قراءة أو تعديل بيانات خارج نطاق
            صلاحياته. عمليات الحذف على السجلات المالية الحساسة مقصورة على
            المدير أو المستخدم الذي أنشأ السجل.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">البنية التحتية والاستضافة</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            يعمل التطبيق على بنية Lovable Cloud المُدارة. تُوفِّر المنصة قدرات
            مُفعَّلة مثل النقل المشفر عبر HTTPS وتخزين قاعدة بيانات مُدارة.
            هذه قدرات منصة وليست شهادات أو ادعاءات امتثال مستقلة.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">المسؤولية المشتركة</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            توفِّر المنصة (Lovable Cloud) ضوابط الأمان على مستوى البنية
            التحتية، بينما يتحمَّل مالك التطبيق مسؤولية إعدادات الحسابات
            وصلاحيات المستخدمين ومحتوى البيانات المُدخَلة. ويتحمَّل المستخدم
            النهائي مسؤولية حماية بيانات اعتماد الدخول الخاصة به.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold">الإبلاغ عن مشكلة أمنية</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            لإبلاغ فريق التطبيق عن أي مشكلة أمنية محتملة، يُرجى التواصل مع
            مسؤول النظام داخل المؤسسة عبر القنوات الرسمية المعتمدة لديكم.
          </p>
        </section>

        <footer className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          هذه الصفحة محتوى قابل للتحرير من قِبَل مالك التطبيق، ولا تُمثِّل
          تحقُّقاً مستقلاً أو شهادة من Lovable.
        </footer>
      </div>
    </div>
  );
}
