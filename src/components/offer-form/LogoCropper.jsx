import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, ZoomIn, ZoomOut, Check, Move } from "lucide-react";

// ============================================================
//  قصّ اللوغو قبل الرفع (كيما إنستغرام): سحب لتحريك الصورة، تكبير/تصغير (شريط + عجلة + قرص بإصبعين)،
//  اختيار الخلفية (شفاف / أبيض / داكن / لون)، وتصدير مربع 512px WebP (PNG إذا المتصفح ما يدعمش WebP).
//  النص يجي من t (فورم الشركة) — بلا نص ثابت هنا.
// ============================================================
const OUT = 512; // حجم الملف المحفوظ
const VIEW = 280; // حجم المعاينة على الشاشة
const BGS = [
  { key: "transparent", value: null },
  { key: "white", value: "#ffffff" },
  { key: "dark", value: "#141417" },
];

export default function LogoCropper({ file, t, dir = "rtl", onCancel, onDone }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1); // 1 = الصورة كاملة داخل المربع
  const [pos, setPos] = useState({ x: 0, y: 0 }); // إزاحة المركز (بكسل المعاينة)
  const [bg, setBg] = useState("transparent");
  const [custom, setCustom] = useState("#a6f000");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const drag = useRef(null);
  const pinch = useRef(null);
  const pointers = useRef(new Map());

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Esc يلغي
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const bgColor = bg === "custom" ? custom : BGS.find((b) => b.key === bg)?.value ?? null;

  /** يرسم على أي canvas بحجم size (المعاينة ولا الملف). */
  const draw = (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }
    if (!img) return;
    const k = size / VIEW;
    const fit = Math.min(VIEW / img.width, VIEW / img.height) * zoom; // "contain" × zoom
    const w = img.width * fit * k;
    const h = img.height * fit * k;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, size / 2 - w / 2 + pos.x * k, size / 2 - h / 2 + pos.y * k, w, h);
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = VIEW * dpr;
    c.height = VIEW * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, VIEW);
  });

  const clampZoom = (z) => Math.min(4, Math.max(0.4, z));
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, pos };
    }
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setZoom(clampZoom((pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d));
      return;
    }
    if (!drag.current) return;
    setPos({ x: drag.current.pos.x + (e.clientX - drag.current.x), y: drag.current.pos.y + (e.clientY - drag.current.y) });
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
  };

  const apply = async () => {
    if (!img || busy) return;
    setBusy(true);
    const c = document.createElement("canvas");
    c.width = OUT;
    c.height = OUT;
    draw(c.getContext("2d"), OUT);
    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/webp", 0.9));
    const type = blob?.type === "image/webp" ? "image/webp" : "image/png";
    const out = blob?.type === "image/webp" ? blob : await new Promise((resolve) => c.toBlob(resolve, "image/png"));
    setBusy(false);
    if (!out) return onCancel();
    onDone(new File([out], type === "image/webp" ? "logo.webp" : "logo.png", { type }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" dir={dir} role="dialog" aria-modal="true" aria-label={t("cropper.title")}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px] rounded-[22px] border border-white/[0.08] bg-[#0f0f12] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-white">{t("cropper.title")}</h2>
          <button type="button" onClick={onCancel} aria-label={t("cancel")} className="grid h-10 w-10 place-items-center rounded-xl text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-[22px] border border-white/[0.1]"
          style={{
            width: VIEW,
            height: VIEW,
            cursor: "grab",
            // مربعات الشفافية تحت الصورة
            backgroundImage: "conic-gradient(#1c1c20 25%, #141417 0 50%, #1c1c20 0 75%, #141417 0)",
            backgroundSize: "18px 18px",
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.08 : 0.93)))}
        >
          <canvas ref={canvasRef} style={{ width: VIEW, height: VIEW }} aria-hidden />
          <span className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/20" />
          <span className="pointer-events-none absolute bottom-2 start-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-bold text-white/80">
            <Move size={12} /> {t("cropper.hint")}
          </span>
        </div>

        <label className="mt-4 flex items-center gap-3">
          <ZoomOut size={16} className="shrink-0 text-[#a1a1aa]" aria-hidden />
          <input
            type="range"
            min={0.4}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label={t("cropper.zoom")}
            className="h-11 w-full accent-[var(--color-lime)]"
          />
          <ZoomIn size={16} className="shrink-0 text-[#a1a1aa]" aria-hidden />
        </label>

        <p className="mt-2 text-[12.5px] font-bold text-[#a1a1aa]">{t("cropper.bg")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[...BGS.map((b) => b.key), "custom"].map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={bg === k}
              onClick={() => setBg(k)}
              className={`flex min-h-[40px] items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold ${bg === k ? "border-[var(--color-lime)] text-white" : "border-white/[0.08] text-[#a1a1aa]"}`}
            >
              <span
                aria-hidden
                className="h-4 w-4 rounded-full ring-1 ring-white/25"
                style={{
                  background:
                    k === "custom" ? custom : k === "white" ? "#fff" : k === "dark" ? "#141417" : "conic-gradient(#555 25%, #222 0 50%, #555 0 75%, #222 0)",
                }}
              />
              {t(`cropper.bg_${k}`)}
            </button>
          ))}
          {bg === "custom" && (
            <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label={t("cropper.bg_custom")} className="h-10 w-12 cursor-pointer rounded-lg border border-white/[0.1] bg-transparent" />
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={!img || busy}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          >
            <Check size={17} /> {t("cropper.apply")}
          </button>
          <button type="button" onClick={onCancel} className="min-h-[46px] rounded-xl border border-white/[0.08] px-4 text-[13.5px] font-bold text-[#c9c9cf] hover:bg-white/[0.05]">
            {t("cancel")}
          </button>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-[#6b7280]">{t("cropper.note")}</p>
      </motion.div>
    </div>,
    document.body
  );
}
