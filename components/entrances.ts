/**
 * entrances.ts — 同一张可爱风海报，两种入场（动效对照 r01）
 *
 *   A  bounceEntrance(t, layer)  萌豚入场：弹性足、过冲小、停得快；落地先压扁再拉长、弹两下停；元素错帧蹦出；
 *                                停住后保留小幅持续动作（气球飘、星星一缩一放、人物呼吸）。
 *   B  smoothEntrance(t, layer)  丝滑入场：品牌片 / UI 式。expo、quint 缓出，遮罩擦出，
 *                                小位移 + 不透明度 + 少量模糊，远近层位移不同（视差），零过冲。
 *
 * 约定
 *   - 时间单位：秒。画布 1920×1080。60fps 下逐帧调用：t = frame / fps。
 *   - 纯函数，没有任何 import，Remotion、浏览器、Node 都能直接跑。
 *   - A、B 共用同一张出场时刻表 CUE：同样的顺序、同样的开始时刻，观众看到的差别只来自"怎么动"。
 *   - 返回值是相对静止状态的增量：
 *       x / y        位移（px）
 *       scaleX/Y     缩放倍数（以 origin 为锚点）
 *       rotate       在元素自带角度之上再转多少（度）
 *       opacity      0–1
 *       blur         高斯模糊半径（px）
 *       clipInset    [上, 右, 下, 左] 裁切，占元素包围盒的比例（0 = 不裁，1 = 整个裁掉）
 *     另外多给两个字段：origin 锚点（画布 px，即 transform-origin）；clipCircle 圆形遮罩（A 的底色扩散用）。
 *   - 不闪帧：不做文字频闪、不抽帧。元素出现靠缩放、位移、遮罩或 ≥3 帧的淡入。
 *   - 用 toStyle(m, layer) 把返回值换成 CSS（transform 顺序：先缩放、再旋转、再位移，都绕 origin）。
 *
 * 出处（A 的参数依据，原文在 C-MidwayMaterials/调研/萌豚经验_原始/）
 *   - 《关于弹与思路》cv16057802：过冲"不需要太强……但不能没有"；"确保有足够的弹性"；"阻力（衰变）可以设置一个较大的值"；
 *     锚点"放置立绘中下位置，不是居中"；"竖扁到横扁，往复2个循环"；30 帧下 10–14 帧弹完（60 帧约 0.33–0.47 秒）。
 *   - 《萌豚系自笔其五》cv9624434："萌豚的动画演出，三个特点：滑，跳，皮"；"弹性k数五帧起"。
 *   - 2024 分享课 share2024.txt [0:28]–[0:29]："弹这个元素还有夸张形变这个元素，这两点是必不可少的"，像 QQ 糖"打一下就弹一下"；
 *     [1:18]"叠两层错帧，错帧就会有这种复合运动"；[2:49]"画面必须要有一个东西在动"。
 *   - 《萌豚系自笔其二》cv7501173：圆圈加扩散（扩张的圆 + 修剪路径的线）"常用于碰撞后或者某物突然出现的时候"；自带弹性的方块名牌。
 */

export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const DURATION = 3.0; // 两份都按 3 秒出片（最后约 0.4 秒是停住后的持续动作 / 慢推）

