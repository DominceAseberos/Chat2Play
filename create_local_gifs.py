from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, random

OUT=Path(__file__).resolve().parent/"public"/"gifs"
OUT.mkdir(parents=True,exist_ok=True)
W,H=240,148
fontpath=r"C:\Windows\Fonts\segoeuib.ttf"
font=ImageFont.truetype(fontpath,40) if Path(fontpath).exists() else ImageFont.load_default()
small=ImageFont.truetype(fontpath,17) if Path(fontpath).exists() else ImageFont.load_default()
items=[
 ("hello","HELLO!","wave",(123,98,178),(240,169,202)),
 ("love","LOVE","hearts",(217,97,139),(255,191,196)),
 ("laugh","HAHA!","laugh",(250,184,90),(236,112,125)),
 ("yay","YAY!","confetti",(121,192,172),(192,141,230)),
 ("gg","GG!","stars",(130,156,239),(212,177,229)),
 ("wow","WOW","surprise",(197,128,201),(252,202,156)),
 ("nice","NICE!","glow",(90,190,188),(168,220,255)),
 ("coffee","COFFEE?","steam",(183,148,126),(234,192,165)),
 ("vibes","GOOD VIBES","waves",(151,133,216),(241,170,207)),
 ("thanks","THANK YOU","spark",(117,187,175),(194,213,229))
]
def heart(x,y,r):
 return [(x,y+r*.65),(x-r*.96,y-r*.2),(x-r*.7,y-r*.85),(x,y-r*.38),(x+r*.7,y-r*.85),(x+r*.96,y-r*.2)]
def centered(draw,txt,font,y,fill):
 b=draw.textbbox((0,0),txt,font=font)
 draw.text(((W-(b[2]-b[0]))/2,y),txt,font=font,fill=fill,stroke_width=0)
for ix,(slug,word,mode,c1,c2) in enumerate(items):
 frames=[]
 count=20
 for f in range(count):
  t=f/count*2*math.pi
  im=Image.new("RGB",(W,H),(19,20,32))
  px=im.load()
  for y in range(H):
   for x in range(W):
    dx=(x-W*.52)/W;dy=(y-H*.50)/H
    glow=max(0,1-math.sqrt(dx*dx*1.4+dy*dy*.9)*2)
    drift=.4+.16*math.sin(t)
    blend=glow*drift
    px[x,y]=tuple(int(20+blend*(c-20)) for c in [(c1[0]+c2[0])/2,(c1[1]+c2[1])/2,(c1[2]+c2[2])/2])
  d=ImageDraw.Draw(im,"RGBA")
  if mode=="hearts":
   for j in range(6):
    x=int((24+j*43+8*math.sin(t+j))%W);y=int((H+35-(f*3.4+j*18))% (H+55))-18
    r=6+3*math.sin(t+j)**2
    d.polygon(heart(x,y,r),fill=(255,180+j*5,214,140))
  elif mode=="confetti" or mode=="stars":
   for j in range(26):
    rng=random.Random(499+j)
    x=(rng.randint(0,W)+6*math.sin(t+j))%W
    y=(rng.randint(0,H)+f*2.8*(1 if j%2 else -1))%H
    color=(*((c1,c2)[j%2]),180)
    d.ellipse([x-2,y-2,x+2,y+2],fill=color)
  elif mode=="waves":
   for j in range(5):
    yy=100+j*9
    pts=[(x,int(yy+4*math.sin(x/14+t*2+j))) for x in range(W)]
    d.line(pts,fill=(241,200,245,50+j*20),width=2)
  elif mode=="steam":
   d.rounded_rectangle((95,98,145,122),8,fill=(238,202,186,100),outline=(251,217,201,150),width=2)
   for j in range(3):
    x=105+j*14
    pts=[(x+4*math.sin(t+k),97-k*3) for k in range(1,10)]
    d.line(pts,fill=(255,241,219,115),width=2)
  else:
   for j in range(12):
    a=t+j*math.pi/6
    rad=44+12*math.sin(t+j)
    x=W/2+math.cos(a)*rad*1.75
    y=H/2+math.sin(a)*rad*.84
    d.ellipse((x-2,y-2,x+2,y+2),fill=(255,223,246,145))
  scale=.92+.10*math.sin(t)
  tmp=Image.new("RGBA",(W,H),(0,0,0,0)); td=ImageDraw.Draw(tmp)
  label=word
  selected=small if len(word)>7 else font
  bbox=td.textbbox((0,0),label,font=selected)
  tw=bbox[2]-bbox[0];th=bbox[3]-bbox[1]
  tx=(W-tw)/2;ty=(H-th)/2-11 + 2*math.sin(t)
  td.text((tx+1,ty+3),label,font=selected,fill=(0,0,0,100),stroke_width=0)
  td.text((tx,ty),label,font=selected,fill=(255,251,255,255),stroke_width=0)
  im=Image.alpha_composite(im.convert("RGBA"),tmp)
  # Use original RGB frames so GIF palettes are generated consistently.
  frames.append(im.convert("RGB"))
 file=OUT/(slug+".gif")
 frames[0].save(file,save_all=True,append_images=frames[1:],duration=85,loop=0,optimize=True,disposal=2)
 print(slug,file.stat().st_size)
print("Generated",len(items),"fully original animated GIFs.")
