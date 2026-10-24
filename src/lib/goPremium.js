import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { premiumPath } from "./seo.js";

// ============================================================
//  CODpromo — كل زر ولا رابط Premium يوصّل لصفحة البيع /premium (بلاصة نافذة الدفع مباشرة).
//  نافذة الدفع (PremiumModal) تتحلّ غير من /premium (زر الشراء) ومن الداشبورد ("أنا عضو Stork").
//
//  زائر بلا حساب ضغط "اشترِ": نحفظو علامة في sessionStorage ونبعثوه للتسجيل / الدخول؛
//  من بعد يرجع لـ /premium?checkout=1 والنافذة تتحلّ وحدها (نفس طريقة الهدية والمفتاح الذهبي).
// ============================================================

const PENDING_KEY = "codpromo:premium-pending";
// العلامة تطيح بعد ساعة (زائر بدا الشراء ونسى)
const PENDING_TTL_MS = 60 * 60 * 1000;

/** يرجّع دالة تفتح صفحة Premium بلغة الواجهة. */
export function useGoPremium() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  return useCallback(() => navigate(premiumPath(i18n.language)), [navigate, i18n.language]);
}

export function setPendingPremium(lang = "ar") {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ lang, at: Date.now() }));
  } catch {
    /* sessionStorage غير متاح — الزائر يرجع لصفحة Premium بيدو */
  }
}

function getPendingPremium() {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    if (!p || Date.now() - p.at > PENDING_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearPendingPremium() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* تجاهل آمن */
  }
}

/** مسار الرجوع بعد الدخول / التسجيل (صفحة Premium + فتح نافذة الدفع)، أو null. */
export const pendingPremiumPath = () => {
  const p = getPendingPremium();
  return p ? `${premiumPath(p.lang)}?checkout=1` : null;
};