const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** 0→1 的平滑过渡（用于持续动作的渐入，避免突然开始） */
const ramp = (a: number, b: number, t: number) => {
  const u = clamp((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};

// ───────────────────────────── 类型 ─────────────────────────────

export type Role =
  | "iris" // A 专用：底色前面先扩散的两层彩色圆（错帧叠层）；B 里不显示
  | "bg" // 底色
  | "pattern" // 底纹（i=0 底纹图案，i=1 斜光带之类的第二层）
  | "cloud" // 装饰：云
  | "balloon" // 装饰：气球
  | "card" // 装饰：拍立得 / 卡片（锚点在顶部胶带）
  | "star" // 装饰：星星 / 闪光
  | "char" // 人物
  | "title" // 主标题字（整块 n=1；拆字时 i=0..n-1）
  | "label" // 副标签（对话气泡、副标题行）
  | "sticker"; // 贴纸（角标、签名、小心心）

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layer {
  role: Role;
  /** 静止时元素在画布里的包围盒（px）。底色 / 底纹传整张画布 {0,0,1920,1080}。 */
  box: Box;
  /** 同组序号（按出场顺序 0 起），决定错帧。装饰建议按"先左后右"编号。 */
  i?: number;
  /** 同组总数（标题拆字时传字数） */
  n?: number;
  /** 在时刻表基础上再推迟（秒，可负）。拆出来的描边 / 投影层传 +0.05 就是"错帧叠层"。 */
  delay?: number;
  /** 覆盖默认锚点（占 box 的比例 [横, 竖]） */
  anchor?: [number, number];
  /** 底纹能平铺时为 true：A 才做斜向滚动（x/y 会一直增大，用在 background-position 上并对图案周期取模） */
  tile?: boolean;
}

export interface Motion {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
  opacity: number;
  blur: number;
  clipInset: [number, number, number, number];
  /** 锚点（画布 px） */
  origin: [number, number];
  /** 圆形遮罩（画布 px）；null = 不用 */
  clipCircle: { cx: number; cy: number; r: number } | null;
}

export interface Opt {
  /** A：停住后的持续小动作（默认 true）。验收"停住时是否回到原图"时传 false。 */
  idle?: boolean;
}

// ───────────────────────────── 时刻表（A、B 共用） ─────────────────────────────

/** at = 这一组第一个元素开始的时刻（秒）；step = 组内错帧间隔（秒）。 */
export const CUE: Record<Role, { at: number; step: number }> = {
  iris: { at: 0.0, step: 0.07 }, // A：粉圆 0.00、白圆 0.07、底色 0.14
  bg: { at: 0.0, step: 0 },
  pattern: { at: 0.2, step: 0.06 },
  cloud: { at: 0.3, step: 0.06 },
  balloon: { at: 0.4, step: 0.06 },
  card: { at: 0.5, step: 0.1 },
  char: { at: 0.74, step: 0 }, // A：0.74 起跳，1.20 落地
  title: { at: 1.48, step: 0.06 }, // A：1.60 弹到位（圆圈扩散在这一刻）
  star: { at: 1.62, step: 0.05 },
  label: { at: 1.67, step: 0.12 }, // A：气泡 1.80 弹到位
  sticker: { at: 1.9, step: 0.08 }, // A：2.00 起逐个"啪"地贴上
};

export const startAt = (layer: Layer, style: "A" | "B") => {
  const c = CUE[layer.role];
  const base = style === "A" && layer.role === "bg" ? CUE.iris.at + 2 * CUE.iris.step : c.at; // A 的底色是第三层圆
  return base + (layer.i ?? 0) * c.step + (layer.delay ?? 0);
};

// ───────────────────────────── 锚点 ─────────────────────────────

/** A 的锚点（占 box 比例）。人物 / 标题放"中下"，卡片放顶部胶带，气球放绳子末端，气泡放尾巴。 */
export const ANCHOR_A: Record<Role, [number, number]> = {
  iris: [0.5, 0.5],
  bg: [0.5, 0.5],
  pattern: [0.5, 0.5],
  cloud: [0.5, 1.0],
  balloon: [0.5, 1.0],
  card: [0.5, 0.0],
  star: [0.5, 0.5],
  char: [0.5, 0.92],
  title: [0.5, 0.88],
  label: [0.15, 1.0],
  sticker: [0.5, 0.5],
};
/** B 的锚点。B 几乎不缩放，锚点只影响底纹 / 卡片 / 人物那一点点"落定"缩放。 */
export const ANCHOR_B: Record<Role, [number, number]> = {
  iris: [0.5, 0.5],
  bg: [0.5, 0.5],
  pattern: [0.5, 0.5],
  cloud: [0.5, 0.5],
  balloon: [0.5, 0.5],
  card: [0.5, 0.5],
  star: [0.5, 0.5],
  char: [0.5, 1.0],
  title: [0.5, 1.0],
  label: [0.0, 0.5],
  sticker: [0.5, 0.5],
};

const rest = (layer: Layer, a: [number, number]): Motion => {
  const [fx, fy] = layer.anchor ?? a;
  const b = layer.box;
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
    opacity: 1,
    blur: 0,
    clipInset: [0, 0, 0, 0],
    origin: [b.x + fx * b.w, b.y + fy * b.h],
    clipCircle: null,
  };
};

// ───────────────────────────── 缓动 ─────────────────────────────

/** cubic-bezier：与 CSS cubic-bezier()、Remotion Easing.bezier 同一定义（实测与 Remotion 逐点相差 < 5e-7） */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let k = 0; k < 8; k++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-7) break;
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    if (!(u >= 0 && u <= 1) || Math.abs(sx(u) - x) > 1e-5) {
      let lo = 0, hi = 1;
      u = x;
      for (let k = 0; k < 50; k++) {
        const v = sx(u);
        if (Math.abs(v - x) < 1e-7) break;
        if (v < x) lo = u;
        else hi = u;
        u = (lo + hi) / 2;
      }
    }
    return sy(u);
  };
}

