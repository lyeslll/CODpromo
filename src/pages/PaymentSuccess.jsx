import PurchaseSuccess from "../components/payment/PurchaseSuccess.jsx";

/** عودة Stripe (?session_id=…) وشراء Google Play (?via=google_play): صفحة النجاح الموحّدة (تستنى تسجيل الشراء). */
export default function PaymentSuccess() {
  return <PurchaseSuccess />;
}
