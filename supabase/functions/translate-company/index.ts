// ============================================================
//  CODpromo — Edge Function: translate-company
//  تستقبل حقول نصية عربية وتُرجعها مترجمة إلى الإنجليزية والفرنسية
//  عبر Anthropic API (موديل Haiku — رخيص وجودته مليحة).
//
//  المفتاح ANTHROPIC_API_KEY يُقرأ من Supabase secrets فقط:
//    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  --project-ref uulcgvdsqivgkiulurhk
//  النشر (بدون التحقق من JWT لأن لوحة الأدمن لا تستخدم جلسة مستخدم):
//    supabase functions deploy translate-company --no-verify-jwt --project-ref uulcgvdsqivgkiulurhk
// ============================================================

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM = `You are a professional marketing translator for CODpromo, an e-commerce platform for discount codes, coupons and cashback.
Translate the given Arabic field values into natural, persuasive MARKETING English and French — not literal, concise and appealing to global brands and shoppers.
Rules (strict):
- Keep brand names, store names, product names exactly as-is (e.g. Shipper, Bybit, YouCan, Temu).
- Keep promo/discount codes exactly as-is (e.g. ILYES5, SAVE20) — never translate or alter them.
- Keep URLs, numbers, currencies and percentages exactly as-is (e.g. 20%, 2500 DZD, $10).
- Preserve the original meaning; do not add or remove information.
Return ONLY a minified JSON object, no markdown, no code fences, no commentary.`;

/** يستخرج JSON من نص الموديل (يزيل أسوار ```json إن وُجدت). */
function parseModelJson(text: string): { en?: Record<string, string>; fr?: Record<string, string> } {
  let t = (text || "").trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "missing ANTHROPIC_API_KEY secret" }, 500);

    const { fields } = await req.json().catch(() => ({ fields: null }));
    // نقبل فقط الحقول النصية غير الفارغة
    const src: Record<string, string> = {};
    if (fields && typeof fields === "object") {
      for (const [k, v] of Object.entries(fields)) {
        if (typeof v === "string" && v.trim()) src[k] = v.trim();
      }
    }
    if (Object.keys(src).length === 0) return json({ en: {}, fr: {} });

    const userMsg =
      `Translate these field values. Return JSON exactly of shape ` +
      `{"en":{...},"fr":{...}} using the SAME keys as the input.\n` +
      `Input: ${JSON.stringify(src)}`;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json({ error: `anthropic ${res.status}`, detail }, 502);
    }

    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
      : "";

    let out: { en?: Record<string, string>; fr?: Record<string, string> };
    try {
      out = parseModelJson(text);
    } catch {
      return json({ error: "could not parse model output", raw: text }, 502);
    }

    return json({ en: out.en ?? {}, fr: out.fr ?? {} });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