/** B 用的两条曲线 */
export const EASE_B = {
  /** 位移、缩放、遮罩：cubic-bezier(0.16, 1, 0.3, 1)，即 easeOutExpo */
  expoOut: bezier(0.16, 1, 0.3, 1),
  /** 不透明度、模糊：cubic-bezier(0.22, 1, 0.36, 1)，即 easeOutQuint */
  quintOut: bezier(0.22, 1, 0.36, 1),
};
/** A 的底色圆扩散：cubic-bezier(0.25, 1, 0.5, 1)，即 easeOutQuart */
const quartOut = bezier(0.25, 1, 0.5, 1);
const cubicOut = (u: number) => 1 - Math.pow(1 - clamp(u), 3);

// ───────────────────────────── A 的三件工具 ─────────────────────────────

/** 到位曲线 f(u)（u∈[0,1]，f(0)=0，f(1)=1）及其终点斜率 slope = f'(1) */
export type Arrive = { f: (u: number) => number; slope: number };
/** 缓出与匀速的混合：beta 越大，到位时越"冲"（余震越大） */
export const outMix = (beta: number): Arrive => ({ f: (u) => u * (2 - u) * (1 - beta) + beta * u, slope: beta });
/** 越走越快（落下、拍上去）：u^n，终点斜率 n */
export const inPow = (n: number): Arrive => ({ f: (u) => Math.pow(u, n), slope: n });

/**
 * 弹：先用 T 秒到位，到位后叠一段衰减正弦（余震）。返回进度，静止为 1。
 *   余震 = k · v / ω · e^(−d·s) · sin(ω·s)，v = 到位速度，ω = 2πf，s = 到位后经过的秒数。
 *   k = 1 时位置、速度都连续（"弹出来"）；k < 1 表示碰撞吃掉一部分速度（"砸上去"）；k = 0 不过冲。
 * 这和 AE 的 Elastic / Excite（振幅 × 到位速度、频率、衰减）是同一个思路：过冲可以小，第二下照样看得见。
 * 纯弹簧做不到——弹簧过冲调小时，第二下会按同一比例一起变小，几乎看不见。
 */
export function bouncy(tau: number, T: number, arrive: Arrive, f: number, d: number, k = 1): number {
  if (tau <= 0) return 0;
  if (tau < T) return arrive.f(tau / T);
  const s = tau - T;
  const w = TAU * f;
  const v = (arrive.slope / T) * k;
  return 1 + (v / w) * Math.exp(-d * s) * Math.sin(w * s);
}
/** 果冻形变：J·e^(−d·s)·sin(2πf·s)。sy = 1 + jelly 为正时"瘦高"、为负时"矮胖"。从 0 起步，不跳帧。 */
export const jelly = (s: number, J: number, f: number, d: number) =>
  s <= 0 ? 0 : J * Math.exp(-d * s) * Math.sin(TAU * f * s);
/** 摆：从角度 R 开始来回摆、逐次变小（卡片贴上墙后晃两下） */
export const swing = (s: number, R: number, f: number, d: number) =>
  s <= 0 ? R : R * Math.exp(-d * s) * Math.cos(TAU * f * s);
/** 形变时保持体积：sx = sy^(−vol)。vol=1 面积守恒（软的小东西），0.5 稳一点（人物） */
const keepVolume = (sy: number, vol: number) => Math.pow(Math.max(0.2, sy), -vol);

