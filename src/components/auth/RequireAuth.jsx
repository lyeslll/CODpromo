import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth.jsx";

/** يحمي الصفحات الخاصة: يحوّل غير المسجّلين إلى /login. */
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] text-[var(--color-mute)]">
        <Loader2 size={26} className="animate-spin text-[var(--color-lime)]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}
