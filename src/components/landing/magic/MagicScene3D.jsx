import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { COUPON, TEX_W, TEX_H, drawFront, drawBack, ensureFonts, loadLogoBitmap } from "./couponFaces.js";
import { parseVal, withNum } from "../../../lib/values.js";

// ============================================================
//  مشهد الـ 3D للكوبون السحري (يُحمَّل بكسل فقط على الأجهزة القادرة).
//  Canvas واحد يغطّي الـ Hero: الكوبون الرئيسي في موضع "مسرح" DOM (store.anchor)
//  + كوبونات صغيرة تطفو بعمق (parallax) بألوان الأنواع الثلاثة + جزيئات ذهبية.
//  كل التفاعل (سحب/نقر/ميلان) يحدث في DOM ويُكتب في store؛ المشهد يقرأه فقط.
// ============================================================

const TYPE_COLORS = ["#a6f000", "#38bdf8", "#fbbf24"];
const EDGE_NORMAL = new THREE.Color("#8bd000");
const EDGE_GOLD = new THREE.Color("#cf9a1e");
// منظور مسطّح نسبياً: الكوبون على جانب الشاشة لا يتشوّه
const FOV = 22;
const CAM_Z = 16;

/** شكل التذكرة: زوايا دائرية + نصفا دائرة مقصوصان في الجنبين عند الخط المثقّب. */
function couponShape({ W, H, R, NOTCH, STUB }) {
  const s = new THREE.Shape();
  const x0 = -W / 2;
  const x1 = W / 2;
  const y0 = -H / 2;
  const y1 = H / 2;
  const yp = y0 + STUB;
  s.moveTo(x0 + R, y0);
  s.lineTo(x1 - R, y0);
  s.absarc(x1 - R, y0 + R, R, -Math.PI / 2, 0, false);
  s.lineTo(x1, yp - NOTCH);
  s.absarc(x1, yp, NOTCH, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(x1, y1 - R);
  s.absarc(x1 - R, y1 - R, R, 0, Math.PI / 2, false);
  s.lineTo(x0 + R, y1);
  s.absarc(x0 + R, y1 - R, R, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, yp + NOTCH);
  s.absarc(x0, yp, NOTCH, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(x0, y0 + R);
  s.absarc(x0 + R, y0 + R, R, Math.PI, Math.PI * 1.5, false);
  return s;
}

const DEPTH = 0.07;
const BEVEL_T = 0.022;
const FACE_Z = DEPTH / 2 + BEVEL_T + 0.002;

function buildCouponGeometry(curve = 28, bevel = true) {
  const shape = couponShape(COUPON);
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: bevel,
    bevelThickness: BEVEL_T,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: curve,
  });
  body.translate(0, 0, -DEPTH / 2);
  const face = new THREE.ShapeGeometry(shape, curve);
  const pos = face.attributes.position;
  const uv = face.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + COUPON.W / 2) / COUPON.W, (pos.getY(i) + COUPON.H / 2) / COUPON.H);
  }
  uv.needsUpdate = true;
  return { body, face };
}

/** إضاءة بيئية بلا ملفات خارجية (RoomEnvironment) — تعطي الذهب انعكاساً حقيقياً. */
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.9;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** حجم المنظور (وحدات العالم) عند عمق z. */
function viewAt(z, aspect) {
  const h = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAM_Z - z);
  return { h, w: h * aspect };
}