// ───────────────────────────── A 的参数表（规格.md 里的数字都出自这里） ─────────────────────────────
// T 到位用时；beta 到位冲劲；f/d 余震频率(Hz)/衰减(1/秒)；J/Jf/Jd 果冻形变振幅/频率/衰减；k 碰撞保留的速度比例

export const PA = {
  iris: { dur: 0.42 },
  pattern: { fade: 0.2, from: 1.12, dur: 0.5, scroll: [28, -28] as [number, number] },
  cloud: { T: 0.16, beta: 0.6, J: 0.14, Jf: 4.0, Jd: 8.0, vol: 1 },
  balloon: { T: 0.14, beta: 0.55, f: 4.2, d: 8.5, J: 0.16, Jf: 4.2, Jd: 7.5, vol: 1, sway: 7, swayF: 1.4, swayD: 4.0 },
  card: { T: 0.14, dy: -150, from: 1.12, f: 5.0, d: 10, k: 0.15, R: 9, swingF: 2.4, swingD: 5.5, fade: 0.05 },
  char: { T1: 0.34, T2: 0.12, apex: 0.045, lift: 0.1, fall: 0.05, J: 0.15, Jf: 4.0, Jd: 7.0, vol: 0.5, lean: 2.5, wob: 1.2 },
  title: { T: 0.12, beta: 0.5, f: 4.5, d: 9.0, J: 0.18, Jf: 4.5, Jd: 7.0, vol: 0.6, R: -5, Rsplit: 7 },
  star: { T: 0.1, beta: 0.7, f: 5.0, d: 10, R: -150 },
  label: { T: 0.13, beta: 0.55, f: 4.2, d: 8.5, J: 0.18, Jf: 4.2, Jd: 7.5, vol: 0.8, dx: 70, R: -16 },
  sticker: { T: 0.1, from: 1.45, f: 5.5, d: 11, k: 0.1, J: -0.1, Jf: 5.5, Jd: 10, vol: 1, R: 14, fade: 0.05 },
} as const;

/** A 停住后的持续动作（渐入 0.5 秒，周期运动，不闪） */
export const IDLE_A = {
  balloon: { dy: 6, f: 0.5, rot: 2 },
  star: { amp: 0.1, f: 1.3, rot: 8, rotF: 0.6 },
  label: { rot: 1.6, f: 0.7 },
  char: { amp: 0.01, f: 0.8 },
  title: { amp: 0.012, f: 0.8 },
  cloud: { dx: 5, f: 0.25 },
} as const;

/** A 的底色圆：从锚点（默认画面中心）扩到盖满四角 */
const irisCircle = (t: number, at: number, cx = W / 2, cy = H / 2) => {
  const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.02;
  const u = (t - at) / PA.iris.dur;
  if (u >= 1) return null;
  return { cx, cy, r: R * quartOut(clamp(u)) };
};

/**
 * A：萌豚入场
 * @param t 秒（整段从 0 开始）。开始之前返回"起始姿态 + 不透明度 0"。
 *
 * 两类"弹"：
 *   弹出型（标题、气泡、气球、星星）：从 0 长到 1，果冻形变从第一帧就开始 → 长的时候瘦高、过冲时矮胖、再瘦高、再矮胖，停。
 *   砸落型（人物、云、卡片、贴纸）：先走到位，碰上那一刻才开始形变 → 落地先压扁、再拉长，衰减两轮。
 */
