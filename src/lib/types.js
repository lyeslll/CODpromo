// أنواع العروض وألوانها وأيقوناتها
import { Tag, Ticket, Wallet } from "lucide-react";

export const TYPE_META = {
  "تخفيض": {
    color: "#a6f000",
    glow: "rgba(166,240,0,0.35)",
    icon: Tag,
    label: "تخفيض",
  },
  "كوبون": {
    color: "#38bdf8",
    glow: "rgba(56,189,248,0.35)",
    icon: Ticket,
    label: "كوبون",
  },
  "كاش باك": {
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.35)",
    icon: Wallet,
    label: "كاش باك",
  },
};

export const FALLBACK_TYPE = {
  color: "#a6f000",
  glow: "rgba(166,240,0,0.35)",
  icon: Tag,
  label: "عرض",
};

export const getTypeMeta = (type) => TYPE_META[type] || FALLBACK_TYPE;

// التبويبات/الفلاتر — القيم تبقى عربية (هي قيم قاعدة البيانات المستخدمة في الفلترة).
export const FILTERS = ["الكل", "تخفيض", "كوبون", "كاش باك"];

// ربط قيمة النوع (قيمة قاعدة البيانات) بمفتاح الترجمة — للعرض فقط، لا يغيّر القيمة.
const TYPE_KEYS = {
  "تخفيض": "discount",
  "كوبون": "coupon",
  "كاش باك": "cashback",
  "الكل": "all",
};

/** مفتاح ترجمة نوع العرض (للاستخدام مع t(`types.${key}`) أو t(`filters.${key}`)). */
export const getTypeKey = (type) => TYPE_KEYS[type] || "offer";
