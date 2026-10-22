// ============================================================
//  هل للعرض نسخة Premium حقيقية؟ (قاعدة واحدة لكل البطاقات)
//  - بطاقة الكود: كود Premium عامر (companies.has_premium_code، محسوب في القاعدة —
//    الكود نفسه لا يُقرأ أبداً) و Premium غير معطّل للشركة (supports_premium).
//  - العرض بلا كود: رابط Premium موجود (nocode_deals.has_premium).
//  بلا عرض Premium → البطاقة "مجمّدة" في وضع Premium، في نفس بلاصتها (الترتيب ما يتبدّلش بين الوضعين).
//  قيمة غير معروفة (undefined) = نعتبر العرض موجوداً (نفس السلوك القديم).
// ============================================================

export const hasPremiumOffer = (company) => company?.supports_premium !== false && company?.has_premium_code !== false;

export const dealHasPremium = (deal) => deal?.has_premium === true;