export function bounceEntrance(t: number, layer: Layer, opt: Opt = {}): Motion {
  const idle = opt.idle ?? true;
  const m = rest(layer, ANCHOR_A[layer.role]);
  const at = startAt(layer, "A");
  const started = t > at;
  const tau = Math.max(0, t - at);
  const i = layer.i ?? 0;
  const side = i % 2 === 0 ? 1 : -1; // 同组相邻元素左右交替，避免整齐划一
  const b = layer.box;

  switch (layer.role) {
    case "iris":
    case "bg": {
      // 圆形蒙版扩散：粉圆 → 白圆 → 底色，每层错开 0.07 秒，扩张时露出两道彩色圆环（错帧叠层）
      const [fx, fy] = layer.anchor ?? ANCHOR_A[layer.role];
      m.clipCircle = irisCircle(at + tau, at, b.x + fx * b.w, b.y + fy * b.h);
      break;
    }
    case "pattern": {
      // 底纹跟着底色的圆一起露出：0.2 秒淡入 + 从 1.12 缩回 1（不过冲，免得露边）；能平铺就一直斜向滚动
      const p = PA.pattern;
      const bgAt = startAt({ role: "bg", box: b }, "A");
      m.clipCircle = irisCircle(Math.max(t, bgAt), bgAt);
      m.opacity = cubicOut(tau / p.fade);
      m.scaleX = m.scaleY = lerp(p.from, 1, cubicOut(tau / p.dur));
      if (layer.tile && idle) { m.x = p.scroll[0] * tau; m.y = p.scroll[1] * tau; }
      break;
    }
    case "cloud": {
      // 从画面下沿冒出来，冲劲转成"先拉高、再压扁"的果冻形变；锚点在底边，底边始终贴着画面下沿
      const p = PA.cloud;
      const D = H - b.y + 12;
      m.y = D * (1 - (tau < p.T ? outMix(p.beta).f(tau / p.T) : 1)); // 到位不过冲（过冲会让底边离开画面下沿）
      const j = jelly(tau - p.T, p.J, p.Jf, p.Jd);
      m.scaleY = 1 + j;
      m.scaleX = keepVolume(1 + j, p.vol);
      if (idle) m.x += IDLE_A.cloud.dx * Math.sin(TAU * IDLE_A.cloud.f * t + i * 1.9) * ramp(at + 0.6, at + 1.1, t);
      break;
    }
    case "balloon": {
      // 像吹气球：从绳子末端鼓出来，鼓过头再缩回，瘦高 ↔ 矮胖来回两轮；到位后左右晃，停住后上下飘
      const p = PA.balloon;
      const P = bouncy(tau, p.T, outMix(p.beta), p.f, p.d);
      const j = jelly(tau, p.J, p.Jf, p.Jd);
      m.scaleY = P * (1 + j);
      m.scaleX = P * keepVolume(1 + j, p.vol);
      const s = Math.max(0, tau - p.T);
      m.rotate = side * p.sway * Math.exp(-p.swayD * s) * Math.sin(TAU * p.swayF * s);
      if (idle) {
        const r = ramp(at + 0.55, at + 1.05, t);
        const ph = TAU * IDLE_A.balloon.f * t + i * 1.3;
        m.y += IDLE_A.balloon.dy * Math.sin(ph) * r;
        m.rotate += IDLE_A.balloon.rot * Math.sin(ph + 0.9) * r;
      }
      break;
    }
    case "card": {
      // 从上方（离镜头近一点）落下来，"啪"地贴上：越落越快，贴上时轻轻压一下，再绕顶部胶带晃两下停
      const p = PA.card;
      const u = clamp(tau / p.T);
      m.y = p.dy * (1 - u * u * u);
      const P = bouncy(tau, p.T, inPow(3), p.f, p.d, p.k);
      m.scaleX = m.scaleY = lerp(p.from, 1, P);
      m.opacity = clamp(tau / p.fade);
      m.rotate = swing(tau - p.T, side * p.R, p.swingF, p.swingD);
      break;
    }
    case "char": {
      // 从画面下面跳上来：越升越慢 → 顶点 → 越落越快 → 落地压扁 → 拉长 → 再压一点 → 停；锚点在人物中下
      const p = PA.char;
      const D = H - b.y + 24; // 起点：整个人藏在画面下沿以下
      const apex = p.apex * b.h; // 越过静止位置的高度
      let sy = 1;
      if (tau < p.T1) {
        const u = tau / p.T1;
        m.y = lerp(D, -apex, 1 - (1 - u) * (1 - u)); // quad-out：像被抛起来
        sy = 1 + p.lift * (1 - u) * (1 - u); // 起跳时拉长，到顶点恢复
        m.rotate = p.lean * (1 - u) * (1 - u);
      } else if (tau < p.T1 + p.T2) {
        const u = (tau - p.T1) / p.T2;
        m.y = lerp(-apex, 0, u * u); // quad-in：越落越快
        sy = 1 + p.fall * u * u; // 下落时拉长
      } else {
        const s = tau - p.T1 - p.T2; // 落地后
        sy = 1 + p.fall * clamp(1 - s / 0.05) - jelly(s, p.J, p.Jf, p.Jd); // 先压扁（矮胖），再拉长，衰减两轮
        m.rotate = -p.wob * Math.exp(-6 * s) * Math.sin(TAU * 2.5 * s);
        if (idle) sy *= 1 + IDLE_A.char.amp * Math.sin(TAU * IDLE_A.char.f * s) * ramp(0.5, 1.0, s); // 呼吸
      }
      m.scaleY = sy;
      m.scaleX = keepVolume(sy, p.vol);
      break;
    }
    case "title": {
      // 从字脚弹出来：长的时候瘦高，过冲约 9% 时矮胖，再瘦高、再矮胖，0.53 秒停；拆字时每个字左右交替带一点歪头
      const p = PA.title;
      const P = bouncy(tau, p.T, outMix(p.beta), p.f, p.d);
      const j = jelly(tau, p.J, p.Jf, p.Jd);
      m.scaleY = P * (1 + j);
      m.scaleX = P * keepVolume(1 + j, p.vol);
      m.rotate = ((layer.n ?? 1) > 1 ? side * p.Rsplit : p.R) * (1 - P);
      if (idle) {
        const r = ramp(at + 0.6, at + 1.1, t);
        const k = 1 + IDLE_A.title.amp * Math.sin(TAU * IDLE_A.title.f * tau + i * 0.7) * r;
        m.scaleX *= k;
        m.scaleY *= k;
      }
      break;
    }
    case "star": {
      // 转着蹦出来，转过头一点再回正；停住后一缩一放、轻轻摆（不改透明度）
      const p = PA.star;
      const P = bouncy(tau, p.T, outMix(p.beta), p.f, p.d);
      m.scaleX = m.scaleY = P;
      m.rotate = p.R * (1 - P);
      if (idle) {
        const r = ramp(at + 0.45, at + 0.95, t);
        const k = 1 + IDLE_A.star.amp * Math.sin(TAU * IDLE_A.star.f * t + i * 1.7) * r;
        m.scaleX *= k;
        m.scaleY *= k;
        m.rotate += IDLE_A.star.rot * Math.sin(TAU * IDLE_A.star.rotF * t + i) * r;
      }
      break;
    }
    case "label": {
      // 弹性名牌：从右边滑进来的同时从尾巴处弹出、带一点翻滚，停住后轻轻摇
      const p = PA.label;
      const P = bouncy(tau, p.T, outMix(p.beta), p.f, p.d);
      const j = jelly(tau, p.J, p.Jf, p.Jd);
      m.x = p.dx * (1 - P);
      m.scaleY = P * (1 + j);
      m.scaleX = P * keepVolume(1 + j, p.vol);
      m.rotate = p.R * (1 - P);
      if (idle) m.rotate += IDLE_A.label.rot * Math.sin(TAU * IDLE_A.label.f * tau + i) * ramp(at + 0.55, at + 1.05, t);
      break;
    }
    case "sticker": {
      // "啪"地拍上去：从 1.45 倍越缩越快地落到纸面，碰上时先压扁、轻轻陷进去一点，再回正
      const p = PA.sticker;
      const P = bouncy(tau, p.T, inPow(3), p.f, p.d, p.k);
      const j = jelly(tau - p.T, p.J, p.Jf, p.Jd);
      const sc = lerp(p.from, 1, P);
      m.scaleY = sc * (1 + j);
      m.scaleX = sc * keepVolume(1 + j, p.vol);
      m.rotate = side * p.R * (1 - P);
      m.opacity = clamp(tau / p.fade);
      break;
    }
  }
  if (!started) m.opacity = 0;
  return m;
}

