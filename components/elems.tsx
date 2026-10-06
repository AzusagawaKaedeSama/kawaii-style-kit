// 可爱风元素包：绷带 / 针管 / 爱心贴纸 / 四角闪星 / 圆圈扩散 / 放大镜 / 定位容器（React + SVG，Remotion 里直接用）
import React from "react";
import { C } from "./theme";
import { clamp, lerp } from "./motion";

const P = C.plum;

// 绷带：粉色圆角条 + 中间浅色垫片 + 小透气孔
export const Bandage: React.FC<{ w?: number; color?: string; pad?: string }> = ({ w = 220, color = "#FFB3E1", pad = "#FFF0F8" }) => {
  const h = w * 0.32;
  return (
    <svg width={w} height={h} viewBox="0 0 220 70" style={{ overflow: "visible", display: "block" }}>
      <rect x="3" y="3" width="214" height="64" rx="32" fill={color} stroke={P} strokeWidth="6" />
      <rect x="74" y="12" width="72" height="46" rx="9" fill={pad} stroke={P} strokeWidth="4" />
      {[0, 1, 2].map((i) => [0, 1].map((j) => <circle key={`${i}${j}`} cx={92 + i * 18} cy={27 + j * 16} r="3.2" fill={color} />))}
      {[24, 42, 178, 196].map((x, i) => <circle key={i} cx={x} cy={i % 2 ? 44 : 26} r="3" fill={P} opacity=".35" />)}
      <path d="M22 18 Q40 10 58 14" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".8" />
    </svg>
  );
};

// 针管：白色针筒 + 粉色药水（带小爱心）+ 推杆；push 0..1 推杆位置
export const Syringe: React.FC<{ w?: number; push?: number; liquid?: string }> = ({ w = 260, push = 0, liquid = "#FF8AD8" }) => {
  const px = lerp(0, 34, clamp(push));
  return (
    <svg width={w} height={w * 0.34} viewBox="0 0 260 88" style={{ overflow: "visible", display: "block" }}>
      <rect x={8 + px} y="34" width="58" height="20" rx="4" fill="#fff" stroke={P} strokeWidth="5" />
      <rect x={4 + px} y="20" width="12" height="48" rx="5" fill="#fff" stroke={P} strokeWidth="5" />
      <rect x="62" y="12" width="140" height="64" rx="14" fill="#fff" stroke={P} strokeWidth="6" />
      <rect x={72 + px} y="22" width={120 - px} height="44" rx="8" fill={liquid} />
      <path d="M132 58 C116 47 117 37 125 37 C128 37 131 39 132 42 C133 39 136 37 139 37 C147 37 148 47 132 58Z" fill="#fff" />
      {[96, 112, 152, 168].map((x) => <rect key={x} x={x} y="12" width="4" height="16" fill={P} />)}
      <rect x="200" y="36" width="20" height="16" rx="3" fill="#fff" stroke={P} strokeWidth="5" />
      <path d="M220 44 L256 44" stroke={P} strokeWidth="5" strokeLinecap="round" />
      <path d="M80 26 L80 40" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".85" />
    </svg>
  );
};

// 爱心贴纸：白边 + 梅子线 + 高光
export const HeartSticker: React.FC<{ size?: number; color?: string; shine?: boolean }> = ({ size = 140, color = C.candy, shine = true }) => (
  <svg width={size} height={size} viewBox="-60 -56 120 112" style={{ overflow: "visible", display: "block" }}>
    <path d="M0 44 C-62 2 -50 -46 -20 -46 C-8 -46 0 -36 0 -28 C0 -36 8 -46 20 -46 C50 -46 62 2 0 44Z" fill="#fff" stroke="#fff" strokeWidth="22" strokeLinejoin="round" />
    <path d="M0 44 C-62 2 -50 -46 -20 -46 C-8 -46 0 -36 0 -28 C0 -36 8 -46 20 -46 C50 -46 62 2 0 44Z" fill={color} stroke={P} strokeWidth="6" strokeLinejoin="round" />
    {shine && <path d="M-34 -22 Q-30 -36 -18 -36" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".9" />}
  </svg>
);

