from PIL import Image
from pathlib import Path

root = Path(r'C:\Users\dabom\OneDrive\Desktop\GONGXIFACAI\mkt88-app')
res = root / 'android' / 'app' / 'src' / 'main' / 'res'
src = Image.open(root / 'icon-512.png').convert('RGBA')

def safe_logo(size: int) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = max(1, int(round(size * 0.72)))
    icon = src.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.alpha_composite(icon, (offset, offset))
    return canvas

safe_logo(512).save(res / 'drawable' / 'splash_logo.png', optimize=True)
for density, size in {'mdpi': 200, 'hdpi': 300, 'xhdpi': 400, 'xxhdpi': 600, 'xxxhdpi': 800}.items():
    safe_logo(size).save(res / f'drawable-{density}' / 'splash_logo.png', optimize=True)
print('Generated safe-padded splash logos')
