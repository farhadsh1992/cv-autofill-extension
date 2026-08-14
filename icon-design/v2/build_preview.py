from PIL import Image, ImageDraw, ImageFont

try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
    font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
except Exception:
    font = ImageFont.load_default()
    font_small = font

rows = [
    ("Hero (lion + globe + CV)", "hero", [128, 48, 32, 16]),
    ("Simplified (lion only, for toolbar sizes)", "simple", [128, 48, 32, 16]),
]

col_w = 190
pad = 30
row_h = 190
width = pad * 2 + col_w * 5
height = pad + row_h * len(rows) * 2  # light + dark band per row group

canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)

y_cursor = 0
for label, prefix, sizes in rows:
    for bg, fg in [((255, 255, 255, 255), (20, 20, 20, 255)), ((28, 28, 30, 255), (240, 240, 245, 255))]:
        draw.rectangle([0, y_cursor, width, y_cursor + row_h], fill=bg)
        draw.text((pad, y_cursor + 14), f"{label} — {'light' if bg[0] > 128 else 'dark'} toolbar", font=font, fill=fg)
        band_center = y_cursor + row_h // 2 + 22
        for i, sz in enumerate(sizes):
            img = Image.open(f"{prefix}_{sz}.png").convert("RGBA")
            x = pad + i * col_w + (col_w - sz) // 2
            y = band_center - sz // 2
            canvas.alpha_composite(img, (x, y))
            label_text = f"{sz}px"
            bbox = draw.textbbox((0, 0), label_text, font=font_small)
            tw = bbox[2] - bbox[0]
            draw.text((pad + i * col_w + (col_w - tw) // 2, band_center + sz // 2 + 14), label_text, font=font_small, fill=fg)
        y_cursor += row_h

canvas.convert("RGB").save("preview_v2.png")
print("wrote preview_v2.png", canvas.size)
