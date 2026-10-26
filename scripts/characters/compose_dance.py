from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2]
sources=sorted((root/'assets/characters/validation/dance-frames').glob('[0-9][0-9].png'))
if len(sources)!=64:raise RuntimeError('Dance capture must contain all 64 frames')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
frames=[]
for source in sources:
    image=ImageOps.contain(Image.open(source).convert('RGB'),(680,575))
    canvas=Image.new('RGB',(680,640),'#211b35');canvas.paste(image,((680-image.width)//2,42))
    draw=ImageDraw.Draw(canvas);draw.text((18,10),'VICTORY DANCE · 4 SECOND LOOP',font=font,fill='white')
    draw.text((18,610),'Knee lifts · diagonal reaches · soft landings',font=small,fill='#e7d5fb')
    frames.append(canvas)
destination=root/'assets/characters/previews'
frames[0].save(destination/'victory-dance.gif',save_all=True,append_images=frames[1:],duration=[60,60,60,70]*16,loop=0,optimize=True)
sheet=Image.new('RGB',(1360,1280),'#211b35')
for i,index in enumerate([8,24,40,56]):sheet.paste(frames[index],((i%2)*680,(i//2)*640))
sheet.save(destination/'victory-dance-poses.png')
poses=Image.new('RGB',(1360,1440),'#211b35')
labels=['Anticipation / supporting leg','Knee lift / diagonal fist','Landing / absorb the weight','Gather before the hop','Small hop / open silhouette','Soft landing','Opposite knee / mirrored phrase','Reach with elbow follow-through']
for i,label in enumerate(labels):
    image=ImageOps.contain(Image.open(root/f'assets/characters/validation/dance-frames/pose-{i}.png').convert('RGB'),(680,320))
    x=(i%2)*680;y=(i//2)*360;poses.paste(image,(x+(680-image.width)//2,y+30))
    ImageDraw.Draw(poses).text((x+18,y+6),label,font=small,fill='white')
poses.save(destination/'natural-dance-key-poses.png')
print('Saved victory-dance.gif, victory-dance-poses.png and natural-dance-key-poses.png')
