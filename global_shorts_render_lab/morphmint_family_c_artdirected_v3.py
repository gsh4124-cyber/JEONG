import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir=args[0]
frame=int(args[1])
os.makedirs(outdir, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=360
scene.render.resolution_y=640
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.fps=18
scene.world.color=(0.005,0.007,0.014)

def mat(name, base, metal=0, rough=.35, em=None, estr=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=base
    b.inputs['Metallic'].default_value=metal
    b.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=.22
    if em is not None and 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value=em
        b.inputs['Emission Strength'].default_value=estr
    return m

CERAMIC=mat('Ceramic',(0.88,0.25,0.055,1),.02,.48)
CERAMIC_HI=mat('CeramicHi',(1.0,0.52,0.20,1),.02,.32)
CHROME=mat('Chrome',(0.52,0.60,0.72,1),1.0,.18)
CHROME_DARK=mat('ChromeDark',(0.045,0.065,0.10,1),.95,.16)
WHITE=mat('WhiteStrip',(0.96,0.99,1.0,1),.12,.08,(1,1,1,1),2.0)
CRYSTAL=mat('Crystal',(0.035,0.36,0.98,1),.05,.12)
CRYSTAL_DARK=mat('CrystalDark',(0.015,0.10,0.42,1),.08,.18)
CYAN=mat('CyanGlow',(0.10,0.88,1.0,1),.02,.08,(0.08,0.72,1.0,1),3.0)
FACET=mat('Facet',(0.72,0.94,1.0,1),.03,.06,(0.16,0.55,1.0,1),1.4)
DARK=mat('Dark',(0.010,0.014,0.022,1),.25,.26)
PLATFORM=mat('Platform',(0.050,0.070,0.11,1),.70,.16)

def cube(name,loc,scale,material,bevel=.05,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=4
    o.data.materials.append(material)
    return o

def cyl(name,loc,radius,depth,material,rot=(math.pi/2,0,0),verts=96):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=.085; mod.segments=5
    bpy.ops.object.shade_smooth()
    return o

def torus(name,loc,major,minor,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=96,minor_segments=20,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    return o

# stage
cube('Floor',(0,.8,-3.75),(3.7,2.2,.18),DARK,.12)
cube('Pedestal',(0,.20,-2.25),(1.75,.85,.30),PLATFORM,.16)
cube('PedestalLight',(0,-.10,-1.92),(1.35,.05,.025),CYAN,.02)

# phase values
# ceramic 1-34, chrome morph 35-88, crystal 89-144
if frame <= 34:
    phase='ceramic'; t=0
elif frame <= 88:
    phase='chrome'; t=(frame-35)/(88-35)
else:
    phase='crystal'; t=(frame-89)/(144-89)

# object transform carries identity through all states
if phase=='ceramic':
    sx,sz,rot=1.0,1.0,math.radians(-5 + 6*frame/34)
elif phase=='chrome':
    w=math.sin(t*math.pi*3)
    sx=1.0 + .12*w
    sz=1.0 - .10*w
    rot=math.radians(2 + 14*math.sin(t*math.pi))
else:
    sx=1.0
    sz=1.0
    rot=math.radians(8 - 5*t)

# create common coin root
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,0,.15))
root=bpy.context.object; root.name='CoinRoot'
root.scale=(sx,1,sz)
root.rotation_euler=(0,rot,rot*.2)

# base material per phase
if phase=='ceramic':
    base_mat=CERAMIC; rim_mat=CERAMIC_HI
elif phase=='chrome':
    base_mat=CHROME; rim_mat=CHROME_DARK
else:
    base_mat=CRYSTAL; rim_mat=CRYSTAL_DARK

body=cyl('CoinBody',(0,-.28,.30),1.42,.32,base_mat); body.parent=root
rim=torus('OuterRim',(0,-.46,.30),1.15,.12,rim_mat); rim.parent=root
inner=torus('InnerRim',(0,-.48,.30),.67,.065,rim_mat); inner.parent=root
bar=cube('IdentityBar',(0,-.50,.30),(.13,.045,.68),rim_mat,.035); bar.parent=root

# ceramic grammar: matte warm body + embossed highlight dots
if phase=='ceramic':
    for i,a in enumerate((-55,-25,5,35,65)):
        r=.92; x=r*math.sin(math.radians(a)); z=.30+r*math.cos(math.radians(a))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.075,location=(x,-.51,z))
        o=bpy.context.object; o.name=f'CeramicDot{i}'; o.data.materials.append(CERAMIC_HI); o.parent=root

# chrome grammar: explicit bright reflection bands and dark contrast slash.
if phase=='chrome':
    # bands curve with coin via thin front geometry; strongest in center phase
    intensity=.75 + .25*math.sin(t*math.pi)
    for i,(x,w) in enumerate([(-.62,.16),(-.18,.10),(.54,.13)]):
        bnd=cube(f'ChromeBand{i}',(x,-.535,.30),(w*intensity,.022,1.03),WHITE,.025,rot=(0,0,math.radians(-13+i*7)))
        bnd.parent=root
    slash=cube('ChromeSlash',(.18,-.54,.26),(.11,.022,1.12),CHROME_DARK,.025,rot=(0,0,math.radians(31)))
    slash.parent=root
    # liquid edge beads during middle of chrome phase
    if .22 < t < .82:
        for i,a in enumerate(range(0,360,60)):
            rr=1.40
            x=rr*math.cos(math.radians(a)); z=.30+rr*math.sin(math.radians(a))
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.095,location=(x,-.34,z))
            o=bpy.context.object; o.name=f'ChromeBead{i}'; o.data.materials.append(CHROME); o.parent=root

