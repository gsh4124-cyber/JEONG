import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
variant=args[0]
outdir=args[1]
frame=int(args[2])
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
scene.world.color=(0.012,0.016,0.025)

def mat(name,base,metal=0,rough=.4,em=None,estr=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=base
    b.inputs['Metallic'].default_value=metal
    b.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=.16
    if em is not None and 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value=em
        b.inputs['Emission Strength'].default_value=estr
    return m

WOOD=mat('Wood',(0.20,0.075,0.028,1),.05,.42)
WALL=mat('Wall',(0.11,0.135,0.18,1),0,.60)
METAL=mat('Metal',(0.12,0.17,0.24,1),.78,.18)
CREAM=mat('Cream',(0.80,0.72,0.56,1),0,.42)
RED=mat('Red',(0.78,0.035,0.024,1),.08,.30)
BLUE=mat('Blue',(0.03,0.15,0.72,1),.10,.25)
GREEN=mat('Green',(0.045,0.34,0.14,1),.05,.35)
YELLOW=mat('Yellow',(0.94,0.54,0.03,1),.10,.28)
BLACK=mat('Black',(0.018,0.02,0.025,1),.10,.28)
WHITE=mat('White',(0.86,0.89,0.94,1),.04,.32)
GOLD=mat('Gold',(0.72,0.40,0.055,1),.72,.20)
GLOW=mat('Glow',(0.08,0.75,1.0,1),.1,.15,(0.08,0.75,1.0,1),4.0)

def cube(name,loc,scale,material,bevel=.06,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=4
    o.data.materials.append(material); return o

def cyl(name,loc,radius,depth,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=.035; mod.segments=3
    return o

def torus(name,loc,major,minor,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=56,minor_segments=14,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material); return o

def add_reveal(loc):
    if frame >= 132:
        ring=torus('RevealRing',loc,.62,.055,GLOW)
        pulse=1.10 if 140 <= frame <= 150 else 1.0
        ring.scale=(pulse,pulse,pulse)

def add_light(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

# shared camera helper
def fixed_camera(target=(0,0,.1),scale=10.4):
    bpy.ops.object.camera_add(location=(0,-13.9,.25))
    cam=bpy.context.object; scene.camera=cam
    cam.data.type='ORTHO'; cam.data.ortho_scale=scale
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()

if variant == 'kitchen':
    # warm kitchen counter
    cube('BackWall',(0,1.35,0),(3.4,.18,5.4),WALL,.15)
    cube('Counter',(0,.55,-3.78),(3.3,1.0,.28),WOOD,.12)
    cube('UpperShelf',(0,.55,2.65),(2.65,.50,.12),METAL,.08)
    cube('LowerShelf',(0,.55,.70),(2.65,.50,.12),METAL,.08)

    # static jars / cups / plant
    for i,(x,m) in enumerate([(-2.0,RED),(-1.42,CREAM),(-.84,BLUE),(.95,GREEN),(1.55,CREAM),(2.05,YELLOW)]):
        cyl(f'Jar{i}',(x,-.05,1.30),.24,.78,m)
    # plates
    for i,x in enumerate((-1.9,-1.45,-1.0)):
        cyl(f'Plate{i}',(x,-.08,-.05),.38,.08,WHITE)
    # fruit bowl
    torus('Bowl',(1.45,-.06,-.35),.52,.12,GOLD)
    for j,(dx,dz,m) in enumerate([(-.25,.18,RED),(0,.28,YELLOW),(.26,.15,GREEN)]):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.23,location=(1.45+dx,-.10,-.18+dz))
        bpy.context.object.data.materials.append(m)
    # kettle
    cyl('Kettle',(0,-.08,-.18),.52,.70,METAL)
    torus('Handle',(0,-.30,.02),.58,.08,BLACK,rot=(0,0,0))

    # target: blue mug moves slightly left between states
    tx=.30 if frame <=72 else -.18
    cyl('TargetMug',(tx,-.15,3.25),.36,.62,BLUE)
    torus('MugHandle',(tx+.42,-.14,3.25),.20,.055,BLUE,rot=(0,0,0))
    add_reveal((tx,-.45,3.25))

    add_light('Key',(-3.8,-5.0,5.6),1250,5.0,(1.0,.78,.60),(0,0,.2))
    add_light('Fill',(4.2,-3.0,1.0),720,4.0,(.35,.52,1.0),(0,0,0))
    add_light('Top',(0,1.0,6.0),850,3.0,(1.0,.88,.70),(0,0,1.5))
    fixed_camera(scale=10.3)

elif variant == 'workbench':
    # workshop / maker wall
    cube('BackWall',(0,1.4,0),(3.4,.18,5.4),WALL,.15)
    cube('Bench',(0,.65,-3.75),(3.3,1.0,.30),WOOD,.12)
    cube('Pegboard',(0,.55,1.15),(2.75,.18,2.95),CREAM,.10)
    # peg dots as small cylinders
    for x in [-2.2,-1.5,-.8,-.1,.6,1.3,2.0]:
        for z in [-1.0,-.3,.4,1.1,1.8,2.5,3.2]:
            cyl('Peg',(x,-.26,z),.035,.06,BLACK)

    # static tools
    cube('HammerHead',(-1.75,-.28,2.15),(.42,.10,.18),METAL,.05)
    cube('HammerHandle',(-1.75,-.28,1.42),(.10,.08,.62),WOOD,.04)
    wrench=cube('Wrench',(1.55,-.28,1.85),(.13,.08,.72),METAL,.04,rot=(0,math.radians(12),0))
    cube('RedBox',(-1.45,-.10,-2.55),(.80,.38,.38),RED,.08)
    cube('BlueBox',(.35,-.10,-2.55),(.70,.38,.38),BLUE,.08)
    cyl('Can',(1.85,-.12,-2.45),.30,.72,YELLOW)

    # target: yellow screwdriver rotates 90° only after change
    angle=0 if frame<=72 else math.radians(90)
    target=cube('TargetScrewdriver',(.35,-.30,2.75),(.10,.08,.78),YELLOW,.05,rot=(0,angle,0))
    cube('DriverTip',(.35,-.30,1.95),(.055,.07,.20),METAL,.03,rot=(0,angle,0))
    add_reveal((.35,-.48,2.55))

    add_light('Key',(-3.6,-5.2,5.4),1180,4.7,(1.0,.72,.55),(0,0,.5))
    add_light('Fill',(4.2,-3.2,1.0),760,4.0,(.32,.54,1.0),(0,0,.2))
    add_light('Top',(0,1.2,6.2),900,3.0,(1.0,.86,.66),(0,0,1.6))
    fixed_camera(scale=10.4)
else:
    raise RuntimeError('unknown variant')

scene.frame_set(frame)
scene.render.filepath=os.path.join(outdir,f'{variant}_{frame:04d}.png')
bpy.ops.render.render(write_still=True)
