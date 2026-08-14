from PIL import Image, ImageDraw, ImageFont

sizes = [128, 48, 32, 16]
icon = Image.open("icon-512.png").convert("RGBA")

try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
except Exception:
    font = ImageFont.load_default()
    font_small = font

pad = 30
col_w = 150
row_h = 170
width = pad * 2 + col_w * len(sizes)
height = 120 + row_h * 2

canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))

bands = [
    (0, height // 2, (255, 255, 255, 255), (20, 20, 20, 255), "Light toolbar"),
    (height // 2, height, (28, 28, 30, 255), (240, 240, 245, 255), "Dark toolbar"),
]

draw = ImageDraw.Draw(canvas)
for y0, y1, bg, fg, label in bands:
    draw.rectangle([0, y0, width, y1], fill=bg)
    draw.text((pad, y0 + 16), label, font=font, fill=fg)

for band_idx, (y0, y1, bg, fg, label) in enumerate(bands):
    band_center = y0 + (y1 - y0) // 2 + 20
    for i, sz in enumerate(sizes):
        resized = icon.resize((sz, sz), Image.LANCZOS)
        x = pad + i * col_w + (col_w - sz) // 2
        y = band_center - sz // 2
        canvas.alpha_composite(resized, (x, y))
        label_text = f"{sz}px"
        bbox = draw.textbbox((0, 0), label_text, font=font_small)
        tw = bbox[2] - bbox[0]
        draw.text((pad + i * col_w + (col_w - tw) // 2, band_center + sz // 2 + 12), label_text, font=font_small, fill=fg)

canvas.convert("RGB").save("preview_sheet.png")
print("wrote preview_sheet.png", canvas.size)
