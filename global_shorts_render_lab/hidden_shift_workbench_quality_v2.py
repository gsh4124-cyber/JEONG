import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir=args[0]
frame=int(args[1])
os.makedirs(outdir,exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=720
scene.render.resolution_y=1280
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.fps=18
scene.frame_start=1
scene.frame_end=162
scene.world.color=(0.006,0.009,0.016)

def mat(name,base,metal=0,rough=.4,em=None,estr=0):
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

WALL=mat('Wall',(0.018,0.024,0.038,1),0,.55)
PEG=mat('Pegboard',(0.17,0.19,0.21,1),.10,.48)
WOOD=mat('Wood',(0.24,0.075,0.020,1),.06,.34)
EDGEWOOD=mat('EdgeWood',(0.42,0.15,0.028,1),.08,.28)
METAL=mat('Metal',(0.24,0.30,0.38,1),.86,.14)
DARK=mat('Dark',(0.010,0.013,0.020,1),.35,.24)
RED=mat('Red',(0.86,0.025,0.018,1),.18,.25)
BLUE=mat('Blue',(0.015,0.16,0.82,1),.18,.20)
GREEN=mat('Green',(0.025,0.42,0.16,1),.08,.32)
YELLOW=mat('Yellow',(1.0,0.52,0.015,1),.15,.20)
WHITE=mat('White',(0.88,0.91,0.97,1),.10,.24)
ORANGE=mat('Orange',(0.95,0.14,0.012,1),.18,.23)
GLOW=mat('Glow',(0.04,0.78,1.0,1),.05,.12,(0.05,0.85,1.0,1),5.5)

def cube(name,loc,scale,material,bevel=.06,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=5
    o.data.materials.append(material)
    return o

def cyl(name,loc,radius,depth,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=.025; mod.segments=3
    return o

def torus(name,loc,major,minor,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=72,minor_segments=18,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material); return o

def parent_keep(o,p):
    o.parent=p; o.matrix_parent_inverse=p.matrix_world.inverted()

# Room shell for real depth.
cube('BackWall',(0,1.55,0),(3.65,.20,5.65),WALL,.18)
cube('LeftWall',(-3.55,.45,0),(.16,1.30,5.65),WALL,.14)
cube('RightWall',(3.55,.45,0),(.16,1.30,5.65),WALL,.14)
cube('Floor',(0,.70,-4.95),(3.65,1.55,.18),DARK,.10)

# Premium workbench.
cube('BenchTop',(0,.30,-3.55),(3.25,.82,.24),WOOD,.13)
cube('BenchFront',(0,.65,-4.20),(3.08,.55,.42),EDGEWOOD,.10)
for x in (-2.65,2.65):
    cube('BenchLeg',(x,.65,-4.55),(.18,.38,.80),METAL,.08)

# inset pegboard with metal border.
cube('Pegboard',(0,.58,.75),(2.75,.15,3.15),PEG,.12)
cube('PegTop',(0,.35,3.88),(2.92,.10,.11),METAL,.06)
cube('PegBottom',(0,.35,-2.38),(2.92,.10,.11),METAL,.06)
cube('PegLeft',(-2.82,.35,.75),(.10,.10,3.25),METAL,.06)
cube('PegRight',(2.82,.35,.75),(.10,.10,3.25),METAL,.06)

# Peg pattern.
for x in (-2.25,-1.65,-1.05,-.45,.15,.75,1.35,1.95,2.55):
    for z in (-1.85,-1.25,-.65,-.05,.55,1.15,1.75,2.35,2.95,3.55):
        cyl('Peg',(x,.35,z),.027,.045,DARK)

# Static tools & storage.
cube('HammerHead',(-1.92,.18,2.35),(.42,.12,.20),METAL,.06)
cube('HammerHandle',(-1.92,.18,1.55),(.095,.10,.65),WOOD,.04)

# wrench
w=cube('Wrench',(1.72,.18,2.05),(.13,.10,.78),METAL,.045,rot=(0,math.radians(10),0))
# pliers stylized
cube('PliersL',(-.85,.18,2.35),(.08,.09,.56),RED,.035,rot=(0,math.radians(-12),0))
cube('PliersR',(-.55,.18,2.32),(.08,.09,.56),RED,.035,rot=(0,math.radians(12),0))
# blue ruler
cube('Ruler',(2.25,.18,.25),(.10,.09,.90),BLUE,.035,rot=(0,math.radians(-8),0))
# tape measure
cube('Tape',(-1.60,.10,-1.15),(.42,.20,.34),ORANGE,.10)
torus('TapeRing',(-1.60,-.12,-1.15),.20,.045,DARK)
# storage bins
cube('BinRed',(-1.25,-.02,-2.98),(.72,.34,.36),RED,.09)
cube('BinBlue',(.45,-.02,-2.98),(.72,.34,.36),BLUE,.09)
cube('BinGreen',(2.00,-.02,-2.98),(.55,.34,.36),GREEN,.09)

# small fasteners add texture without meaningful change.
for i,x in enumerate((-2.15,-1.82,-1.49,1.05,1.38,1.71)):
    cyl(f'Fastener{i}',(x,-.04,-3.18),.075,.09,WHITE)

# Target: one rigid screwdriver assembly. Only this changes between states.
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(.35,.16,1.02))
pivot=bpy.context.object; pivot.name='TargetScrewdriverPivot'
handle=cube('TargetHandle',(.35,.16,1.50),(.12,.11,.48),YELLOW,.055)
shaft=cube('TargetShaft',(.35,.16,.82),(.055,.07,.28),METAL,.025)
parent_keep(handle,pivot); parent_keep(shaft,pivot)
if frame>72:
    pivot.rotation_euler.y=math.radians(90)

# subtle hook behind target, unchanged.
cyl('TargetHook',(.35,.25,1.95),.08,.06,METAL)

# Reveal ring is a late-state overlay only.
if frame>=132:
    ring=torus('RevealRing',(.35,-.14,1.12),.76,.055,GLOW)
    if 140<=frame<=150: ring.scale=(1.10,1.10,1.10)

# task lamp for depth.
cyl('LampStem',(-2.75,.55,-1.90),.08,1.55,METAL,rot=(0,0,0))
cube('LampArm',(-2.45,.20,-.92),(.55,.08,.08),METAL,.04,rot=(0,math.radians(-28),0))
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.46,radius2=.22,depth=.46,location=(-2.10,.03,-.55),rotation=(math.pi/2,0,math.radians(25)))
bpy.context.object.data.materials.append(METAL)

# lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area('WarmKey',(-4.2,-4.6,5.8),1550,4.5,(1.0,.70,.48),(0,0,.3))
area('CoolFill',(4.4,-3.8,1.6),900,4.0,(.30,.48,1.0),(0,0,.2))
area('TopRim',(0,2.3,6.5),1100,3.0,(.70,.82,1.0),(0,0,1.4))
# focused task pool
bpy.ops.object.light_add(type='POINT',location=(-2.05,-.85,-.45))
pl=bpy.context.object; pl.data.energy=140; pl.data.color=(1.0,.64,.34); pl.data.shadow_soft_size=.65

# fixed perspective camera for depth, no animation.
bpy.ops.object.camera_add(location=(1.10,-15.7,.55))
cam=bpy.context.object; scene.camera=cam
cam.data.type='PERSP'; cam.data.lens=58
cam.rotation_euler=(Vector((0,0,.15))-cam.location).to_track_quat('-Z','Y').to_euler()

scene.frame_set(frame)
scene.render.filepath=os.path.join(outdir,f'workbench_q2_{frame:04d}.png')
bpy.ops.render.render(write_still=True)
