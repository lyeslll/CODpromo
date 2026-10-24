import { useEffect, useState } from "react";
import { ChevronLeft, Crown, Key, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";
import KeysSheet from "./KeysSheet.jsx";
import { DiamondGlyph } from "./DiamondKey.jsx";
import { MiniLogo, ValueGain } from "./KeyUnlockDialog.jsx";
import { DIA_BG, DIA_DEEP } from "./diamond.js";
import { usePricing, formatPrice } from "../../lib/pricing.jsx";
import { fetchKeyPacks, demoPacks } from "../../lib/keys.js";
import { useKeys } from "../../lib/keysContext.jsx";

const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";

/**
 * كود مقفول وما عندوش مفاتيح ماسية: يختار — المفتاح الذهبي (إذا مازال عندو)، ولا شراء مفاتيح، ولا Premium.
 * كل خيار يبيّن واش يربح (العادي ← Premium). السعر الأدنى للمفاتيح من القاعدة (my_key_packs).
 */
export default function KeyChooser({ open, company, normal, premium, golden, onGolden, onBuy, onPremium, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const pricing = usePricing();
  const keys = useKeys();
  const [packs, setPacks] = useState(null);

  useEffect(() => {
    if (!open || packs) return;
    let alive = true;
    (keys.demo ? Promise.resolve(demoPacks()) : fetchKeyPacks())
      .then((d) => alive && setPacks(d))
      .catch(() => alive && setPacks(null));
    return () => {
      alive = false;
    };
  }, [open, packs, keys.demo]);

  const cheapest = packs?.packs?.length ? [...packs.packs].sort((a, b) => a.priceDzd - b.priceDzd)[0] : null;
  const canBuy = !packs?.blocked && (packs?.maxKeys == null || (cheapest && cheapest.keys <= packs.maxKeys));
  const name = company?.name || "";

  const Option = ({ onClick, icon, bg, title, desc, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] p-3 text-start transition-colors hover:border-white/25 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: bg }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-extrabold text-[var(--text)]">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-soft)]">{desc}</span>
      </span>
      <ChevronLeft size={18} className="shrink-0 text-[var(--color-mute)] ltr:rotate-180" />
    </button>
  );

  return (
    <KeysSheet
      open={open}
      onClose={onClose}
      labelledBy="dk-chooser-title"
      title={t("keys.chooser.title")}
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border" style={{ borderColor: `${DIA_DEEP}66`, background: "rgba(169,205,255,0.08)" }}>
          <LockKeyhole size={18} className="text-[#dbeeff]" />
        </span>
      }
    >
      <div className="flex items-center gap-3 rounded-2xl border px-3.5 py-3" style={{ borderColor: `${DIA_DEEP}44`, background: "rgba(169,205,255,0.05)" }}>
        <MiniLogo logo={company?.logo} name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-extrabold text-[var(--text)]">{name}</div>
          <ValueGain normal={normal} premium={premium} className="max-w-full text-[13.5px]" />
        </div>
      </div>
      <p className="mb-2.5 mt-4 text-[13px] font-extrabold text-[var(--text-softer)]">{t("keys.chooser.how")}</p>
      <div className="flex flex-col gap-2">
        {golden && (
          <Option
            onClick={onGolden}
            bg={GOLD_BG}
            icon={<Key size={19} className="text-[#1d1403]" />}
            title={t("keys.chooser.golden")}
            desc={t("keys.chooser.goldenDesc")}
          />
        )}
        <Option
          onClick={onBuy}
          disabled={packs && !canBuy}
          bg={DIA_BG}
          icon={<DiamondGlyph size={20} />}
          title={t("keys.chooser.buy")}
          desc={
            packs && !canBuy
              ? t("keys.chooser.buyLimit")
              : cheapest
                ? t("keys.chooser.buyDesc", { count: cheapest.keys, price: formatPrice(t, lang, cheapest.priceDzd, cheapest.priceUsd) })
                : t("keys.chooser.buyDescPlain")
          }
        />
        <Option
          onClick={onPremium}
          bg="linear-gradient(135deg, rgba(240,198,60,0.25), rgba(240,198,60,0.08))"
          icon={<Crown size={19} className="text-[#ffe486]" />}
          title={t("keys.chooser.premium")}
          desc={pricing ? t("keys.chooser.premiumDesc", { price: formatPrice(t, lang, pricing.dzd, pricing.usd) }) : t("keys.chooser.premiumDescPlain")}
        />
      </div>
    </KeysSheet>
  );
}
