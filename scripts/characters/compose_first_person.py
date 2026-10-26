from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
sources = sorted((root / 'assets/characters/validation/first-person-frames').glob('*.png'))
if len(sources) != 64:
    raise RuntimeError('First-person capture must contain all 64 frames')
frames = [Image.open(source).convert('RGB') for source in sources]
destination = root / 'assets/characters/previews'
frames[0].save(destination / 'first-person-walking.gif', save_all=True,
               append_images=frames[1:], duration=50, loop=0, optimize=True)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
sheet = Image.new('RGB', (780, 884), '#30263e')
draw = ImageDraw.Draw(sheet)
draw.text((16, 10), 'LOOK AHEAD', font=font, fill='white')
draw.text((406, 10), 'LOOK DOWN WHILE WALKING', font=font, fill='white')
sheet.paste(frames[12], (0, 40))
sheet.paste(frames[48], (390, 40))
sheet.save(destination / 'first-person-views.png')
print('Saved first-person-walking.gif and first-person-views.png')
