import { motion } from "framer-motion";
import { Search, Copy, ShoppingBag } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "ابحث عن متجرك",
    desc: "تصفّح مئات المتاجر العربية والعالمية واعثر على عرضك في ثوانٍ.",
  },
  {
    icon: Copy,
    title: "انسخ الكود",
    desc: "بنقرة واحدة ينسخ CODpromo الكود الفعّال مباشرة إلى حافظتك.",
  },
  {
    icon: ShoppingBag,
    title: "وفّر عند الدفع",
    desc: "ألصق الكود في صفحة الشراء واستمتع بالخصم أو الكاش باك فوراً.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-4 py-20">
      <div className="text-center">
        <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--accent-text)]">
          بثلاث خطوات
        </span>
        <h2 className="mt-3 text-[30px] font-black tracking-tight sm:text-[40px]">
          كيف يعمل CODpromo؟
        </h2>
      </div>

      <div className="relative mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="group relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-6"
          >
            <span
              className="absolute left-5 top-5 text-[64px] font-black leading-none"
              style={{ color: "var(--text)", opacity: 0.05 }}
            >
              {i + 1}
            </span>
            <div
              className="relative grid h-14 w-14 place-items-center rounded-2xl transition-transform duration-300 group-hover:-translate-y-1"
              style={{
                background: "linear-gradient(150deg, rgba(166,240,0,0.18), rgba(166,240,0,0.04))",
                border: "1px solid rgba(166,240,0,0.25)",
              }}
            >
              <s.icon size={24} className="text-[var(--color-lime)]" />
            </div>
            <h3 className="relative mt-5 text-[19px] font-extrabold text-[var(--text)]">{s.title}</h3>
            <p className="relative mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