// 四角闪星
export const Sparkle: React.FC<{ size?: number; color?: string; stroke?: boolean }> = ({ size = 40, color = C.lemon, stroke = true }) => (
  <svg width={size} height={size} viewBox="-12 -12 24 24" style={{ overflow: "visible", display: "block" }}>
    <path d="M0,-11 C1.2,-2.4 2.4,-1.2 11,0 C2.4,1.2 1.2,2.4 0,11 C-1.2,2.4 -2.4,1.2 -11,0 C-2.4,-1.2 -1.2,-2.4 0,-11Z" fill={color} stroke={stroke ? P : "none"} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

// 圆圈扩散：外扩圆 + 放射短线（修剪线），p 0..1 一次完整扩散
export const Burst: React.FC<{ p: number; r?: number; color?: string; lines?: number }> = ({ p, r = 90, color = C.candy, lines = 8 }) => {
  if (p <= 0 || p >= 1) return null;
  const rr = r * (0.25 + 0.75 * Math.sqrt(p));
  const sw = 12 * (1 - p);
  return (
    <svg width={r * 3} height={r * 3} viewBox={`${-r * 1.5} ${-r * 1.5} ${r * 3} ${r * 3}`} style={{ overflow: "visible", display: "block" }}>
      <circle r={rr} fill="none" stroke={color} strokeWidth={sw} />
      {new Array(lines).fill(0).map((_, i) => {
        const a = (i / lines) * Math.PI * 2 + Math.PI / lines;
        const r0 = r * (0.55 + 0.75 * p); const r1 = r * (0.75 + 0.55 * Math.min(1, p * 1.6));
        if (r1 <= r0) return null;
        return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={P} strokeWidth={7 * (1 - p)} strokeLinecap="round" />;
      })}
    </svg>
  );
};

// 放大镜（框）
export const LensFrame: React.FC<{ r: number }> = ({ r }) => (
  <svg width={r * 4} height={r * 4} viewBox={`${-r * 2} ${-r * 2} ${r * 4} ${r * 4}`} style={{ overflow: "visible", display: "block" }}>
    <line x1={r * 0.72} y1={r * 0.72} x2={r * 1.55} y2={r * 1.55} stroke={P} strokeWidth={r * 0.34} strokeLinecap="round" />
    <line x1={r * 0.78} y1={r * 0.78} x2={r * 1.5} y2={r * 1.5} stroke={C.pink} strokeWidth={r * 0.2} strokeLinecap="round" />
    <circle r={r} fill="none" stroke="#fff" strokeWidth={r * 0.22} />
    <circle r={r * 1.1} fill="none" stroke={P} strokeWidth={r * 0.07} />
    <circle r={r * 0.9} fill="none" stroke={P} strokeWidth={r * 0.05} />
    <path d={`M${-r * 0.55} ${-r * 0.35} Q${-r * 0.45} ${-r * 0.6} ${-r * 0.2} ${-r * 0.65}`} stroke="#fff" strokeWidth={r * 0.1} strokeLinecap="round" fill="none" opacity=".9" />
  </svg>
);

// 定位：以 (x,y) 为中心放一个元素，带缩放 / 旋转 / 压扁拉长（锚点在底部中间时传 origin）
export const At: React.FC<{ x: number; y: number; s?: number; sx?: number; sy?: number; rot?: number; o?: number; origin?: string; children: React.ReactNode; z?: number }> = ({ x, y, s = 1, sx = 1, sy = 1, rot = 0, o = 1, origin = "center", children, z }) => {
  if (s <= 0.001 || o <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, opacity: o, zIndex: z }}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s * sx},${s * sy})`, transformOrigin: origin }}>{children}</div>
    </div>
  );
};
