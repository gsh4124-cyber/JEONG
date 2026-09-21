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
scene.render.resolution_x=270
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.fps=18
scene.frame_start=1
scene.frame_end=162
scene.world.color=(0.018,0.022,0.035)

def mat(name,base,metal=0,rough=0.4, emission=None, estr=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=base
    b.inputs['Metallic'].default_value=metal
    b.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=.16
    if emission is not None and 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value=emission
        b.inputs['Emission Strength'].default_value=estr
    return m

WOOD=mat('WarmWood',(0.20,0.075,0.028,1),0.05,.42)
WALL=mat('Wall',(0.12,0.145,0.19,1),0,.58)
SHELF=mat('Shelf',(0.055,0.065,0.09,1),0.22,.31)
CREAM=mat('Cream',(0.78,0.70,0.53,1),0,.42)
RED=mat('Red',(0.82,0.035,0.026,1),0.05,.30)
BLUE=mat('Blue',(0.025,0.13,0.72,1),0.12,.24)
GREEN=mat('Green',(0.04,0.34,0.14,1),0.04,.36)
GOLD=mat('Gold',(0.72,0.40,0.055,1),.72,.20)
BLACK=mat('Black',(0.018,0.020,0.025,1),.1,.30)
WHITE=mat('White',(0.83,0.86,0.91,1),.05,.32)
GLOW=mat('Glow',(0.08,0.75,1.0,1),.1,.15,(0.08,0.75,1.0,1),4.0)

def cube(name,loc,scale,material,bevel=.06):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=4
    o.data.materials.append(material)
    return o

def cyl(name,loc,radius,depth,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=.035; mod.segments=3
    return o

# Set: stylized reading nook, enough detail to make spotting non-trivial but controlled.
cube('BackWall',(0,1.55,0),(3.4,.18,5.4),WALL,.14)
cube('Floor',(0,.8,-4.72),(3.4,2.0,.18),WOOD,.12)

# shelving frame
cube('ShelfFrameL',(-2.45,.4,.25),(.14,.38,3.65),SHELF,.08)
cube('ShelfFrameR',(2.45,.4,.25),(.14,.38,3.65),SHELF,.08)
for z in (-3.15,-1.35,.45,2.25,3.85):
    cube('Shelf', (0,.4,z),(2.55,.42,.11),SHELF,.07)

# books / objects, all static
book_specs=[
(-1.95,-2.55,.32,.58,RED),(-1.48,-2.50,.28,.63,CREAM),(-1.05,-2.52,.26,.60,BLUE),
(-.58,-2.50,.23,.62,GREEN),(.10,-2.52,.27,.60,CREAM),(.55,-2.50,.24,.62,RED),
(1.15,-2.50,.30,.60,BLUE),(1.70,-2.50,.25,.62,GREEN),
(-1.78,-.72,.28,.55,BLUE),(-1.30,-.72,.24,.55,CREAM),(-.85,-.70,.26,.57,RED),
(.60,-.72,.25,.56,GREEN),(1.05,-.72,.25,.56,CREAM),(1.52,-.72,.29,.57,BLUE),
(-1.86,1.05,.26,.54,GREEN),(-1.41,1.05,.24,.54,RED),(-.95,1.05,.24,.54,CREAM),
(.85,1.05,.28,.54,BLUE),(1.32,1.05,.24,.54,GREEN),(1.75,1.05,.26,.54,CREAM),
]
for i,(x,z,w,h,m) in enumerate(book_specs):
    cube(f'Book{i}',(x,-.08,z),(w,.28,h),m,.035)

# decor
cyl('ClockBody',(0.0,-.10,1.10),.62,.18,BLACK)
cyl('ClockFace',(0.0,-.31,1.10),.49,.04,WHITE)
# hands
h1=cube('Hand1',(0,-.36,1.26),(.035,.02,.26),BLACK,.02); h1.rotation_euler.y=math.radians(-25)
h2=cube('Hand2',(.12,-.36,1.03),(.035,.02,.20),BLACK,.02); h2.rotation_euler.y=math.radians(55)

# plant right bottom
cyl('Pot',(1.55,-.10,-1.75),.46,.70,GOLD,rot=(math.pi/2,0,0))
for i,ang in enumerate((-38,-18,4,26,46)):
    leaf=cube(f'Leaf{i}',(1.55 + .38*math.sin(math.radians(ang)),-.18,-.98 + .18*math.cos(math.radians(ang))),(.08,.06,.55),GREEN,.05)
    leaf.rotation_euler.y=math.radians(ang)

# picture frame upper shelf
cube('Frame',(-.78,-.06,3.10),(.60,.09,.48),GOLD,.07)
cube('FrameInner',(-.78,-.17,3.10),(.48,.035,.36),CREAM,.03)

# target object: small golden hourglass at upper-right shelf.
# It shifts from x=1.15 to x=1.65 only during the hidden change cut.
base=cube('HourglassBase',(1.15,-.15,3.10),(.32,.16,.08),GOLD,.04)
top=cube('HourglassTop',(1.15,-.15,3.74),(.32,.16,.08),GOLD,.04)
stem=cyl('HourglassStem',(1.15,-.14,3.42),.14,.55,CREAM)
for o in (base,top,stem):
    o.keyframe_insert('location',frame=1)
    o.keyframe_insert('location',frame=72)
    o.location.x += .50
    o.keyframe_insert('location',frame=73)
    o.keyframe_insert('location',frame=162)

# reveal ring exists only late
bpy.ops.mesh.primitive_torus_add(major_radius=.62,minor_radius=.055,major_segments=64,minor_segments=14,
    location=(1.65,-.48,3.42),rotation=(math.pi/2,0,0))
ring=bpy.context.object; ring.name='RevealRing'; ring.data.materials.append(GLOW)
ring.scale=(0,0,0); ring.keyframe_insert('scale',frame=124)
ring.scale=(1.0,1.0,1.0); ring.keyframe_insert('scale',frame=132)
ring.scale=(1.10,1.10,1.10); ring.keyframe_insert('scale',frame=146)
ring.scale=(1.0,1.0,1.0); ring.keyframe_insert('scale',frame=162)

# lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area('Key',(-3.8,-5.2,5.8),1200,5.0,(1.0,.76,.58),(0,0,.2))
area('Fill',(4.2,-3.4,1.4),750,4.0,(.34,.52,1.0),(0,0,0))
area('Top',(0,1.4,6.2),900,3.0,(1.0,.86,.68),(0,0,1.5))

# fixed camera: absolute lock.
bpy.ops.object.camera_add(location=(0,-13.9,.20))
cam=bpy.context.object; scene.camera=cam
cam.data.type='ORTHO'; cam.data.ortho_scale=10.5
cam.rotation_euler=(Vector((0,0,.10))-cam.location).to_track_quat('-Z','Y').to_euler()

scene.frame_set(frame)
scene.render.filepath=os.path.join(outdir,f'hidden_shift_{frame:04d}.png')
bpy.ops.render.render(write_still=True)
