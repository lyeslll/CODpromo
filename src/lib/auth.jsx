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

  const value = {
    user,
    session,
    loading,

    // إنشاء حساب بالإيميل وكلمة المرور (metadata = نوع الحساب وبياناته) + captcha
    signUp: (email, password, metadata = {}, captchaToken) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: metadata, captchaToken },
      }),

    // تسجيل الدخول بالإيميل وكلمة المرور + captcha
    signIn: (email, password, captchaToken) =>
      supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      }),

    // تسجيل الدخول/التسجيل عبر Google
    signInWithGoogle: () =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      }),

    // إرسال رابط استعادة كلمة المرور (يفتح صفحة /reset-password)
    resetPassword: (email, captchaToken) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      }),

    // تعيين كلمة مرور جديدة (بعد فتح رابط الاستعادة)
    updatePassword: (password) => supabase.auth.updateUser({ password }),

    // تسجيل الخروج
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
