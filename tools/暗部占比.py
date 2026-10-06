"""暗部占比.py <图片> [阈值=30] —— 可爱风「够亮」检查：L*（CIELAB 明度）低于阈值的像素占比，并输出一张高亮图。
经验值（片中案例实测）：P2 粉彩版 0.23%（全在线稿）、深色版 60.9%（一大片）；P4 地雷系 15%（头发、衣服、线稿、窗框）。
可爱风：≤ 2% 且只在线上；地雷系：黑可以穿在头发和衣服上，脸和底保持亮。"""
import sys
import numpy as np
from PIL import Image, ImageFilter
def Lstar(a):
    c = a / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    Y = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    return np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)
p = sys.argv[1]; th = float(sys.argv[2]) if len(sys.argv) > 2 else 30
im = Image.open(p).convert('RGB'); a = np.asarray(im).astype(float); m = Lstar(a) < th
print(f'暗部占比（L* < {th:g}）：{m.mean() * 100:.2f}%')
veil = (a * 0.34 + 255 * 0.66).astype(np.uint8); out = np.where(m[..., None], a.astype(np.uint8), veil)
Image.fromarray(out).save(p.rsplit('.', 1)[0] + '_暗部.png'); print('高亮图：', p.rsplit('.', 1)[0] + '_暗部.png')
