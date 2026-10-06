/* candy-text.js —— 糖果字 SVG 生成器（R1 糖果四圈 / R2 +Longshadow / R3 Simple Choke）
 * 纯函数、无依赖；浏览器 <script> 直接用（window.CandyText），Node / Remotion 用 require / import。
 * 全部用 SVG <text>：同一串字叠 N 份，从下到上 = 投影 → 最外圈 → … → 最内圈 → 字面 → 高光。
 * 每份 stroke-linejoin=round、paint-order=stroke（先描边后填色，描边只露出字外一半）；描边 / 投影副本带 data-deco（封面工坊量辨识度时跳过，只量字面），
 * 所以第 i 圈的 stroke-width = 2 × （从字边算起到这一圈外沿的累计宽度）。
 *
 * build({ text, font, recipe, size, x, y, id }) → { svg, box }
 *   text   要排的字（逐字取 font.chars 里的步进与高光；没有的字按步进 1em、无高光）
 *   font   配方.json 的 fonts[Fx]：{ family, chars: { 字: { adv, ink:[x0,y0,x1,y1], highlights:[capsule, dot] } } }（em，基线 y=0，向下为正）
 *   recipe 配方.json 的 recipes[Rx]
 *   size   字号 px；x, y = 第一个字的原点与基线（px）
 *   id     本实例的唯一前缀（同一页多份时防止 defs 撞名）
 *   box    整组（含描边与投影）的外框 {x0,y0,x1,y1}，排版用
 */
