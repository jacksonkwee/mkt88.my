from PIL import Image, ImageDraw
from pathlib import Path
import math

root = Path(r'C:\Users\dabom\OneDrive\Desktop\GONGXIFACAI\mkt88-app')
src_path = root / 'icon-512.png'
res = root / 'android' / 'app' / 'src' / 'main' / 'res'
src = Image.open(src_path).convert('RGBA')

# Full-screen splash sizes used by the Android launcher.
portrait = {
    'mdpi': (320, 480),
    'hdpi': (480, 720),
    'xhdpi': (720, 1080),
    'xxhdpi': (960, 1440),
    'xxxhdpi': (1440, 2560),
}
landscape = {
    'mdpi': (480, 320),
    'hdpi': (720, 480),
    'xhdpi': (1080, 720),
    'xxhdpi': (1440, 960),
    'xxxhdpi': (2560, 1440),
}

def make_splash(size):
    canvas = Image.new('RGBA', size, (204, 0, 0, 255))
    icon_size = max(1, int(min(size) * 0.55))
    icon = src.resize((icon_size, icon_size), Image.LANCZOS)
    x = (size[0] - icon_size) // 2
    y = (size[1] - icon_size) // 2
    canvas.alpha_composite(icon, (x, y))
    return canvas.convert('RGB')

for density, size in portrait.items():
    out = res / f'drawable-port-{density}' / 'splash.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    make_splash(size).save(out, optimize=True)

for density, size in landscape.items():
    out = res / f'drawable-land-{density}' / 'splash.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    make_splash(size).save(out, optimize=True)

# Density-independent fallback and Android 12 splash icon.
make_splash((1080, 1920)).save(res / 'drawable' / 'splash.png', optimize=True)
src.resize((512, 512), Image.LANCZOS).save(res / 'drawable' / 'splash_logo.png', optimize=True)

# Legacy and adaptive launcher icons.
launcher_sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for density, size in launcher_sizes.items():
    folder = res / f'mipmap-{density}'
    icon = src.resize((size, size), Image.LANCZOS)

    icon.save(folder / 'ic_launcher.png', optimize=True)

    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    round_icon = icon.copy()
    round_icon.putalpha(mask)
    round_icon.save(folder / 'ic_launcher_round.png', optimize=True)

    adaptive_size = int(round(size * 108 / 48))
    canvas = Image.new('RGBA', (adaptive_size, adaptive_size), (0, 0, 0, 0))
    inner = int(round(adaptive_size * 2 / 3))
    adaptive_icon = src.resize((inner, inner), Image.LANCZOS)
    offset = (adaptive_size - inner) // 2
    canvas.alpha_composite(adaptive_icon, (offset, offset))
    canvas.save(folder / 'ic_launcher_foreground.png', optimize=True)

print('Generated splash and launcher assets from', src_path)
