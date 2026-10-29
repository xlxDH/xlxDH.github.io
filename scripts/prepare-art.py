"""Rename supplied art and generate a small, pixel-rendered web asset set."""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'assets' / 'images'
ART.mkdir(parents=True, exist_ok=True)
SOURCES = [
    ('微信图片_20261029181125_63_109.jpg', 'wallpaper-source.jpg'),
    ('头像改改.png', 'portrait-source.png'),
    ('622f2d217a1ba5744adc1c3b85c30eec2f8f492c.png@112w_112h - 副本.png', 'site-icon.png'),
]
for original, renamed in SOURCES:
    source = (ROOT / original).resolve()
    target = (ART / renamed).resolve()
    assert source.parent == ROOT and target.parent == ART
    if source.exists():
        if target.exists():
            raise FileExistsError(target)
        source.rename(target)
    with Image.open(target) as image:
        print(f'{renamed}: {image.size}, {image.mode}')

with Image.open(ART / 'wallpaper-source.jpg') as image:
    image = ImageOps.exif_transpose(image).convert('RGB')
    image.thumbnail((384, 256), Image.Resampling.LANCZOS)
    image = ImageEnhance.Color(image).enhance(0.8)
    image = image.quantize(colors=40, dither=Image.Dither.NONE).convert('RGB')
    image.save(ART / 'pixel-wallpaper.png', optimize=True)

with Image.open(ART / 'portrait-source.png') as image:
    image = ImageOps.exif_transpose(image).convert('RGBA')
    image.thumbnail((128, 160), Image.Resampling.LANCZOS)
    image = image.quantize(colors=48, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    image.save(ART / 'pixel-portrait.png', optimize=True)

with Image.open(ART / 'site-icon.png') as image:
    image = ImageOps.fit(image.convert('RGBA'), (64, 64), method=Image.Resampling.LANCZOS)
    image.save(ART / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