(function (root) {
  var r2 = function (n) { return Math.round(n * 100) / 100; };

  function layout(text, font, size, x, y, tracking) {
    var chars = Array.from(text), xs = [], cx = x, ink = null;
    chars.forEach(function (ch) {
      var g = (font.chars && font.chars[ch]) || { adv: 1 };
      xs.push(cx);
      if (g.ink) {
        var b = [cx + g.ink[0] * size, y + g.ink[1] * size, cx + g.ink[2] * size, y + g.ink[3] * size];
        ink = ink ? [Math.min(ink[0], b[0]), Math.min(ink[1], b[1]), Math.max(ink[2], b[2]), Math.max(ink[3], b[3])] : b;
      }
      cx += (g.adv + tracking) * size;
    });
    if (!ink) ink = [x, y - 0.8 * size, cx, y + 0.1 * size];
    return { chars: chars, xs: xs, ink: ink };
  }

  function textEl(L, font, size, y, attrs, text) {
    return '<text x="' + L.xs.map(r2).join(' ') + '" y="' + r2(y) + '" font-family="' + font.family + '" font-size="' + r2(size) +
      '" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke" ' + attrs + '>' + text + '</text>';
  }

  function mix(a, b, t) {
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); });
    var pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return '#' + pa.map(function (v, i) { var c = Math.round(v + (pb[i] - v) * t); return (c < 16 ? '0' : '') + c.toString(16); }).join('');
  }

  function build(o) {
    var text = o.text, font = o.font, R = o.recipe, size = o.size, x = o.x || 0, y = o.y || 0, id = o.id || 'ct';
    var esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    var L = layout(text, font, size, x, y, R.tracking || 0);
    var defs = [], body = [];
    // 圈：recipe.rings 从内到外，w 为每圈自身宽度（em）；累计后反向（外圈先画）
    var cum = 0, rings = (R.rings || []).map(function (g) { cum += g.w; return { color: g.color, out: cum, name: g.name }; });
    var total = cum;
    // 1) Longshadow：最外轮廓（累计 total）向右下复制 layers 份；颜色可从 near 渐到 far
    var ls = R.longshadow;
    if (ls && ls.layers > 0) {
      for (var k = ls.layers; k >= 1; k--) {
        var col = ls.colorFar ? mix(ls.color, ls.colorFar, (k - 1) / Math.max(1, ls.layers - 1)) : ls.color;
        body.push('<g transform="translate(' + r2(ls.dx * k * size) + ' ' + r2(ls.dy * k * size) + ')">' +
          textEl(L, font, size, y, 'data-deco="shadow" fill="' + col + '" stroke="' + col + '" stroke-width="' + r2(2 * total * size) + '"', esc) + '</g>');
      }
    }
    // 2) 各圈，外 → 内
    for (var i = rings.length - 1; i >= 0; i--) {
      body.push(textEl(L, font, size, y, 'data-deco="ring" fill="' + rings[i].color + '" stroke="' + rings[i].color + '" stroke-width="' + r2(2 * rings[i].out * size) + '"', esc));
    }
    // 3) 字面：竖向渐变，userSpaceOnUse 锁在这串字的墨迹上沿 → 下沿（上浅下深）
    var F = R.face, faceFill = F.color || '#fff';
    if (F.stops) {
      var gid = id + '-face';
      defs.push('<linearGradient id="' + gid + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + r2(L.ink[1]) + '" x2="0" y2="' + r2(L.ink[3]) + '">' +
        F.stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join('') + '</linearGradient>');
      faceFill = 'url(#' + gid + ')';
    }
    body.push(textEl(L, font, size, y, 'fill="' + faceFill + '"', esc));
    // 4) 高光：每字两团（胶囊 + 圆点），裁在字面里，落不到描边上
    var H = R.highlight;
    if (H && H.on !== false) {
      var cid = id + '-clip', hs = [];
      defs.push('<clipPath id="' + cid + '">' + textEl(L, font, size, y, '', esc) + '</clipPath>');
      L.chars.forEach(function (ch, j) {
        var g = font.chars && font.chars[ch]; if (!g || !g.highlights) return;
        var ox = L.xs[j], s = H.scale || 1;
        g.highlights.forEach(function (h) {
          if (h.type === 'capsule') {
            var cx = ox + h.cx * size, cy = y + h.cy * size, rx = h.rx * size * s, ry = h.ry * size * s;
            hs.push('<rect x="' + r2(cx - rx) + '" y="' + r2(cy - ry) + '" width="' + r2(2 * rx) + '" height="' + r2(2 * ry) + '" rx="' + r2(ry) +
              '" transform="rotate(' + h.rot + ' ' + r2(cx) + ' ' + r2(cy) + ')" fill="' + (H.color || '#fff') + '" opacity="' + (H.opacity || 0.95) + '"/>');
          } else if (h.type === 'dot') {
            hs.push('<circle cx="' + r2(ox + h.cx * size) + '" cy="' + r2(y + h.cy * size) + '" r="' + r2(h.r * size * s) + '" fill="' + (H.color || '#fff') + '" opacity="' + (H.dotOpacity || H.opacity || 0.95) + '"/>');
          }
        });
      });
      body.push('<g clip-path="url(#' + cid + ')">' + hs.join('') + '</g>');
    }
    var pad = total * size, sh = ls && ls.layers > 0 ? ls.layers : 0;
    var box = { x0: L.ink[0] - pad, y0: L.ink[1] - pad, x1: L.ink[2] + pad + (sh ? Math.max(0, ls.dx * sh * size) : 0), y1: L.ink[3] + pad + (sh ? Math.max(0, ls.dy * sh * size) : 0) };
    return { svg: '<g data-candy="' + id + '"><defs>' + defs.join('') + '</defs>' + body.join('') + '</g>', box: box, ink: L.ink, xs: L.xs };
  }

  // 七步示范用：只画到第 n 步（1 字形 → 2 白内圈 → 3 深色细线 → 4 浅色厚圈 → 5 白外圈 → 6 渐变 → 7 高光）
  function stepRecipe(R, n, flatColor) {
    var S = JSON.parse(JSON.stringify(R));
    S.rings = (R.rings || []).slice(0, Math.max(0, Math.min(R.rings.length, n - 1)));
    if (n < 6) S.face = { color: flatColor || (R.face.stops ? R.face.stops[Math.floor(R.face.stops.length / 2)][1] : R.face.color) };
    if (n < 7) S.highlight = { on: false };
    if (n < 8) S.longshadow = null;
    return S;
  }

  var api = { build: build, stepRecipe: stepRecipe, layout: layout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CandyText = api;
})(typeof window !== 'undefined' ? window : globalThis);
