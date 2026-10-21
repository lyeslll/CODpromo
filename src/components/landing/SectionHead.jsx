/** عنوان قسم موحّد في الصفحة الرئيسية: عنوان قوي + سطر شرح قصير. */
export default function SectionHead({ title, sub, center = false, id }) {
  return (
    <header className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <h2 id={id} className="text-balance text-[30px] font-black leading-[1.12] tracking-tight sm:text-[40px] lg:text-[46px]">
        {title}
      </h2>
      {sub && <p className={`mt-4 text-[16px] leading-[1.75] text-[var(--text-soft)] sm:text-[17px] ${center ? "text-balance" : ""}`}>{sub}</p>}
    </header>
  );
}