/**
 * A 的点缀："圆圈加扩散"（扩张的圆环 + 8 条修剪路径的放射短线）。只在标题弹到位那一刻用一次。
 * 返回 null 表示不画。线宽收到 0、短线修剪到 0 自然消失，不做透明度闪烁。
 * at：碰撞时刻（标题 = startAt(title) + PA.title.T）；R：最大半径（px，默认 240）
 */
export function impactRing(t: number, at: number, R = 240) {
  const u = (t - at) / 0.42;
  if (u <= 0 || u >= 1) return null;
  const e = cubicOut(u);
  const lineOuter = R * (0.55 + 0.75 * cubicOut(u / 0.8));
  const lineInner = R * (0.5 + 0.8 * cubicOut((u - 0.12) / 0.88));
  return { r: R * (0.25 + 0.75 * e), stroke: 18 * (1 - e), lineInner: Math.min(lineInner, lineOuter), lineOuter, lines: 8 };
}

// ───────────────────────────── B 的参数表 ─────────────────────────────
// dy/dx 位移（px，正 = 从下 / 右边来）；dur 位移用时（expoOut）；fade 淡入用时（quintOut）；blur/blurDur 起始模糊与清晰用时
// 视差：按叠放深度，越靠前走得越多——底纹只推 8%，云 50、气球 60、卡片 70、人物 110；标签 30、贴纸 16 是"贴在玻璃上"的 UI 层，走得最少

