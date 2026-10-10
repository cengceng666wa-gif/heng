"""
生成 PWA 图标。

设计：深色圆角方块 + 白色「衡」字。
字形只占约 52%，留足安全边距以便同时用作 maskable 图标
（Android 会把 maskable 图标裁成圆形/水滴形，超出安全区的部分会被切掉）。

用法：  python scripts/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).resolve().parent.parent / "public"

BG = (17, 18, 20, 255)  # #111214，与 App 主题色一致
FG = (232, 234, 237, 255)  # #e8eaed

# 按优先级找一个可用的中文字体
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",  # 微软雅黑 Bold
    r"C:\Windows\Fonts\msyh.ttc",  # 微软雅黑
    r"C:\Windows\Fonts\simhei.ttf",  # 黑体
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
]


def pick_font() -> str:
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return p
    raise SystemExit(
        "找不到中文字体，请把 FONT_CANDIDATES 里加一个本机存在的字体路径"
    )


def make_icon(size: int, font_path: str, radius_ratio: float, glyph_ratio: float) -> Image.Image:
    # 4 倍超采样，缩小后边缘更干净
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(s * radius_ratio)
    draw.rounded_rectangle([(0, 0), (s - 1, s - 1)], radius=radius, fill=BG)

    font_size = int(s * glyph_ratio)
    font = ImageFont.truetype(font_path, font_size)

    # 用实际墨迹边界居中，而不是依赖字体的行高
    bbox = draw.textbbox((0, 0), "衡", font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    pos = ((s - w) / 2 - bbox[0], (s - h) / 2 - bbox[1])

    draw.text(pos, "衡", font=font, fill=FG)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    font_path = pick_font()
    print(f"使用字体: {font_path}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for size in (192, 512):
        icon = make_icon(size, font_path, radius_ratio=0.22, glyph_ratio=0.52)
        out = OUT_DIR / f"icon-{size}.png"
        icon.save(out, "PNG", optimize=True)
        print(f"已生成 {out}  ({out.stat().st_size / 1024:.1f} KB)")

    # Apple touch icon（iOS 加主屏幕用，不透明、无圆角）
    touch = make_icon(180, font_path, radius_ratio=0.0, glyph_ratio=0.52)
    out = OUT_DIR / "apple-touch-icon.png"
    touch.convert("RGB").save(out, "PNG", optimize=True)
    print(f"已生成 {out}  ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
