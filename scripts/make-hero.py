from PIL import Image, ImageDraw

W, H = 1280, 720

def frame() -> Image.Image:
    image = Image.new("RGB", (W, H), (12, 12, 12))
    return image

def save(image: Image.Image, name: str) -> None:
    image.save(f"public/frames/{name}")

def chair() -> None:
    image = frame()
    draw = ImageDraw.Draw(image)
    draw.rectangle((520, 180, 760, 430), outline=(210, 210, 210), width=8)
    draw.rectangle((575, 430, 705, 560), outline=(180, 180, 180), width=8)
    draw.line((500, 560, 780, 560), fill=(160, 160, 160), width=10)
    save(image, "01.png")

def clippers() -> None:
    image = frame()
    draw = ImageDraw.Draw(image)
    draw.polygon([(470, 520), (620, 180), (700, 210), (560, 560)], outline=(220, 220, 220))
    draw.line((620, 180, 700, 210), fill=(230, 230, 230), width=14)
    save(image, "02.png")

def scissors(open_gap: int, name: str) -> None:
    image = frame()
    draw = ImageDraw.Draw(image)
    draw.line((430, 560, 760, 180), fill=(225, 225, 225), width=10)
    draw.line((430, 560, 760, 180 + open_gap), fill=(190, 190, 190), width=10)
    draw.ellipse((400, 530, 460, 590), outline=(210, 210, 210), width=6)
    save(image, name)

chair()
clippers()
scissors(220, "03.png")
scissors(40, "04.png")
