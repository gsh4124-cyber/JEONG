from PIL import Image, ImageDraw, ImageFont
import os, math, random
W,H=1080,1920
OUT='/tmp/global_shorts_mass_poc'; FR=os.path.join(OUT,'frames'); os.makedirs(FR,exist_ok=True)
random.seed(20261003)
def font(n):
 for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf']:
  if os.path.exists(p): return ImageFont.truetype(p,n)
 return ImageFont.load_default()
F1,F2=font(86),font(54)
# POC 1: odd-one-out with multiple visual dimensions and timed reveal
cols,rows=5,7; margin=90; gap=26; cell=(W-2*margin-gap*(cols-1))//cols
odd=(3,4)
for k in range(120):
 im=Image.new('RGB',(W,H),(12,15,26)); d=ImageDraw.Draw(im)
 title='FIND THE ODD ONE'; bb=d.textbbox((0,0),title,font=F1); d.text(((W-(bb[2]-bb[0]))/2,105),title,font=F1,fill=(245,247,255))
 sec=max(0,4-k//30); sub=f'{sec+1}' if k<90 else 'FOUND IT?'; bb=d.textbbox((0,0),sub,font=F2); d.text(((W-(bb[2]-bb[0]))/2,245),sub,font=F2,fill=(90,220,255))
 y0=420
 for r in range(rows):
  for c in range(cols):
   x=margin+c*(cell+gap); y=y0+r*(cell+gap)
   cx,cy=x+cell//2,y+cell//2; rad=cell//2-12
   fill=(255,185,35)
   d.ellipse((cx-rad,cy-rad,cx+rad,cy+rad),fill=fill)
   # face makes each object richer than a flat color tile
   eye=13; d.ellipse((cx-48-eye,cy-30-eye,cx-48+eye,cy-30+eye),fill=(28,31,42)); d.ellipse((cx+48-eye,cy-30-eye,cx+48+eye,cy-30+eye),fill=(28,31,42))
   if (c,r)==odd: d.arc((cx-58,cy+4,cx+58,cy+82),200,340,fill=(28,31,42),width=12)
   else: d.arc((cx-58,cy-4,cx+58,cy+72),20,160,fill=(28,31,42),width=12)
   if k>=90 and (c,r)==odd:
    pulse=10+int(8*math.sin(k*.45)); d.ellipse((cx-rad-pulse,cy-rad-pulse,cx+rad+pulse,cy+rad+pulse),outline=(80,240,140),width=14)
 # progress bar
 d.rounded_rectangle((90,1740,990,1770),15,fill=(40,45,64)); p=min(1,k/90); d.rounded_rectangle((90,1740,90+int(900*p),1770),15,fill=(90,220,255))
 im.save(os.path.join(FR,f'frame_{k+1:04d}.png'))
print('MASS_SHORT_POC_RENDERED',len(os.listdir(FR)))