import os, math, wave, struct, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

W,H,FPS,DUR = 1080,1920,30,8
N=FPS*DUR
OUT=sys.argv[1] if len(sys.argv)>1 else "out"
os.makedirs(OUT,exist_ok=True)
CX,CY=540,850
R=310

def ease(x):
    x=max(0.0,min(1.0,x))
    return x*x*(3-2*x)

def mask_circle(cx,cy,r):
    m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
    d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=255)
    return m

def radial_disc(colors, gloss=0.0):
    yy,xx=np.mgrid[0:H,0:W]
    dx=(xx-CX)/R; dy=(yy-CY)/R
    rr=np.sqrt(dx*dx+dy*dy)
    t=np.clip(rr,0,1)
    c0=np.array(colors[0],dtype=float); c1=np.array(colors[1],dtype=float)
    arr=c0[None,None,:]*(1-t[...,None])+c1[None,None,:]*t[...,None]
    light=np.clip(1.10-0.34*(dx*.45+dy*.85)-0.22*rr,0.55,1.3)
    arr*=light[...,None]
    if gloss:
        spec=np.exp(-(((dx+.28)/.22)**2+((dy+.36)/.10)**2))*gloss
        arr += 140*spec[...,None]
    arr=np.clip(arr,0,255).astype(np.uint8)
    im=Image.fromarray(arr,"RGB").convert("RGBA")
    im.putalpha(mask_circle(CX,CY,R))
    return im

def add_shadow(base):
    sh=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(sh)
    d.ellipse((CX-R*1.06,CY+R*.84,CX+R*1.06,CY+R*1.21),fill=(0,0,0,155))
    sh=sh.filter(ImageFilter.GaussianBlur(34))
    base.alpha_composite(sh)

def add_ring(im,color,width=18,r=R-16,blur=0):
    layer=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(layer)
    d.ellipse((CX-r,CY-r,CX+r,CY+r),outline=color,width=width)
    if blur: layer=layer.filter(ImageFilter.GaussianBlur(blur))
    im.alpha_composite(layer)

def add_identity(im,color):
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((CX-38,CY-165,CX+38,CY+165),radius=28,fill=color)
    d.ellipse((CX-116,CY-116,CX+116,CY+116),outline=color,width=20)

