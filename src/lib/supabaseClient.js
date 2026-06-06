import { createClient } from "@supabase/supabase-js";

// المفاتيح من متغيرات البيئة (تُضبط في .env محلياً وفي Vercel).
// fallback للقيم العامة الحالية حتى لا ينكسر الموقع إن لم تُضبط بعد.
const url = import.meta.env.VITE_SUPABASE_URL || "https://uulcgvdsqivgkiulurhk.supabase.co";
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
