import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  // انتهى جلب الملف الشخصي للمستخدم الحالي؟ (لتفادي وميض واجهة خاطئة قبل وصوله)
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // جلب الملف الشخصي (نوع الحساب وبياناته) من جدول profiles
  const loadProfile = async (uid) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    return data || null;
  };

  useEffect(() => {
    let active = true;
    if (!user) {
      setProfile(null);
      setProfileLoaded(false);
      return;
    }
    setProfileLoaded(false);
    loadProfile(user.id).then((p) => {
      if (!active) return;
      setProfile(p);
      setProfileLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const value = {
    user,
    session,
    loading,
    profile,
    profileLoaded,
    // نوع الحساب: من الـ profile أولاً ثم الميتاداتا، والافتراضي زبون
    accountType:
      profile?.account_type || user?.user_metadata?.account_type || "customer",
    // يعيد تحميل الملف الشخصي ويُرجِع النسخة الجديدة (للتحقّق الفوري من الاشتراك)
    refreshProfile: async () => {
      if (!user) return null;
      const p = await loadProfile(user.id);
      setProfile(p);
      return p;
    },

    // إنشاء حساب بالإيميل وكلمة المرور (metadata = نوع الحساب وبياناته).
    // redirectPath اختياري: رابط التفعيل في الإيميل يرجّع لهاد الصفحة (مثلاً صفحة هدية معلّقة).
    signUp: (email, password, metadata = {}, redirectPath = null) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          ...(redirectPath ? { emailRedirectTo: `${window.location.origin}${redirectPath}` } : {}),
        },
      }),

    // تسجيل الدخول بالإيميل وكلمة المرور
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({
        email,
        password,
      }),

    // تسجيل الدخول/التسجيل عبر Google (next: صفحة الرجوع، الافتراضي /dashboard)
    signInWithGoogle: (next = null) =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${typeof next === "string" && next.startsWith("/") ? next : "/dashboard"}` },
      }),

    // إرسال رابط استعادة كلمة المرور (يفتح صفحة /reset-password)
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),

    // تعيين كلمة مرور جديدة (بعد فتح رابط الاستعادة)
    updatePassword: (password) => supabase.auth.updateUser({ password }),

    // تسجيل الخروج
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
