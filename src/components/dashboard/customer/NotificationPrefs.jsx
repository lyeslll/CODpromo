import { useEffect, useState } from "react";
import { Bell, Check, Heart, LayoutGrid, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCategories } from "../../../lib/categories.jsx";
import { activeCategories } from "../../../lib/offerFilters.js";
import { categoryName } from "../../../lib/slug.js";
import { fetchMyPrefs, saveMyPrefs } from "../../../lib/notifications.js";
import { useNotifications } from "../../../lib/useNotifications.js";
import PushToggle from "../../notifications/PushToggle.jsx";

const LIME_BG = { background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" };
const SCOPES = [
  { value: "all", Icon: Bell },
  { value: "categories", Icon: LayoutGrid },
  { value: "favorites", Icon: Heart },
];

/**
 * الداشبورد (#notifications): واش يوصلو في الجرس وعلى الهاتف — كل الجديد، فئات معيّنة، ولا المفضّلة برك
 * (الميزات والإعلانات توصل ديما). التفضيلات في القاعدة (set_notification_prefs، صاحب الحساب برك)،
 * وزر إشعارات هاد الجهاز تحتها.
 */
export default function NotificationPrefs() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { categories } = useCategories();
  const cats = activeCategories(categories);
  const notif = useNotifications();
  const [loaded, setLoaded] = useState(false);
  const [scope, setScope] = useState("all");
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchMyPrefs()
      .then((p) => {
        if (!alive) return;
        setScope(p.scope);
        setPicked(p.categories);
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  // رابط الجرس (/dashboard#notifications) يوصّل هنا
  useEffect(() => {
    if (!loaded || window.location.hash !== "#notifications") return;
    document.getElementById("notifications")?.scrollIntoView({ block: "start" });
  }, [loaded]);

  const toggleCat = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (scope === "categories" && !picked.length) return setMsg({ ok: false, text: t("notify.prefs.pickOne") });
    setSaving(true);
    setMsg(null);
    try {
      await saveMyPrefs(scope, scope === "categories" ? picked : []);
      setMsg({ ok: true, text: t("notify.prefs.saved") });
      notif.refresh();
    } catch {
      setMsg({ ok: false, text: t("notify.prefs.error") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="notifications" className="scroll-mt-28 rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 sm:p-6">
      <h2 className="text-[18px] font-extrabold text-[var(--text)]">{t("notify.prefs.title")}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-soft)]">{t("notify.prefs.lead")}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className={loaded ? "" : "pointer-events-none opacity-60"} aria-busy={!loaded}>
          <div role="radiogroup" aria-label={t("notify.prefs.title")} className="grid gap-2 sm:grid-cols-3">
            {SCOPES.map(({ value, Icon }) => {
              const on = scope === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setScope(value);
                    setMsg(null);
                  }}
                  className={`flex min-h-[64px] items-start gap-2.5 rounded-2xl border p-3 text-start transition-colors ${
                    on ? "border-[var(--color-lime)]/50 bg-[var(--color-lime)]/[0.07]" : "border-[var(--color-ink-line)] bg-[var(--fill)] hover:border-white/15"
                  }`}
                >
                  <Icon size={17} className={`mt-0.5 shrink-0 ${on ? "text-[var(--accent-text)]" : "text-[var(--color-mute)]"}`} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-extrabold text-[var(--text)]">{t(`notify.prefs.${value}`)}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-soft)]">{t(`notify.prefs.${value}Hint`)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {scope === "categories" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {cats.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCat(c.id)}
                    className={`flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${
                      on ? "border-[var(--color-lime)]/50 bg-[var(--color-lime)]/10 text-[var(--accent-text)]" : "border-[var(--color-ink-line)] text-[var(--text-soft)] hover:text-[var(--text)]"
                    }`}
                  >
                    {on && <Check size={13} />}
                    {categoryName(c, lang)}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-[12px] text-[var(--color-mute)]">{t("notify.prefs.always")}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !loaded}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-5 text-[13.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
              style={LIME_BG}
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {t("notify.prefs.save")}
            </button>
            {msg && (
              <p role="status" className={`text-[12.5px] font-bold ${msg.ok ? "text-[var(--accent-text)]" : "text-red-400"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-extrabold text-[var(--text-softer)]">{t("notify.prefs.device")}</p>
          <PushToggle />
        </div>
      </div>
    </section>
  );
}