export const PB = {
  bg: { fade: 0.6, from: 1.04, dur: 1.6 },
  pattern: { fade: 0.9, from: 1.08, dur: 1.8 },
  cloud: { dy: 50, dur: 1.1, fade: 0.5, blur: 6, blurDur: 0.6 },
  balloon: { dy: 60, dur: 1.2, fade: 0.5, blur: 8, blurDur: 0.7 },
  card: { dy: 70, dur: 1.1, from: 1.04, wipe: 0.9, fade: 0.3, blur: 4, blurDur: 0.5 },
  char: { dy: 110, dur: 1.3, from: 1.03, fade: 0.6, blur: 12, blurDur: 0.8 },
  title: { dur: 1.0 },
  star: { from: 0.6, dur: 0.9, R: -45, rotDur: 1.2, fade: 0.5 },
  label: { dx: -30, dur: 0.9, wipe: 0.7, fade: 0.3 },
  sticker: { dy: 16, dur: 0.7, fade: 0.5, blur: 4, blurDur: 0.5 },
} as const;

/**
 * B：丝滑入场
 * @param t 秒（整段从 0 开始）
 */
export function smoothEntrance(t: number, layer: Layer, _opt: Opt = {}): Motion {
  const m = rest(layer, ANCHOR_B[layer.role]);
  const tau = t - startAt(layer, "B");
  const E = (dur: number) => EASE_B.expoOut(clamp(tau / dur));
  const Q = (dur: number) => EASE_B.quintOut(clamp(tau / dur));
  const scale = (v: number) => { m.scaleX = v; m.scaleY = v; };

  switch (layer.role) {
    case "iris":
      m.opacity = 0; // B 不用
      break;
    case "bg": {
      const p = PB.bg; // 淡入，同时从 1.04 慢慢落定到 1（有渐变 / 纹理的底色才看得出）
      m.opacity = Q(p.fade);
      scale(lerp(p.from, 1, E(p.dur)));
      break;
    }
    case "pattern": {
      const p = PB.pattern; // 慢淡入 + 从 1.08 推到 1：远景比前景"走得少"，视差靠这一层撑
      m.opacity = Q(p.fade);
      scale(lerp(p.from, 1, E(p.dur)));
      break;
    }
    case "cloud":
    case "balloon": {
      const p = layer.role === "cloud" ? PB.cloud : PB.balloon; // 从下面浮上来，一路减速；先糊后清
      m.y = lerp(p.dy, 0, E(p.dur));
      m.opacity = Q(p.fade);
      m.blur = lerp(p.blur, 0, Q(p.blurDur));
      break;
    }
    case "card": {
      const p = PB.card; // 遮罩从上往下擦开，同时上移 70px + 从 1.04 落定；角度不动
      m.y = lerp(p.dy, 0, E(p.dur));
      scale(lerp(p.from, 1, E(p.dur)));
      m.clipInset = [0, 0, 1 - E(p.wipe), 0];
      m.opacity = Q(p.fade);
      m.blur = lerp(p.blur, 0, Q(p.blurDur));
      break;
    }
    case "char": {
      const p = PB.char; // 位移最大的一层（离镜头最近）：上移 + 淡入 + 由糊到清 + 1.03 落定
      m.y = lerp(p.dy, 0, E(p.dur));
      scale(lerp(p.from, 1, E(p.dur)));
      m.opacity = Q(p.fade);
      m.blur = lerp(p.blur, 0, Q(p.blurDur));
      break;
    }
    case "title": {
      // 遮罩擦出：字从自己的字脚线下面升上来，字脚线以下始终裁掉（裁切量 = 位移 / 字高，所以遮罩在画面里不动）
      const p = PB.title;
      const e = E(p.dur);
      m.y = layer.box.h * (1 - e);
      m.clipInset = [0, 0, 1 - e, 0];
      break;
    }
    case "star": {
      const p = PB.star; // 淡入 + 从 0.6 放大到 1 + 转 45° 回正，全程只减速不回弹
      m.opacity = Q(p.fade);
      scale(lerp(p.from, 1, E(p.dur)));
      m.rotate = lerp(p.R, 0, E(p.rotDur));
      break;
    }
    case "label": {
      const p = PB.label; // 遮罩从左往右擦开 + 从左边滑 30px
      m.x = lerp(p.dx, 0, E(p.dur));
      m.clipInset = [0, 1 - E(p.wipe), 0, 0];
      m.opacity = Q(p.fade);
      break;
    }
    case "sticker": {
      const p = PB.sticker; // 最后、最轻：上移 16px + 淡入 + 去模糊
      m.y = lerp(p.dy, 0, E(p.dur));
      m.opacity = Q(p.fade);
      m.blur = lerp(p.blur, 0, Q(p.blurDur));
      break;
    }
  }
  return m;
}

