// 糖果字（萌豚系多圈描边字）：按字设实验 r01 的配方（中文/配方.json）原样实现，每一圈、每一个字、字面渐变、高光都能单独动
// 画法（从下到上）：Longshadow → 最外圈 … 最内圈（stroke-width = 2 × 累计宽度，paint-order=stroke）→ 字面（纯色 → 渐变从下往上灌）→ 高光（裁在字形里）
import React from "react";
import REC from "./candy_recipe.json"; // 配方与逐字高光：字设实验 r01（仓耳舒圆体 W05）

export type GlyphTf = { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number; o?: number };
type Ring = { name: string; w: number; color: string };
type Hl = { type: "capsule" | "dot"; cx: number; cy: number; rx?: number; ry?: number; r?: number; rot?: number };
type Chars = Record<string, { adv: number; ink: number[]; highlights?: Hl[] }>;

let uid = 0;
export const CandyTitle: React.FC<{
  text: string; size: number; x: number; y: number; // x,y = 整组的中心点（基线方向按字身中线）
  recipe?: "R1" | "R2" | "R3"; font?: string; rot?: number;
  ringP?: number[]; // 每一圈（从内到外）的显出量 0..1；不给 = 全显
  faceSolid?: string; pour?: number; // 纯色字面 + 渐变从下往上灌（0..1）；pour 不给 = 全渐变
  hiP?: number; shadowP?: number; contour?: number | number[]; // contour: 0..1 等高线（每圈外沿一道细线；数组 = 每圈单独，从内到外）
  glyph?: (i: number) => GlyphTf; ringColors?: string[]; faceStops?: [string, string];
}> = ({ text, size, x, y, recipe = "R2", font = "ShuYuan", rot = 0, ringP, faceSolid = "#FF6EAF", pour, hiP = 1, shadowP = 1, contour = 0, glyph, ringColors, faceStops }) => {
  const [id] = React.useState(() => `cd${uid++}`);
  const R = (REC as any).recipes[recipe];
  const chars: Chars = (REC as any).chars;
  const fs = size; const tr = (R.tracking || 0) * fs;
  const list = Array.from(text);
  const adv = list.map((c) => (chars[c]?.adv ?? 1) * fs);
  const total = adv.reduce((a, b) => a + b, 0) + tr * (list.length - 1);
  const xs: number[] = []; let acc = -total / 2;
  list.forEach((_, i) => { xs.push(acc); acc += adv[i] + tr; });
  const inks = list.map((c) => chars[c]?.ink ?? [0, -0.85, 1, 0.1]);
  const top = Math.min(...inks.map((k) => k[1])) * fs; const bot = Math.max(...inks.map((k) => k[3])) * fs;
  const base = -(top + bot) / 2; // 让墨迹上下居中在 y
  const rings: Ring[] = R.rings.map((r: Ring, i: number) => ({ ...r, color: ringColors?.[i] ?? r.color }));
  const ps = rings.map((_, i) => (ringP ? ringP[i] ?? 0 : 1));
  const cum: number[] = []; let c = 0;
  rings.forEach((r, i) => { c += r.w * Math.max(0, Math.min(1, ps[i])); cum.push(c); });
  const tf = (i: number) => {
    const g = glyph ? glyph(i) : {}; const cx = xs[i] + adv[i] / 2; const cy = base + bot; // 锚点：字底中间
    return `translate(${(g.dx || 0)} ${(g.dy || 0)}) translate(${cx} ${cy}) rotate(${g.rot || 0}) scale(${g.sx ?? 1} ${g.sy ?? 1}) translate(${-cx} ${-cy})`;
  };
  const gO = (i: number) => (glyph ? glyph(i).o ?? 1 : 1);
  const T = (i: number, p: React.SVGProps<SVGTextElement>) => (
    <text key={i} x={xs[i]} y={base} fontFamily={font} fontSize={fs} transform={tf(i)} opacity={gO(i)} strokeLinejoin="round" strokeLinecap="round" paintOrder="stroke" {...p}>{list[i]}</text>
  );
  const stops: [string, string] = faceStops ?? [R.face.stops[0][1], R.face.stops[1][1]];
  const ls = R.longshadow;
  const totalW = cum[cum.length - 1] || 0;
  const pourY = bot + base - (pour ?? 1) * (bot - top + 4); // 灌到哪里（y 越小越高）
  return (
    <svg style={{ position: "absolute", left: x, top: y, width: 1, height: 1, overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1={top + base} x2="0" y2={bot + base}>
          <stop offset="0" stopColor={stops[0]} /><stop offset="1" stopColor={stops[1]} />
        </linearGradient>
        <clipPath id={`${id}-pour`}><rect x={-total} y={pourY} width={total * 2} height={bot - top + 40} /></clipPath>
        {list.map((ch, i) => (
          <clipPath key={i} id={`${id}-c${i}`}><text x={xs[i]} y={base} fontFamily={font} fontSize={fs}>{ch}</text></clipPath>
        ))}
      </defs>
      <g transform={`rotate(${rot})`}>
        {ls && shadowP > 0.001 && totalW > 0 && Array.from({ length: ls.layers }, (_, k) => ls.layers - k).map((k) => (
          <g key={`s${k}`} transform={`translate(${ls.dx * k * fs * shadowP} ${ls.dy * k * fs * shadowP})`} opacity={Math.min(1, shadowP * 1.5)}>
            {list.map((_, i) => T(i, { fill: ls.color, stroke: ls.color, strokeWidth: 2 * totalW * fs }))}
          </g>
        ))}
        {rings.map((r, ri) => ri).reverse().map((ri) => {
          if (ps[ri] <= 0.001) return null;
          const ck = Array.isArray(contour) ? contour[ri] ?? 0 : contour;
          const w = 2 * cum[ri] * fs; const lw = Math.max(1.5, fs * 0.008) * Math.min(1, ck * 1.5);
          return (
            <g key={ri}>
              {ck > 0.001 && list.map((_, i) => T(i, { fill: "none", stroke: "#3B2346", strokeWidth: w + 2 * lw, opacity: Math.min(1, ck) * gO(i) }))}
              {list.map((_, i) => T(i, { fill: rings[ri].color, stroke: rings[ri].color, strokeWidth: w }))}
            </g>
          );
        })}
        {list.map((_, i) => T(i, { fill: faceSolid }))}
        <g clipPath={pour !== undefined ? `url(#${id}-pour)` : undefined}>{list.map((_, i) => T(i, { fill: `url(#${id}-g)` }))}</g>
        {hiP > 0.001 && list.map((ch, i) => (
          <g key={`h${i}`} transform={tf(i)} opacity={gO(i)}>
            <g clipPath={`url(#${id}-c${i})`}>
              {(chars[ch]?.highlights || []).map((h, k) => {
                const cx = xs[i] + h.cx * fs; const cy = base + h.cy * fs; const s = Math.min(1, hiP * 1.2);
                return h.type === "capsule"
                  ? <ellipse key={k} cx={cx} cy={cy} rx={(h.rx || 0.05) * fs * s} ry={(h.ry || 0.02) * fs * s} transform={`rotate(${h.rot || 0} ${cx} ${cy})`} fill="#fff" opacity={0.95} />
                  : <circle key={k} cx={cx} cy={cy} r={(h.r || 0.02) * fs * s} fill="#fff" opacity={0.95} />;
              })}
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
};