function MainCoupon({ store, faces, labels, lang, onReady }) {
  const group = useRef(null);
  const { gl } = useThree();
  if (!store.couponWorld) store.couponWorld = new THREE.Vector3();
  const geo = useMemo(() => buildCouponGeometry(), []);
  const canvases = useMemo(() => {
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = TEX_W;
      c.height = TEX_H;
      return c;
    };
    return { front: mk(), back: mk() };
  }, []);
  const tex = useMemo(() => {
    const mk = (c) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      return t;
    };
    return { front: mk(canvases.front), back: mk(canvases.back) };
  }, [canvases, gl]);
  const mats = useMemo(
    () => ({
      edge: new THREE.MeshStandardMaterial({ color: EDGE_NORMAL.clone(), metalness: 0.85, roughness: 0.32 }),
      // الوجه الداكن: انعكاس بيئي خفيف حتى يبقى أسود عميقاً لا رمادياً
      front: new THREE.MeshPhysicalMaterial({
        map: tex.front,
        roughness: 0.62,
        metalness: 0,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.25,
      }),
      back: new THREE.MeshPhysicalMaterial({ map: tex.back, roughness: 0.26, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.12 }),
    }),
    [tex]
  );

  const live = useRef({ parity: 0, counterStart: -1, lastDrawn: null, pendingReset: false, ready: false, frame: 0 });
  const normalParsed = useMemo(() => parseVal(faces.normal), [faces.normal]);
  const premiumParsed = useMemo(() => parseVal(faces.premium), [faces.premium]);

  // رسم الوجهين (بعد تحميل الخطوط + الشعار)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFonts(lang);
      const logo = await loadLogoBitmap(faces.logo);
      if (cancelled) return;
      drawFront(canvases.front.getContext("2d"), faces, { lang, labels, logo });
      drawBack(canvases.back.getContext("2d"), faces, { lang, labels, value: faces.normal });
      live.current.lastDrawn = faces.normal;
      tex.front.needsUpdate = true;
      tex.back.needsUpdate = true;
      live.current.ready = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [faces, labels, lang, canvases, tex]);

  useEffect(
    () => () => {
      geo.body.dispose();
      geo.face.dispose();
      tex.front.dispose();
      tex.back.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [geo, tex, mats]
  );

  useFrame((state, delta) => {
    const g = group.current;
    const L = live.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 30);
    L.frame += 1;
    if (L.frame % 12 === 1) store.measure?.();
    const a = store.anchor;
    if (!a.ready) {
      g.visible = false;
      return;
    }
    g.visible = L.ready;

    // موضع/مقاس الكوبون = موضع/مقاس "المسرح" في DOM
    const { width: cw, height: ch } = state.size;
    const view = viewAt(0, cw / ch);
    const unit = view.h / ch;
    const t = state.clock.elapsedTime;
    const bob = store.reduced ? 0 : Math.sin(t * 1.1) * 0.05;
    g.position.set((a.cx - cw / 2) * unit, (ch / 2 - a.cy) * unit + bob, 0);
    g.scale.setScalar((a.w * unit) / COUPON.W);

    // نابض حرج للانقلاب (يتبع السحب حيّاً) + ميلان ناعم نحو المؤشر/ميلان الهاتف
    const target = store.flipIndex * Math.PI + store.drag;
    const k = 70;
    const c = 13;
    store.vel += (k * (target - store.angle) - c * store.vel) * dt;
    store.angle += store.vel * dt;
    const e = 1 - Math.exp(-dt * 6);
    store.tilt.x += (store.tiltTarget.x - store.tilt.x) * e;
    store.tilt.y += (store.tiltTarget.y - store.tilt.y) * e;
    // تعويض المنظور: الكوبون يلتفت قليلاً نحو الكاميرا حسب موضعه الجانبي
    const face = -Math.atan2(g.position.x, CAM_Z) * 0.7;
    const faceX = Math.atan2(g.position.y, CAM_Z) * 0.7;
    g.rotation.set(store.tilt.x + faceX + (store.reduced ? 0 : Math.sin(t * 0.7) * 0.03), store.angle + store.tilt.y + face, 0);

    // لون الحافة يتبع الوجه الظاهر (أخضر ↔ ذهبي)
    const frontness = (Math.cos(store.angle) + 1) / 2;
    mats.edge.color.copy(EDGE_GOLD).lerp(EDGE_NORMAL, frontness);

    // تحوّل للوجه الذهبي → عدّاد + جزيئات
    const parity = ((store.flipIndex % 2) + 2) % 2;
    if (parity !== L.parity) {
      L.parity = parity;
      if (parity === 1) {
        L.counterStart = t + 0.22;
        L.pendingReset = false;
        store.burst += 1;
      } else {
        L.counterStart = -1;
        L.pendingReset = true;
      }
    }
    if (L.ready && L.counterStart >= 0 && normalParsed && premiumParsed) {
      const p = Math.min(Math.max((t - L.counterStart) / 0.9, 0), 1);
      const eased = 1 - Math.pow(1 - p, 4);
      const value = withNum(premiumParsed, normalParsed.num + (premiumParsed.num - normalParsed.num) * eased);
      if (value !== L.lastDrawn) {
        drawBack(canvases.back.getContext("2d"), faces, { lang, labels, value });
        tex.back.needsUpdate = true;
        L.lastDrawn = value;
      }
      if (p >= 1) L.counterStart = -1;
    } else if (L.ready && L.counterStart >= 0 && !normalParsed) {
      drawBack(canvases.back.getContext("2d"), faces, { lang, labels, value: faces.premium });
      tex.back.needsUpdate = true;
      L.lastDrawn = faces.premium;
      L.counterStart = -1;
    }
    // نعيد الوجه الذهبي للقيمة العادية بعد اختفائه، ليعدّ من جديد في المرّة القادمة
    if (L.pendingReset && frontness > 0.85) {
      drawBack(canvases.back.getContext("2d"), faces, { lang, labels, value: faces.normal });
      tex.back.needsUpdate = true;
      L.lastDrawn = faces.normal;
      L.pendingReset = false;
    }

    store.couponWorld.copy(g.position);
    store.couponScale = g.scale.x;

    if (L.ready && !L.announced) {
      L.announced = true;
      onReady?.();
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo.body} material={mats.edge} />
      <mesh geometry={geo.face} material={mats.front} position={[0, 0, FACE_Z]} />
      <mesh geometry={geo.face} material={mats.back} position={[0, 0, -FACE_Z]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

/**
 * كوبونات صغيرة تطفو في الخلفية بعمق حقيقي: الأقرب تتحرك أكثر مع المؤشر/الميلان/التمرير.
 * تبقى بعيدة عن عمود النص (جهة الكوبون + الحواف فقط) حتى لا تقلّل وضوح العنوان.
 * couponOnLeft: الكوبون يسار الشاشة (العربية RTL) · stacked: تخطيط الهاتف (النص فوق الكوبون).
 */
function FloatingCoupons({ store, count, couponOnLeft, stacked }) {
  const geo = useMemo(() => buildCouponGeometry(10, false).body, []);
  const mats = useMemo(
    () =>
      TYPE_COLORS.map(
        (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.12, metalness: 0.35, roughness: 0.45 })
      ),
    []
  );
  const items = useMemo(() => {
    // توزيع ثابت (بذرة) حتى لا تتغيّر المواقع بين التحميلات
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const place = () => {
      if (stacked) {
        // الهاتف: النص فوق والمقبض تحت → الكوبونات الطافية على الحافتين بجانب الكوبون فقط
        return { nx: (rnd() < 0.5 ? -1 : 1) * (0.74 + rnd() * 0.24), ny: -0.15 - rnd() * 0.6 };
      }
      const sign = couponOnLeft ? -1 : 1;
      if (rnd() < 0.75) return { nx: sign * (0.05 + rnd() * 0.92), ny: (rnd() * 2 - 1) * 0.92 };
      // جهة النص: الحافة السفلى فقط (بعيداً عن العنوان والشعار)
      return { nx: -sign * (0.1 + rnd() * 0.85), ny: -(0.78 + rnd() * 0.17) };
    };
    return Array.from({ length: count }, (_, i) => {
      const z = -5 - rnd() * 11;
      const { nx, ny } = place();
      return {
        nx,
        ny,
        z,
        s: 0.2 + rnd() * 0.18,
        color: i % 3,
        rx: rnd() * Math.PI,
        ry: rnd() * Math.PI,
        rz: rnd() * Math.PI,
        spinX: (rnd() - 0.5) * 0.25,
        spinY: (rnd() - 0.5) * 0.35,
        speed: 0.35 + rnd() * 0.5,
        phase: rnd() * Math.PI * 2,
        depth: 1 - (-z - 5) / 11, // 1 = قريب، 0 = بعيد
      };
    });
  }, [count, couponOnLeft, stacked]);
  const refs = useRef([]);

  useEffect(
    () => () => {
      geo.dispose();
      mats.forEach((m) => m.dispose());
    },
    [geo, mats]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const e = 1 - Math.exp(-dt * 3);
    store.parallax.x += (store.parallaxTarget.x - store.parallax.x) * e;
    store.parallax.y += (store.parallaxTarget.y - store.parallax.y) * e;
    const { width: cw, height: ch } = state.size;
    const aspect = cw / ch;
    const t = state.clock.elapsedTime;
    const still = store.reduced;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const m = refs.current[i];
      if (!m) continue;
      const v = viewAt(it.z, aspect);
      const unit = v.h / ch;
      const par = 0.25 + it.depth * 0.9;
      m.position.x = it.nx * (v.w / 2) + store.parallax.x * par;
      m.position.y =
        it.ny * (v.h / 2) +
        (still ? 0 : Math.sin(t * it.speed + it.phase) * 0.22) -
        store.parallax.y * par * 0.6 +
        store.scrollPx * unit * (0.55 - it.depth * 0.45);
      m.position.z = it.z;
      m.rotation.set(
        it.rx + (still ? 0 : t * it.spinX),
        it.ry + (still ? 0 : t * it.spinY),
        it.rz + (still ? 0 : Math.sin(t * 0.3 + it.phase) * 0.2)
      );
    }
  });

  return items.map((it, i) => (
    <mesh
      key={i}
      ref={(el) => (refs.current[i] = el)}
      geometry={geo}
      material={mats[it.color]}
      scale={it.s}
    />
  ));
}