/** B 可选：整张海报慢推（包在所有层外面，锚点画面中心）。停住以后画面仍在"走"，但不弹。 */
export const cameraPush = (t: number, amount = 0.015) => 1 + amount * clamp(t / DURATION);

// ───────────────────────────── 换成 CSS ─────────────────────────────

/** toStyle 的返回值：可直接展开进 React / Remotion 的 style */
export interface Css {
  transformOrigin: string;
  transform: string;
  opacity: number;
  filter?: string;
  clipPath?: string;
}
/**
 * mode = "frame"：元素是整张 1920×1080 的图层（透明 PNG），left/top = 0；
 * mode = "box"  ：元素按 box 摆放（left = box.x, top = box.y, 宽高 = box.w/h）。
 */
export function toStyle(m: Motion, layer: Layer, mode: "frame" | "box" = "frame"): Css {
  const b = layer.box;
  const ox = mode === "frame" ? 0 : b.x;
  const oy = mode === "frame" ? 0 : b.y;
  const css: Css = {
    transformOrigin: `${(m.origin[0] - ox).toFixed(2)}px ${(m.origin[1] - oy).toFixed(2)}px`,
    transform: `translate(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px) rotate(${m.rotate.toFixed(3)}deg) scale(${m.scaleX.toFixed(4)}, ${m.scaleY.toFixed(4)})`,
    opacity: Number(m.opacity.toFixed(4)),
  };
  if (m.blur > 0.05) css.filter = `blur(${m.blur.toFixed(2)}px)`;
  const [ct, cr, cb, cl] = m.clipInset;
  if (m.clipCircle) {
    const c = m.clipCircle;
    css.clipPath = `circle(${c.r.toFixed(2)}px at ${(c.cx - ox).toFixed(2)}px ${(c.cy - oy).toFixed(2)}px)`;
  } else if (ct > 0 || cr > 0 || cb > 0 || cl > 0) {
    css.clipPath =
      mode === "frame"
        ? `inset(${(b.y + ct * b.h).toFixed(2)}px ${(W - b.x - b.w + cr * b.w).toFixed(2)}px ${(H - b.y - b.h + cb * b.h).toFixed(2)}px ${(b.x + cl * b.w).toFixed(2)}px)`
        : `inset(${(ct * b.h).toFixed(2)}px ${(cr * b.w).toFixed(2)}px ${(cb * b.h).toFixed(2)}px ${(cl * b.w).toFixed(2)}px)`;
  }
  return css;
}
