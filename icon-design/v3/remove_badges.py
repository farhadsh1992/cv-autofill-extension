from PIL import Image, ImageDraw, ImageFilter

img = Image.open("source.png").convert("RGBA")
w, h = img.size

# Heavily blurred copy approximates the smooth background gradient with the
# foreground badges "melted" into an average — a crude but workable stand-in
# for real inpainting, which we don't have a generative tool for.
blurred = img.filter(ImageFilter.GaussianBlur(46))

mask = Image.new("L", (w, h), 0)
d = ImageDraw.Draw(mask)
# generous rectangles around each badge, pulled back from the CV paper/folder edges
d.rounded_rectangle([48, 62, 192, 222], radius=18, fill=255)
d.rounded_rectangle([4, 188, 150, 300], radius=18, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(20))

result = Image.composite(blurred, img, mask)
result.save("badges_removed.png")
print("wrote badges_removed.png")
