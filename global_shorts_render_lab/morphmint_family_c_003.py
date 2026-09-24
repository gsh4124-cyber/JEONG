# ARCHIVED_REFERENCE_ONLY — DO NOT USE AS CURRENT GLOBAL SHORTS PRODUCTION ROUTE
# Current primary route: global_shorts_render_lab/blender_mcp/ (Blender MCP local 3D)
# Retained only for failure learning / fallback reconstruction; no active workflow should invoke this file.

import math, wave, struct, os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

W,H=1080,1920
CX,CY,R=540,850,310
OUT=os.environ.get("OUT",".")
os.makedirs(OUT,exist_ok=True)

yy,xx=np.mgrid[0:H,0:W]
dx=(xx-CX)/R; dy=(yy-CY)/R; rr=np.sqrt(dx*dx+dy*dy)
mask=Image.new("L",(W,H),0)
ImageDraw.Draw(mask).ellipse((CX-R,CY-R,CX+R,CY+R),fill=255)

def bg():
    Y=np.linspace(0,1,H)[:,None,None]
    a=np.array([10,15,32]); b=np.array([2,4,10])
    g=(a*(1-Y)+b*Y).astype(np.uint8); g=np.repeat(g,W,1)
    im=Image.fromarray(g,"RGB").convert("RGBA")
    s=Image.new("RGBA",(W,H)); d=ImageDraw.Draw(s)
    d.ellipse((210,1110,870,1235),fill=(0,0,0,150))
    im.alpha_composite(s.filter(ImageFilter.GaussianBlur(34)))
    return im

def disc(c0,c1,gloss):
    t=np.clip(rr,0,1)
    A=np.array(c0,float); B=np.array(c1,float)
    arr=A[None,None,:]*(1-t[...,None])+B[None,None,:]*t[...,None]
    light=np.clip(1.10-.34*(dx*.45+dy*.85)-.22*rr,.55,1.3)
    arr*=light[...,None]
    if gloss:
        arr += 140*np.exp(-(((dx+.28)/.22)**2+((dy+.36)/.10)**2))[...,None]*gloss
    im=Image.fromarray(np.clip(arr,0,255).astype(np.uint8),"RGB").convert("RGBA")
    im.putalpha(mask)
    return im

def ring(im,c,w=18,r0=294):
    ImageDraw.Draw(im).ellipse((CX-r0,CY-r0,CX+r0,CY+r0),outline=c,width=w)

def ident(im,c):
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((CX-38,CY-165,CX+38,CY+165),radius=28,fill=c)
    d.ellipse((CX-116,CY-116,CX+116,CY+116),outline=c,width=20)

def stage(im,active):
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((270,1320,810,1460),radius=54,fill=(22,31,54,255),outline=(76,101,145,255),width=3)
    d.rounded_rectangle((350,1278,730,1318),radius=20,fill=(32,196,230,150))
    for j,x in enumerate((450,540,630)):
        d.ellipse((x-12,1528,x+12,1552),fill=(94,238,255,255) if j==active else (66,76,98,180))

# Ceramic state.
im=bg()
im.alpha_composite(disc((245,120,52),(115,42,24),.25))
ring(im,(255,188,110,255))
d=ImageDraw.Draw(im)
for a in (-65,-25,15,55,95):
    x=CX+int(210*math.cos(math.radians(a)))
    y=CY+int(210*math.sin(math.radians(a)))
    d.ellipse((x-14,y-14,x+14,y+14),fill=(255,190,110,210))
ident(im,(255,211,156,230)); stage(im,0)
im.convert("RGB").save(os.path.join(OUT,"ceramic.png"))

