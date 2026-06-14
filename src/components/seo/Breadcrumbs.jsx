// ============================================================
//  CODpromo — فتات التنقّل (Breadcrumbs) أعلى صفحات السيو
//  روابط داخلية تساعد جوجل والمستخدم. الـ Schema يُضاف عبر <Seo> (breadcrumbLd).
// ============================================================

import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/** items: [{ name, to }] — العنصر الأخير هو الصفحة الحالية (بلا رابط). */
export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="breadcrumb" className="mt-2 mb-5 sm:mt-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-mute)]">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {it.to && !last ? (
                <Link to={it.to} className="transition-colors hover:text-[var(--accent-text)]">
                  {it.name}
                </Link>
              ) : (
                <span className={last ? "text-[var(--text)]" : ""}>{it.name}</span>
              )}
              {!last && <ChevronLeft size={13} className="opacity-60 ltr:rotate-180" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
