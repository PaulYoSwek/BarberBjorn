"""Build every logo file from the Bjorn's Barber logo (white on black).

Run from the repo root:  python scripts/make-logos.py
"""
from PIL import Image, ImageDraw

SOURCE = "scripts/source/bjorns-barber-logo.jpg"
INK = (16, 16, 16)
PAPER = (239, 236, 228)
YELLOW = (245, 196, 0)


def alpha_mask(gray: Image.Image) -> Image.Image:
    # JPEG noise sits just above black; ramp from there to full white.
    return gray.point(lambda v: 0 if v < 40 else 255 if v > 200 else int((v - 40) * 255 / 160))


def content_box(gray: Image.Image, top: int, bottom: int, pad: int = 6) -> tuple[int, int, int, int]:
    """Bounding box of the logo between two rows, ignoring stray JPEG specks."""
    width = gray.width
    px = gray.load()
    cols = [x for x in range(width) if sum(1 for y in range(top, bottom, 2) if px[x, y] > 128) > 3]
    rows = [y for y in range(top, bottom) if sum(1 for x in range(0, width, 2) if px[x, y] > 128) > 3]
    return (max(cols[0] - pad, 0), max(rows[0] - pad, 0), min(cols[-1] + pad, width), min(rows[-1] + pad, gray.height))


def white(gray: Image.Image, box: tuple[int, int, int, int], width: int) -> Image.Image:
    part = gray.crop(box)
    mask = alpha_mask(part)
    out = Image.new("RGBA", part.size, (255, 255, 255, 0))
    out.putalpha(mask)
    height = round(part.height * width / part.width)
    return out.resize((width, height), Image.LANCZOS)


def recolor(image: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    out = Image.new("RGBA", image.size, (*rgb, 0))
    out.putalpha(image.getchannel("A"))
    return out


def on_square(mark: Image.Image, size: int, background, fill: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (*background, 255))
    scale = size * fill / max(mark.size)
    icon = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(icon, ((size - icon.width) // 2, (size - icon.height) // 2))
    return canvas.convert("RGB")


gray = Image.open(SOURCE).convert("L")

# Row bands of the source: the BB mark, then BJORN'S / BARBER / FINE GROOMING.
MARK_ROWS = (120, 1080)
NAME_ROWS = (1090, 1960)

full = white(gray, content_box(gray, MARK_ROWS[0], NAME_ROWS[1]), 900)
mark = white(gray, content_box(gray, *MARK_ROWS), 900)
name = white(gray, content_box(gray, *NAME_ROWS), 880)

full.save("public/logo-wordmark.png", optimize=True)
full.save("public/logo-lockup-white.png", optimize=True)
recolor(full, INK).save("public/logo-lockup.png", optimize=True)
mark.save("public/logo-mark.png", optimize=True)
recolor(mark, INK).save("public/logo-mark-black.png", optimize=True)
name.save("public/logo-name.png", optimize=True)

# Icons: the black mark on paper, as before.
black_mark = recolor(mark, INK)
on_square(black_mark, 180, PAPER, 0.72).save("public/apple-touch-icon.png", optimize=True)
on_square(black_mark, 64, PAPER, 0.8).save("public/favicon.png", optimize=True)
on_square(black_mark, 48, PAPER, 0.82).save("public/favicon-48.png", optimize=True)
on_square(black_mark, 32, PAPER, 0.86).save("public/favicon-32.png", optimize=True)
on_square(black_mark, 48, PAPER, 0.82).save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# Social preview: the full logo on ink with a yellow rule.
og = Image.new("RGBA", (1200, 630), (*INK, 255))
logo = full.resize((round(full.width * 400 / full.height), 400), Image.LANCZOS)
x, y = (1200 - logo.width) // 2, (630 - logo.height) // 2 - 28
og.alpha_composite(logo, (x, y))
ImageDraw.Draw(og).rectangle([600 - 42, y + logo.height + 30, 600 + 42, y + logo.height + 34], fill=YELLOW)
og.convert("RGB").save("public/og-image.jpg", "JPEG", quality=88, optimize=True)

for name_, image in [("wordmark", full), ("mark", mark), ("name", name)]:
    print(name_, image.size)
