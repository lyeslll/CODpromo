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

// التبويبات/الفلاتر
export const FILTERS = ["الكل", "تخفيض", "كوبون", "كاش باك"];