/** جزيئات ذهبية خفيفة تنطلق من حواف الكوبون عند التحوّل إلى Premium. */
function GoldParticles({ store, count = 110 }) {
  const ref = useRef(null);
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const dot = document.createElement("canvas");
    dot.width = dot.height = 64;
    const g = dot.getContext("2d");
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.35, "rgba(255,255,255,0.65)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(dot);
    const material = new THREE.PointsMaterial({
      size: 0.11,
      map,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    return { positions, colors, vel, life, geometry, material, map };
  }, [count]);
  const lastBurst = useRef(0);
  const gold = useMemo(() => [new THREE.Color("#ffe486"), new THREE.Color("#f0c63c"), new THREE.Color("#cf9a1e")], []);

  useEffect(
    () => () => {
      data.geometry.dispose();
      data.material.dispose();
      data.map.dispose();
    },
    [data]
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { positions, colors, vel, life } = data;
    if (store.burst !== lastBurst.current && store.couponWorld) {
      lastBurst.current = store.burst;
      const s = store.couponScale || 1;
      const cx = store.couponWorld.x;
      const cy = store.couponWorld.y;
      const hw = (COUPON.W / 2) * s;
      const hh = (COUPON.H / 2) * s;
      for (let i = 0; i < count; i++) {
        // نقطة عشوائية على محيط الكوبون، وسرعة للخارج
        const side = Math.random();
        let x;
        let y;
        if (side < 0.5) {
          x = (Math.random() * 2 - 1) * hw;
          y = side < 0.25 ? hh : -hh;
        } else {
          x = side < 0.75 ? hw : -hw;
          y = (Math.random() * 2 - 1) * hh;
        }
        const len = Math.hypot(x, y) || 1;
        const sp = (0.6 + Math.random() * 1.4) * s;
        positions[i * 3] = cx + x;
        positions[i * 3 + 1] = cy + y;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        vel[i * 3] = (x / len) * sp;
        vel[i * 3 + 1] = (y / len) * sp + 0.35 * s;
        vel[i * 3 + 2] = (Math.random() - 0.2) * 0.8;
        life[i] = 0.7 + Math.random() * 0.7;
      }
    }
    let alive = false;
    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) {
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
        continue;
      }
      alive = true;
      life[i] -= dt;
      vel[i * 3 + 1] -= 0.9 * dt;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const k = Math.max(life[i], 0) / 1.4;
      const col = gold[i % 3];
      colors[i * 3] = col.r * k;
      colors[i * 3 + 1] = col.g * k;
      colors[i * 3 + 2] = col.b * k;
    }
    if (ref.current) ref.current.visible = alive;
    data.geometry.attributes.position.needsUpdate = true;
    data.geometry.attributes.color.needsUpdate = true;
  });

  return <points ref={ref} geometry={data.geometry} material={data.material} frustumCulled={false} visible={false} />;
}

export default function MagicScene3D({ store, faces, labels, lang, active, mobile, stacked, onReady }) {
  return (
    <Canvas
      flat
      dpr={mobile ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 60 }}
      frameloop={active ? "always" : "never"}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <fog attach="fog" args={["#0a0a0a", 19, 36]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 6]} intensity={1.25} />
      <directionalLight position={[-5, -2, -4]} intensity={0.6} color="#a6f000" />
      <Environment />
      <FloatingCoupons store={store} count={stacked ? 6 : 13} couponOnLeft={lang === "ar"} stacked={stacked} />
      <MainCoupon store={store} faces={faces} labels={labels} lang={lang} onReady={onReady} />
      <GoldParticles store={store} />
    </Canvas>
  );
}
