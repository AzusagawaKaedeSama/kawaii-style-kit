// 弹性预设（成片里所有「弹」都来自这几个函数）。t 一律用秒，60fps。
import { spring, Easing } from "remotion";
export const FPS = 60;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);   // 强缓出：快进慢停（出场、滑入）
export const easeIO = Easing.bezier(0.65, 0, 0.35, 1); // 进出都缓（擦除、推镜、合并）
export const easeIn = Easing.bezier(0.55, 0, 0.9, 0.45); // 离场加速

// 弹簧：start 秒起，0 → 1，带一点过冲
export const SPRING = {
  pop: { damping: 9, stiffness: 200, mass: 0.9 },    // 贴纸 / 胶囊弹出：过冲明显
  soft: { damping: 11, stiffness: 160, mass: 0.9 },  // 默认
  peek: { damping: 9, stiffness: 150, mass: 0.8 },   // 立绘探头：升得快、过冲一次再回
  stiff: { damping: 22, stiffness: 160, mass: 0.9 }, // 「不弹」对照：几乎无过冲
  card: { damping: 15, stiffness: 120, mass: 0.9 },  // 大卡片移动 / 分裂 / 合并
};
export const sp = (t: number, start: number, cfg: Partial<typeof SPRING.soft> = SPRING.soft) =>
  t < start ? 0 : spring({ frame: (t - start) * FPS, fps: FPS, config: { ...SPRING.soft, ...cfg } });

// 压扁—拉长：冲击后的衰减振荡，体积近似守恒（sx = 1/√sy）。dt = 距冲击的秒数
// amp 振幅、freq 每秒往复次数、decay 衰减速度。常用：贴纸 (0.2, 3, 6)；章节胶囊 (0.18, 3, 6)；大卡片果冻 (0.06, 2.2, 3.4)
export const squash = (dt: number, amp = 0.24, freq = 3.0, decay = 5.2) => {
  if (dt < 0) return { sx: 1, sy: 1 };
  const k = amp * Math.exp(-decay * dt) * Math.cos(2 * Math.PI * freq * dt);
  const sy = 1 - k;
  return { sx: 1 / Math.sqrt(Math.max(0.3, sy)), sy };
};

// 关键帧：[秒, 值, 该段缓动?]
export const kf = (t: number, keys: [number, number, ((x: number) => number)?][]) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i]; const [b, vb, e] = keys[i + 1];
    if (t < b) return lerp(va, vb, (e || easeIO)(clamp((t - a) / (b - a))));
  }
  return keys[keys.length - 1][1];
};

// 标题落地示范（片中「会弹」那段的右边）：t0 = 开始下落的秒
// 下落 0.5s（重力加速、边落边拉长）→ 落地压扁 → 憋住 → 拉长起跳 → 两次小弹 → 停
export const titleDrop = (t: number, t0: number, height = 1150) => {
  const L = t0 + 0.5;
  if (t < L) { const p = clamp((t - t0) / 0.5); const sy = 1 + 0.16 * p; return { dy: -height + height * p * p, sy, sx: Math.pow(sy, -0.6) }; }
  const outQ = Easing.out(Easing.quad), inQ = Easing.in(Easing.quad);
  const sy = kf(t, [[L, 1.16], [L + 0.12, 0.68, ease], [L + 0.75, 0.73, easeIO], [L + 1.03, 1.26, ease], [L + 1.35, 1.04, easeIn], [L + 1.43, 0.82, ease], [L + 1.55, 1.0, easeIO],
    [L + 1.71, 1.07, ease], [L + 1.87, 1.0, easeIn], [L + 1.95, 0.88, ease], [L + 2.07, 1.0, easeIO], [L + 2.17, 1.03, ease], [L + 2.27, 1.0, easeIn], [L + 2.33, 0.95, ease], [L + 2.47, 1.0, easeIO]]);
  const dy = kf(t, [[L + 0.75, 0], [L + 1.03, -170, outQ], [L + 1.35, 0, inQ], [L + 1.55, 0], [L + 1.71, -70, outQ], [L + 1.87, 0, inQ], [L + 2.07, 0], [L + 2.17, -24, outQ], [L + 2.27, 0, inQ]]);
  return { dy, sy, sx: Math.pow(sy, -0.6) };
};

// 速度拉长：位移函数 f(t) 的速度换成 y 方向拉伸（往上快 → 拉长，往下回落 → 压扁）。锚点放在底部中间
export const velocityStretch = (f: (t: number) => number, t: number, k = 14000) => {
  const v = (f(t) - f(t - 1 / FPS)) * FPS;
  const sy = 1 + clamp(-v / k, -0.12, 0.18);
  return { sy, sx: Math.pow(sy, -0.6) };
};
