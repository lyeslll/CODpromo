import { Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import CustomerDashboard from "./dashboard/CustomerDashboard.jsx";
import CompanyDashboard from "./dashboard/CompanyDashboard.jsx";

/** يوجّه كل مستخدم لواجهته حسب نوع حسابه (account_type). */
export default function Dashboard() {
  const { accountType, profile, user } = useAuth();

  // ننتظر تحميل الـ profile لتفادي وميض الواجهة الخاطئة (إلا إن توفّر النوع في الميتاداتا)
  const metaType = user?.user_metadata?.account_type;
  if (!profile && !metaType) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] text-[var(--color-mute)]">
        <Loader2 size={26} className="animate-spin text-[var(--color-lime)]" />
      </div>
    );
  }

  return accountType === "company" ? <CompanyDashboard /> : <CustomerDashboard />;
}
