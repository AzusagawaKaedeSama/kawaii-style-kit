// 可爱风配色（高调粉彩：暗部几乎不用，描边用梅子色而不是纯黑）
export const C = {
  milk: "#FFF5FB", milkDeep: "#FFE6F3", pink: "#FF8CC6", candy: "#FF5FA2", sky: "#8FD3FF", skyDeep: "#5BB8F5",
  lav: "#C9B6FF", mint: "#9EF0D2", lemon: "#FFE47A", plum: "#3B2346", grayLav: "#B9B0C8", white: "#FFFFFF",
  // 地雷系：粉 → 粉紫，黑只给描边 / 窗框 / 小符号
  jiraiPink: "#EC81E5", jiraiPurple: "#7340DA", jiraiInk: "#2E2A2E",
};

// v003：字体族。数字单独走 Yuruka —— 仓耳舒圆体的「2」像「Z」，「扣2」会读成「扣Z」。
// 用法：按 FONT_FILES 逐个 new FontFace(family, buf, range ? { unicodeRange: range } : {}) 注册，再写 font-family: F.cute。
export const F = { cute: "CuteDigits, ShuYuan, Yuruka", kana: "Yuruka" };
export const FONT_FILES: [string, string, string?][] = [
  ["CuteDigits", "fonts/yuruka.ttf", "U+0030-0039"], // 只取数字 0–9
  ["ShuYuan", "fonts/shuyuan.ttf"], // 仓耳舒圆体 W05（商用须授权，字体文件不随包分发）
  ["Yuruka", "fonts/yuruka.ttf"], // FOT-Yuruka Std UB（商业字体，不随包分发）
];
