import { ExternalLink, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";

/** طوّر تجارتك: Ilyes Derradji (محتوى التعلّم) + Stork Community (اللوغو الحقيقي من stork.team؛ أعضاؤه يستفيدون من Premium مجاناً). */
export default function GrowCards() {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="mb-3 text-[18px] font-extrabold text-[var(--text)]">{t("dashboard.grow.title")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <a
          href="https://ilyesderradji.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4 transition-colors hover:border-white/20 sm:p-5"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--fill)]">
            <img src="/brand/ilyes-derradji.png" alt="" width={219} height={176} className="h-8 w-auto opacity-90" loading="lazy" decoding="async" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-[var(--text)]">Ilyes Derradji</span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[var(--text-soft)]">{t("dashboard.grow.ilyesDesc")}</span>
          </span>
          <ExternalLink size={16} className="shrink-0 text-[var(--color-mute)] transition-colors group-hover:text-[var(--text)]" />
        </a>

        <a
          href="https://www.stork.team"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-[#f0c63c]/25 bg-[var(--color-ink-card)] p-4 transition-colors hover:border-[#f0c63c]/50 sm:p-5"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#f0c63c]/10">
            <img src="/brand/stork.png" alt="" width={160} height={160} className="h-10 w-10" loading="lazy" decoding="async" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-[var(--text)]">{t("dashboard.grow.storkTitle")}</span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[var(--text-soft)]">{t("dashboard.grow.storkDesc")}</span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-[#ffe486]">
              <Crown size={12} /> {t("dashboard.grow.storkPerk")}
            </span>
          </span>
          <ExternalLink size={16} className="shrink-0 text-[var(--color-mute)] transition-colors group-hover:text-[var(--text)]" />
        </a>
      </div>
    </section>
  );
}
