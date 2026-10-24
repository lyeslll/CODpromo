import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, Loader2, Square, TimerReset } from "lucide-react";
import { listTestPrices, setTestPrice, stopTestPrice } from "../../../lib/sales.js";
import { useAdminT, Glass, fmt, inputCls } from "./ui.jsx";

const BLUE = "#38bdf8";

/** "12:05" — الوقت الباقي حتى expires_at */
const left = (iso, now) => {
  const s = Math.max(0, Math.floor((new Date(iso) - now) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * سعر التجربة (phase32b): حساب واحد بالإيميل ← مبلغ صغير بالدينار وبالدولار لمدة 30 دقيقة.
 * يتقرّر في الخادم (pricing_for_user) لهاد الحساب برك؛ الشراء يتسجّل tier = 'test' وما يتحسبش
 * في المبيعات ولا في مقاعد الإطلاق. RPCs: admin_set_test_price / admin_test_prices / admin_stop_test_price.
 */
export default function TestPriceCard({ notify }) {
  const t = useAdminT();
  const [email, setEmail] = useState("");
  const [dzd, setDzd] = useState("");
  const [usd, setUsd] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [now, setNow] = useState(Date.now());
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async () => {
    try {
      setRows(await listTestPrices());
    } catch (e) {
      notifyRef.current("error", e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // العدّاد + الإزالة وحدها كي يكمل الوقت
  useEffect(() => {
    if (!rows.length) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (rows.some((r) => new Date(r.expires_at) <= n)) setRows((rs) => rs.filter((r) => new Date(r.expires_at) > n));
    }, 1000);
    return () => clearInterval(id);
  }, [rows]);

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && Number(dzd) >= 50 && Number(usd) >= 0.5;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      const r = await setTestPrice(email.trim(), dzd, usd);
      notify(
        r?.already_premium ? "error" : "success",
        r?.already_premium ? t("pricing.test.alreadyPremium", { email: r.email }) : t("pricing.test.started", { email: r.email })
      );
      setEmail("");
      await load();
    } catch (err) {
      const m = String(err.message || "");
      notify("error", /user not found/i.test(m) ? t("pricing.test.notFound") : /invalid test price/i.test(m) ? t("pricing.test.invalid") : m);
    } finally {
      setBusy(false);
    }
  };

  const stop = async (r) => {
    try {
      await stopTestPrice(r.user_id);
      notify("success", t("pricing.test.stopped", { email: r.email }));
      await load();
    } catch (e) {
      notify("error", e.message);
    }
  };

  return (
    <Glass className="mt-5 p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
        <FlaskConical size={17} style={{ color: BLUE }} /> {t("pricing.test.title")}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("pricing.test.hint")}</p>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">{t("pricing.test.email")}</span>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={inputCls} required />
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">{t("pricing.test.dzd")}</span>
          <input type="number" dir="ltr" min={50} step={1} value={dzd} onChange={(e) => setDzd(e.target.value)} placeholder="100" className={`${inputCls} tabular-nums`} required />
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">{t("pricing.test.usd")}</span>
          <input type="number" dir="ltr" min={0.5} step={0.01} value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="0.50" className={`${inputCls} tabular-nums`} required />
        </label>
        <button
          type="submit"
          disabled={!valid || busy}
          className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border px-4 text-[13.5px] font-extrabold disabled:opacity-50"
          style={{ borderColor: `${BLUE}66`, background: `${BLUE}1f`, color: "#bae6fd" }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <TimerReset size={15} />} {t("pricing.test.start")}
        </button>
      </form>

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-black/25">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3">
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-white" dir="ltr">
                {r.email}
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[#bae6fd]">
                {t("pricing.test.amount", { dzd: fmt(r.price_dzd), usd: Number(r.price_usd).toFixed(2) })}
              </span>
              <span className="text-[12.5px] tabular-nums text-[var(--color-mute)]">{t("pricing.test.left", { time: left(r.expires_at, now) })}</span>
              <button
                type="button"
                onClick={() => stop(r)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] font-bold text-[#c9c9cf] hover:text-white"
              >
                <Square size={12} /> {t("pricing.test.stop")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Glass>
  );
}
