// ============================================================
//  BidiText — نص عربي فيه كلمات لاتينية (أسماء الشركات، الأكواد…)
//  في الصفحات العربية (RTL) كل سلسلة لاتينية تتعزل في <bdi> باش ما تتلخبطش الرموز حولها:
//  مثلاً "لأعضاء CODpromo Premium!" كانت تبان "!CODpromo Premium" — دروك علامة التعجب
//  تبقى مع الكلمة اللاتينية اللي قبلها. الأرقام (10%، 5$) تبقى كيما هي (المتصفح يعرضها صحيح).
// ============================================================

// كلمة لاتينية (وفيها أرقام ورموز داخلية: Just.Sell، Voice213، e-commerce) + كلمات بعدها + ! أو ? في الآخر
const RUN = /([A-Za-z][A-Za-z0-9]*(?:[.&+'’_-][A-Za-z0-9]+)*(?:[  ]+[A-Za-z0-9][A-Za-z0-9]*(?:[.&+'’_-][A-Za-z0-9]+)*)*[!?]*)/g;

export function bidiParts(text) {
  return String(text ?? "").split(RUN);
}

export default function BidiText({ text, rtl = true }) {
  if (text == null || text === "") return null;
  if (!rtl) return text;
  const parts = bidiParts(text);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 ? <bdi key={i}>{p}</bdi> : p || null));
}
