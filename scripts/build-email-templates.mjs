// ============================================================
//  CODpromo — يولّد قوالب إيميلات Supabase Auth من نفس تصميم ونصوص الإيميلات
//  (supabase/functions/_shared/email/render.js + locales/{ar,en,fr}.json).
//
//   node scripts/build-email-templates.mjs              → supabase/templates/auth/*.html + subjects.json
//   node scripts/build-email-templates.mjs --preview D  → معاينة كل القوالب بكل اللغات (HTML) في الدوسي D
//
//  اللغة في قوالب Auth: user_metadata.lang (يتحطّ عند التسجيل ويتحدّث مع لغة الواجهة)، وإلا العربية.
//  القالب = Go template: مقدّمة تقرا .Data.lang ثم {{ if eq $l "en" }}…{{ else if eq $l "fr" }}…{{ else }}…{{ end }}.
//  الصق المحتوى في Supabase → Authentication → Emails → Templates (ولا Management API).
// ============================================================
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderEmail, LANGS, TEMPLATE_NAMES } from "../supabase/functions/_shared/email/render.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// نوع القالب في Supabase → قالبنا + متغيّرات Go
const AUTH = {
  confirmation: { tpl: "auth_confirmation", data: { url: "{{ .ConfirmationURL }}" } },
  recovery: { tpl: "auth_recovery", data: { url: "{{ .ConfirmationURL }}", email: "{{ .Email }}" } },
  email_change: { tpl: "auth_email_change", data: { url: "{{ .ConfirmationURL }}", email: "{{ .Email }}", newEmail: "{{ .NewEmail }}" } },
  magic_link: { tpl: "auth_magic_link", data: { url: "{{ .ConfirmationURL }}" } },
  invite: { tpl: "auth_invite", data: { url: "{{ .ConfirmationURL }}" } },
  reauthentication: { tpl: "auth_reauthentication", data: { token: "{{ .Token }}" } },
};

// $l = user_metadata.lang (أي نوع → نص)، وإلا "ar". index على map ناقص المفتاح ما يطيّحش القالب.
const PRELUDE = '{{- $l := "ar" -}}{{- with .Data -}}{{- with index . "lang" -}}{{- $l = printf "%v" . -}}{{- end -}}{{- end -}}';
const branches = (by) => `${PRELUDE}{{- if eq $l "en" -}}${by.en}{{- else if eq $l "fr" -}}${by.fr}{{- else -}}${by.ar}{{- end -}}`;

const args = process.argv.slice(2);
const previewAt = args.indexOf("--preview");

if (previewAt >= 0) {
  const out = args[previewAt + 1];
  mkdirSync(out, { recursive: true });
  // الصور من public/email محلياً (قبل النشر ما تكونش في codpromo.com)
  const previewOpts = { assetsUrl: pathToFileURL(join(root, "public", "email")).href };
  const sample = {
    url: "https://codpromo.com/auth/v1/verify?token=SAMPLE&type=signup&redirect_to=https://codpromo.com/",
    email: "you@example.com",
    newEmail: "new@example.com",
    token: "482913",
    name: "Ilyes",
    accountType: "customer",
    freeKey: true,
    amount: 9900,
    currency: "DZD",
    provider: "slickpay",
    tier: "launch",
    purchasedAt: new Date().toISOString(),
    refundedAt: new Date().toISOString(),
    premiumUntil: new Date(Date.now() + 30 * 864e5).toISOString(),
  };
  for (const t of TEMPLATE_NAMES) {
    for (const lang of LANGS) {
      const { subject, html } = renderEmail(t, lang, sample, previewOpts);
      writeFileSync(join(out, `${t}.${lang}.html`), html);
      console.log(`${t}.${lang}: ${subject}`);
    }
  }
  const company = renderEmail("welcome", "ar", { ...sample, accountType: "company" }, previewOpts);
  writeFileSync(join(out, "welcome_company.ar.html"), company.html);
} else {
  const dir = join(root, "supabase", "templates", "auth");
  mkdirSync(dir, { recursive: true });
  const subjects = {};
  for (const [type, { tpl, data }] of Object.entries(AUTH)) {
    const by = {};
    const subj = {};
    for (const lang of LANGS) {
      const r = renderEmail(tpl, lang, data);
      by[lang] = r.html;
      subj[lang] = r.subject;
    }
    writeFileSync(join(dir, `${type}.html`), branches(by) + "\n");
    subjects[type] = branches(subj);
    console.log(`${type}.html  ${Math.round(branches(by).length / 1024)} KB`);
  }
  writeFileSync(join(dir, "subjects.json"), JSON.stringify(subjects, null, 2) + "\n");
}