def frame_img(i):
    t=i/FPS
    bg=Image.new("RGBA",(W,H),(7,10,20,255))
    # subtle vertical gradient
    yy=np.linspace(0,1,H)[:,None,None]
    top=np.array([10,15,32]); bot=np.array([2,4,10])
    g=(top*(1-yy)+bot*yy).astype(np.uint8)
    g=np.repeat(g,W,axis=1)
    bg=Image.fromarray(g,"RGB").convert("RGBA")
    add_shadow(bg)

    # continuous identity motion
    pulse=1+0.018*math.sin(t*math.pi*1.4)
    r=int(R*pulse)

    if t < 2.2:
        phase="ceramic"; p=t/2.2
        disc=radial_disc(((245,120,52),(115,42,24)),.25)
        bg.alpha_composite(disc)
        add_ring(bg,(255,188,110,255),18)
        # embossed warm dots
        dd=ImageDraw.Draw(bg)
        for a in (-65,-25,15,55,95):
            x=CX+int(210*math.cos(math.radians(a))); y=CY+int(210*math.sin(math.radians(a)))
            dd.ellipse((x-14,y-14,x+14,y+14),fill=(255,190,110,210))
        add_identity(bg,(255,211,156,230))

    elif t < 5.0:
        phase="chrome"; p=ease((t-2.2)/2.8)
        disc=radial_disc(((232,242,255),(33,43,62)),1.15)
        bg.alpha_composite(disc)
        add_ring(bg,(222,235,255,255),18)
        # bright bands CLIPPED to exact object mask
        bands=Image.new("RGBA",(W,H),(0,0,0,0)); bd=ImageDraw.Draw(bands)
        shift=int(110*math.sin(p*math.pi*1.25))
        for x,wid,ang in [(CX-175+shift,85,-10),(CX+15-shift//2,48,7),(CX+185-shift,70,16)]:
            bd.rounded_rectangle((x-wid,CY-R-35,x+wid,CY+R+35),radius=wid//2,fill=(255,255,255,205))
        bands=bands.rotate(-10+18*p,center=(CX,CY),resample=Image.Resampling.BICUBIC)
        bands.putalpha(Image.composite(bands.getchannel("A"),Image.new("L",(W,H),0),mask_circle(CX,CY,R)))
        bg.alpha_composite(bands)
        dark=Image.new("RGBA",(W,H),(0,0,0,0)); dd=ImageDraw.Draw(dark)
        dd.rectangle((CX-30,CY-R-20,CX+35,CY+R+20),fill=(14,20,34,190))
        dark=dark.rotate(30,center=(CX,CY),resample=Image.Resampling.BICUBIC)
        dark.putalpha(Image.composite(dark.getchannel("A"),Image.new("L",(W,H),0),mask_circle(CX,CY,R)))
        bg.alpha_composite(dark)
        add_identity(bg,(235,246,255,245))

    else:
        phase="crystal"; p=ease((t-5.0)/3.0)
        disc=radial_disc(((30,178,255),(7,28,98)),.6)
        bg.alpha_composite(disc)
        # cyan halo is separate FX layer by design
        halo=Image.new("RGBA",(W,H),(0,0,0,0)); hd=ImageDraw.Draw(halo)
        hr=int(R+42+14*math.sin(p*math.pi))
        hd.ellipse((CX-hr,CY-hr,CX+hr,CY+hr),outline=(30,225,255,125),width=22)
        halo=halo.filter(ImageFilter.GaussianBlur(10))
        bg.alpha_composite(halo)
        add_ring(bg,(82,238,255,255),22)
        # clipped facet grammar
        facets=Image.new("RGBA",(W,H),(0,0,0,0)); fd=ImageDraw.Draw(facets)
        for a in range(0,180,30):
            q=math.radians(a)
            x1=CX-int(R*.84*math.cos(q)); y1=CY-int(R*.84*math.sin(q))
            x2=CX+int(R*.84*math.cos(q)); y2=CY+int(R*.84*math.sin(q))
            fd.line((x1,y1,x2,y2),fill=(194,247,255,205),width=10)
        for rr in (105,210):
            fd.ellipse((CX-rr,CY-rr,CX+rr,CY+rr),outline=(118,230,255,170),width=8)
        facets.putalpha(Image.composite(facets.getchannel("A"),Image.new("L",(W,H),0),mask_circle(CX,CY,R)))
        bg.alpha_composite(facets)
        gem=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(gem)
        pts=[]
        for k in range(8):
            a=math.pi/4*k+math.pi/8; rr=92 if k%2==0 else 68
            pts.append((CX+rr*math.cos(a),CY+rr*math.sin(a)))
        gd.polygon(pts,fill=(94,235,255,225),outline=(225,255,255,255))
        gem=gem.filter(ImageFilter.GaussianBlur(1))
        bg.alpha_composite(gem)
        add_identity(bg,(220,252,255,240))

    # pedestal + minimal phase dots (not text-dependent)
    d=ImageDraw.Draw(bg)
    d.rounded_rectangle((270,1320,810,1460),radius=54,fill=(22,31,54,255),outline=(76,101,145,255),width=3)
    d.rounded_rectangle((350,1278,730,1318),radius=20,fill=(32,196,230,150))
    for j,x in enumerate((450,540,630)):
        active=(phase=="ceramic" and j==0) or (phase=="chrome" and j==1) or (phase=="crystal" and j==2)
        c=(94,238,255,255) if active else (66,76,98,180)
        d.ellipse((x-12,1540-12,x+12,1540+12),fill=c)
    return bg.convert("RGB")

for i in range(N):
    frame_img(i).save(os.path.join(OUT,f"frame_{i:04d}.png"),quality=95)

# deterministic mono audio with exact visual event onsets at 2.2s, 5.0s, 7.1s
SR=48000
events=[(2.2,520,0.18),(5.0,760,0.20),(7.1,980,0.28)]
samples=[]
for n in range(int(DUR*SR)):
    tt=n/SR
    v=0.0
    for st,freq,leng in events:
        dt=tt-st
        if 0 <= dt < leng:
            env=(1-dt/leng)**2
            v += 0.45*env*math.sin(2*math.pi*freq*dt)
            v += 0.16*env*math.sin(2*math.pi*freq*2.01*dt)
    samples.append(max(-0.95,min(0.95,v)))
with wave.open(os.path.join(OUT,"audio.wav"),"wb") as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes(b"".join(struct.pack("<h",int(v*32767)) for v in samples))

print("rendered",N,"frames")
