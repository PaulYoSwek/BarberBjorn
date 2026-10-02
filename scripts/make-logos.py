from PIL import Image

MARK = r"C:\Users\Paulg\.cursor\projects\d-Projects-BarberBjorn\assets\c__Users_Paulg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_BarberBjornLogoBBSolo-e8737224-a5a8-4538-acf0-8c9b5ddcf453.png"
WORD = r"C:\Users\Paulg\.cursor\projects\d-Projects-BarberBjorn\assets\c__Users_Paulg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_BarberBjornLogoTextSolo-7be7ffb7-413d-4862-a924-af342af4c07c.png"
PORTRAIT = r"C:\Users\Paulg\.cursor\projects\d-Projects-BarberBjorn\assets\c__Users_Paulg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-96ad88f1-cbf5-485c-9cfb-2c0051b7b7e5.png"

def to_white(src: str, dst: str) -> None:
    image = Image.open(src).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, _a = pixels[x, y]
            lum = (r + g + b) / 3
            if lum < 8:
                pixels[x, y] = (255, 255, 255, 0)
            else:
                alpha = max(0, min(255, int((lum - 6) * (255 / 30))))
                pixels[x, y] = (255, 255, 255, alpha)
    image.save(dst)

to_white(MARK, "public/logo-mark.png")
to_white(WORD, "public/logo-wordmark.png")
Image.open(PORTRAIT).save("public/portrait.png")
