import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { getPendingGift, giftPath } from "../../lib/gifts.js";

// صفحات ما نقاطعوهاش (لوحة الأدمن، وتعيين كلمة سر جديدة)
const SKIP = ["/gift/", "/admin", "/reset-password"];

/**
 * احتياط عام: زائر فتح رابط هدية (الكود معلّق في sessionStorage) ومن بعد دخل / سجّل من أي بلاصة
 * (حتى بـ Google، ولا رجوع لصفحة غير صفحة الهدية) → نرجّعوه لصفحة الهدية، وهي تفعّلها وحدها.
 * مرة وحدة لكل كود في عمر الصفحة (ما نحبسوش الزائر في حلقة إذا فشل الاتصال).
 */
export default function GiftResume() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const done = useRef(new Set());

  useEffect(() => {
    if (loading || !user || SKIP.some((p) => pathname.startsWith(p))) return;
    const code = getPendingGift();
    if (!code || done.current.has(code)) return;
    done.current.add(code);
    navigate(giftPath(code), { replace: true });
  }, [user, loading, pathname, navigate]);

  return null;
}
