import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { trackClick } from "./supabase.js";
import { fetchFavoriteIds, addFavorite, removeFavorite } from "./favorites.js";

/**
 * أفعال بطاقات العروض المشتركة (صفحة /offers + أقسام الصفحة الرئيسية):
 * المفضّلة (للمسجّلين فقط — الزائر يُوجَّه لتسجيل الدخول) + نسخ الكود مع تتبّع
 * النقرة وتوست التأكيد. setCompanies اختياري لتحديث عدّاد النقرات محلياً.
 */
export function useOfferActions(setCompanies) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const favRef = useRef(favorites);
  favRef.current = favorites;

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    fetchFavoriteIds(user.id)
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, [user]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const toggleFav = useCallback(
    (id) => {
      if (!user) {
        navigate("/login");
        return;
      }
      const isFav = favRef.current.includes(id);
      setFavorites((prev) => (isFav ? prev.filter((f) => f !== id) : [...prev, id]));
      const op = isFav ? removeFavorite(user.id, id) : addFavorite(user.id, id);
      op.catch(() => {
        // تراجع عند الفشل
        setFavorites((prev) => (isFav ? [...prev, id] : prev.filter((f) => f !== id)));
      });
    },
    [user, navigate]
  );

  const handleCopy = useCallback(
    (company, code = company.code) => {
      navigator.clipboard?.writeText(code).catch(() => {});
      trackClick(company.id, company.clicks);
      setCompanies?.((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, clicks: (c.clicks || 0) + 1 } : c))
      );
      setToast(code);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2200);
    },
    [setCompanies]
  );

  return { favorites, toggleFav, handleCopy, toast };
}
