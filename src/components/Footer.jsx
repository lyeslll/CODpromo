import { Mail, MessageCircle, Send, Heart } from "lucide-react";
import Logo from "./Logo.jsx";

export default function Footer({ count }) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-[var(--color-ink-line)]">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[700px] -translate-x-1/2 rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle, rgba(166,240,0,0.10), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-soft)]">
              منصة عربية لأكواد الخصم والكوبونات والكاش باك — نوفّر لك المال في كل
              عملية شراء أونلاين.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {[Send, MessageCircle, Mail].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text-softer)] transition-colors hover:border-[var(--color-lime)]/40 hover:text-[var(--accent-text)]"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--color-ink-line)] pt-6 text-[12.5px] text-[var(--color-mute)] sm:flex-row">
          <span>
            © {year} CODpromo · {count} عرض متاح
          </span>
          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="font-medium text-[var(--color-mute)] transition-colors hover:text-[var(--accent-text)]"
            >
              لوحة التحكم
            </a>
            <span className="flex items-center gap-1.5">
              صُنع بكل <Heart size={12} className="fill-red-500 text-red-500" /> في الجزائر
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