# crystal grammar: cyan emissive rim + visible internal facets/spokes.
if phase=='crystal':
    glow=torus('CrystalGlowRim',(0,-.525,.30),1.22,.055,CYAN); glow.parent=root
    for i,a in enumerate(range(0,180,30)):
        spoke=cube(f'FacetSpoke{i}',(0,-.54,.30),(.032,.020,1.05),FACET,.014,rot=(0,0,math.radians(a)))
        spoke.parent=root
    # nested facet polygons (rings)
    for j,r in enumerate((.40,.78)):
        ring=torus(f'FacetRing{j}',(0,-.545,.30),r,.026,FACET)
        ring.parent=root
    # central gem
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.34,location=(0,-.58,.30))
    gem=bpy.context.object; gem.name='CenterGem'; gem.data.materials.append(CYAN); gem.parent=root

# payoff halo grows only final third
if frame >= 112:
    rr=1.65 + .08*math.sin((frame-112)/32*math.pi)
    torus('PayoffHalo',(0,.12,.30),rr,.045,CYAN)

# lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area('Key',(-4.0,-5.0,5.8),1750,4.8,(1.0,.72,.52),(0,0,.3))
area('Fill',(4.2,-3.6,1.2),1450,4.0,(.34,.56,1.0),(0,0,.3))
area('Rim',(0,2.2,5.8),1200,3.0,(.58,.82,1.0),(0,0,.7))
# dedicated frontal strips make chrome visibly silver instead of black.
area('StripL',(-2.5,-4.0,.6),1350,1.0,(1,1,1),(0,0,.2))
area('StripR',(2.6,-3.8,1.2),1200,1.0,(.72,.88,1.0),(0,0,.2))

# camera
bpy.ops.object.camera_add(location=(1.15,-13.8,.75))
cam=bpy.context.object; scene.camera=cam
cam.data.type='PERSP'; cam.data.lens=60
cam.rotation_euler=(Vector((0,0,.15))-cam.location).to_track_quat('-Z','Y').to_euler()

scene.frame_set(frame)
scene.render.filepath=os.path.join(outdir,f'morphmint_v3_{frame:04d}.png')
bpy.ops.render.render(write_still=True)