# Chrome state. Reflection geometry is strictly clipped to the object silhouette.
im=bg()
im.alpha_composite(disc((232,242,255),(33,43,62),1.15))
ring(im,(222,235,255,255))
bands=Image.new("RGBA",(W,H)); bd=ImageDraw.Draw(bands)
for x,w in [(365,85),(555,48),(725,70)]:
    bd.rounded_rectangle((x-w,CY-R-35,x+w,CY+R+35),radius=max(20,w//2),fill=(255,255,255,205))
bands=bands.rotate(4,center=(CX,CY),resample=Image.Resampling.BICUBIC)
bands.putalpha(Image.composite(bands.getchannel("A"),Image.new("L",(W,H),0),mask))
im.alpha_composite(bands)
dark=Image.new("RGBA",(W,H)); dd=ImageDraw.Draw(dark)
dd.rectangle((510,CY-R-20,575,CY+R+20),fill=(14,20,34,190))
dark=dark.rotate(30,center=(CX,CY),resample=Image.Resampling.BICUBIC)
dark.putalpha(Image.composite(dark.getchannel("A"),Image.new("L",(W,H),0),mask))
im.alpha_composite(dark)
ident(im,(235,246,255,245)); stage(im,1)
im.convert("RGB").save(os.path.join(OUT,"chrome.png"))

# Crystal state. Facets are clipped to object silhouette; halo is a separate FX layer.
im=bg()
halo=Image.new("RGBA",(W,H)); hd=ImageDraw.Draw(halo)
hd.ellipse((CX-R-50,CY-R-50,CX+R+50,CY+R+50),outline=(30,225,255,125),width=22)
im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(10)))
im.alpha_composite(disc((30,178,255),(7,28,98),.6))
ring(im,(82,238,255,255),22)
f=Image.new("RGBA",(W,H)); fd=ImageDraw.Draw(f)
for a in range(0,180,30):
    q=math.radians(a)
    fd.line((CX-int(R*.84*math.cos(q)),CY-int(R*.84*math.sin(q)),
             CX+int(R*.84*math.cos(q)),CY+int(R*.84*math.sin(q))),
            fill=(194,247,255,205),width=10)
for r0 in (105,210):
    fd.ellipse((CX-r0,CY-r0,CX+r0,CY+r0),outline=(118,230,255,170),width=8)
f.putalpha(Image.composite(f.getchannel("A"),Image.new("L",(W,H),0),mask))
im.alpha_composite(f)
g=Image.new("RGBA",(W,H)); gd=ImageDraw.Draw(g); pts=[]
for k in range(8):
    a=math.pi/4*k+math.pi/8; r0=92 if k%2==0 else 68
    pts.append((CX+r0*math.cos(a),CY+r0*math.sin(a)))
gd.polygon(pts,fill=(94,235,255,225),outline=(225,255,255,255))
im.alpha_composite(g)
ident(im,(220,252,255,240)); stage(im,2)
im.convert("RGB").save(os.path.join(OUT,"crystal.png"))

# Deterministic circular shell-takeover transition frames (not a crossfade).
maxr=math.hypot(W/2,H/2)+5
for dirname,a,b in (("t1","ceramic.png","chrome.png"),("t2","chrome.png","crystal.png")):
    A=Image.open(os.path.join(OUT,a)).convert("RGB")
    B=Image.open(os.path.join(OUT,b)).convert("RGB")
    td=os.path.join(OUT,dirname); os.makedirs(td,exist_ok=True)
    for k in range(24):
        p=(k+1)/24
        e=1-(1-p)**2
        r=maxr*e
        m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
        d.ellipse((W/2-r,H/2-r,W/2+r,H/2+r),fill=255)
        Image.composite(B,A,m).save(os.path.join(td,f"f_{k:03d}.png"))

# Exact event audio onsets at transition starts and final payoff.
SR=48000; DUR=8
events=[(2.0,520,.18),(4.8,760,.20),(7.1,980,.28)]
vals=[]
for n in range(SR*DUR):
    t=n/SR; v=0.0
    for st,freq,length in events:
        dt=t-st
        if 0<=dt<length:
            env=(1-dt/length)**2
            v += .45*env*math.sin(2*math.pi*freq*dt)+.16*env*math.sin(2*math.pi*freq*2.01*dt)
    vals.append(max(-.95,min(.95,v)))
with wave.open(os.path.join(OUT,"audio.wav"),"wb") as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes(b"".join(struct.pack("<h",int(v*32767)) for v in vals))
