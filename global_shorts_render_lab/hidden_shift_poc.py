import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
state=args[0]  # A / B / R
outdir=args[1]
os.makedirs(outdir,exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=270
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.012,0.010,0.016)
scene.render.film_transparent=False

# color management
scene.view_settings.look='AgX - Medium High Contrast'

def mat(name,base,metallic=0.0,rough=0.4,em=None,estr=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=base
    b.inputs['Metallic'].default_value=metallic
    b.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=0.16
    if em is not None and 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value=em
        b.inputs['Emission Strength'].default_value=estr
    return m

WOOD=mat('Walnut',(0.14,0.055,0.022,1),0.05,0.34)
WOOD2=mat('ShelfWood',(0.22,0.085,0.035,1),0.05,0.32)
WALL=mat('WarmWall',(0.20,0.17,0.16,1),0.0,0.72)
DARK=mat('DarkMetal',(0.025,0.03,0.04,1),0.76,0.20)
BRASS=mat('Brass',(0.62,0.26,0.045,1),0.78,0.19)
CERAMIC=mat('Ceramic',(0.80,0.82,0.86,1),0.05,0.22)
BLUE=mat('BlueRocket',(0.015,0.18,0.86,1),0.46,0.18)
RED=mat('RedRocket',(0.88,0.035,0.025,1),0.34,0.18)
WHITE=mat('WarmWhite',(0.88,0.77,0.59,1),0.02,0.35)
GREEN=mat('Leaf',(0.025,0.23,0.07,1),0.0,0.48)
TERR=mat('Terracotta',(0.42,0.11,0.035,1),0.0,0.52)
BOOK1=mat('Book1',(0.06,0.22,0.42,1),0.0,0.38)
BOOK2=mat('Book2',(0.46,0.08,0.055,1),0.0,0.38)
BOOK3=mat('Book3',(0.55,0.36,0.055,1),0.0,0.38)
FRAME=mat('Frame',(0.035,0.028,0.022,1),0.28,0.30)
ART=mat('Art',(0.50,0.22,0.10,1),0.0,0.48)
GLOW=mat('RevealGlow',(0.95,0.53,0.03,1),0.1,0.20,(1.0,0.22,0.02,1),4.5)

def cube(name,loc,scale,material,bevel=0.06,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=4
    o.data.materials.append(material); return o

def cyl(name,loc,radius,depth,material,rot=(0,0,0),verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=0.035; mod.segments=3
    return o

def uv(name,loc,radius,material,scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=radius,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material); return o

# room shell / desk
cube('BackWall',(0,1.15,0.45),(3.2,0.12,4.2),WALL,0.16)
cube('DeskTop',(0,0.05,-1.72),(2.75,0.95,0.16),WOOD,0.11)
cube('Shelf',(-0.55,0.35,1.25),(2.1,0.42,0.10),WOOD2,0.07)

# books on shelf
for i,(x,z,m,w,h) in enumerate([
    (-1.75,1.58,BOOK1,0.18,0.48),(-1.48,1.54,BOOK2,0.16,0.44),(-1.22,1.50,BOOK3,0.17,0.40)
]):
    cube(f'Book_{i}',(x,0.02,z),(w,0.28,h),m,0.035)

# picture frame + art
cube('PictureFrame',(1.33,0.30,1.76),(0.78,0.10,0.62),FRAME,0.05)
cube('PictureArt',(1.33,0.16,1.76),(0.66,0.025,0.50),ART,0.02)

# desk lamp
cyl('LampBase',(-1.85,-0.15,-1.37),0.36,0.12,DARK)
cyl('LampStem',(-1.85,-0.13,-0.46),0.075,1.75,DARK,rot=(0,0,0))
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=0.50,radius2=0.28,depth=0.58,location=(-1.85,-0.13,0.56),rotation=(math.radians(6),0,0))
shade=bpy.context.object; shade.data.materials.append(BRASS)
# bulb glow
uv('Bulb',(-1.85,-0.42,0.42),0.16,WHITE)

# mug
cyl('MugBody',(0.30,-0.18,-1.34),0.34,0.62,CERAMIC)
bpy.ops.mesh.primitive_torus_add(major_radius=0.31,minor_radius=0.07,major_segments=40,minor_segments=12,
                                location=(0.62,-0.18,-1.32),rotation=(math.pi/2,0,0))
bpy.context.object.data.materials.append(CERAMIC)

# plant pot
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=0.40,radius2=0.33,depth=0.62,location=(1.65,-0.05,-1.32))
pot=bpy.context.object; pot.data.materials.append(TERR)
for j,(dx,dz,ang) in enumerate([(-.18,.18,-28),(0,.30,0),(.18,.17,28),(-.08,.45,-8),(.10,.48,12)]):
    leaf=uv(f'Leaf_{j}',(1.65+dx,-0.06,-0.88+dz),0.22,GREEN,scale=(0.55,0.18,1.35))
    leaf.rotation_euler.y=math.radians(ang)

# clock on shelf
cyl('ClockBody',(0.15,0.02,1.63),0.42,0.10,DARK,rot=(math.pi/2,0,0))
cyl('ClockFace',(0.15,-0.05,1.63),0.36,0.025,CERAMIC,rot=(math.pi/2,0,0))
# hands as thin boxes
h1=cube('ClockHand1',(0.15,-0.085,1.78),(0.025,0.018,0.16),DARK,0.01)
h1.rotation_euler.y=math.radians(-18)
h2=cube('ClockHand2',(0.26,-0.085,1.58),(0.13,0.018,0.022),DARK,0.01)
h2.rotation_euler.y=math.radians(10)

# rocket target: fixed position, only yaw changes A vs B
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(-0.42,-0.03,1.64))
rocket=bpy.context.object; rocket.name='RocketPivot'
# horizontal body along local X
body=cyl('RocketBody',(-0.42,-0.03,1.64),0.17,0.78,BLUE,rot=(0,math.pi/2,0))
body.parent=rocket; body.matrix_parent_inverse=rocket.matrix_world.inverted()
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=0.18,radius2=0.0,depth=0.34,
                                location=(-0.03,-0.03,1.64),rotation=(0,math.pi/2,0))
nose=bpy.context.object; nose.data.materials.append(RED); nose.parent=rocket; nose.matrix_parent_inverse=rocket.matrix_world.inverted()
# fins
for z in (1.49,1.79):
    fin=cube('RocketFin',(-0.75,-0.03,z),(0.16,0.08,0.06),RED,0.03,rot=(0,0,math.radians(18 if z>1.6 else -18)))
    fin.parent=rocket; fin.matrix_parent_inverse=rocket.matrix_world.inverted()
# small window
uv('RocketWindow',(-0.24,-0.19,1.64),0.085,CERAMIC,scale=(1,0.25,1)).parent=rocket

if state in ('B','R'):
    rocket.rotation_euler.z=math.radians(180)

# subtle desk props
cube('Notebook',(-0.55,-0.30,-1.49),(0.55,0.38,0.05),BOOK1,0.04,rot=(0,0,math.radians(-8)))
cube('Pencil',(-0.28,-0.62,-1.38),(0.42,0.025,0.025),BRASS,0.015,rot=(0,0,math.radians(15)))

# reveal halo only in R
if state=='R':
    bpy.ops.mesh.primitive_torus_add(major_radius=0.60,minor_radius=0.055,major_segments=64,minor_segments=16,
                                    location=(-0.42,-0.28,1.64),rotation=(math.pi/2,0,0))
    halo=bpy.context.object; halo.data.materials.append(GLOW)

# lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.shape='DISK'; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area('WarmKey',(-2.8,-4.2,4.8),1100,4.2,(1.0,0.60,0.34),(0,0,0))
area('CoolFill',(3.8,-3.0,2.2),620,3.2,(0.30,0.48,1.0),(0,0,0.2))
area('TopRim',(0,2.8,4.0),900,3.0,(1.0,0.36,0.18),(0,0,0.4))
# lamp practical
bpy.ops.object.light_add(type='POINT',location=(-1.85,-0.55,0.40))
pl=bpy.context.object; pl.data.energy=210; pl.data.color=(1.0,0.42,0.16); pl.data.shadow_soft_size=0.5
if state=='R':
    bpy.ops.object.light_add(type='POINT',location=(-0.42,-0.80,1.64))
    q=bpy.context.object; q.data.energy=90; q.data.color=(1.0,0.15,0.03); q.data.shadow_soft_size=0.6

# camera fixed
bpy.ops.object.camera_add(location=(4.25,-8.6,2.05))
cam=bpy.context.object; scene.camera=cam
cam.data.lens=52
cam.rotation_euler=(Vector((0,0,0.05))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.dof.use_dof=True
cam.data.dof.focus_object=rocket
cam.data.dof.aperture_fstop=4.5

scene.render.filepath=os.path.join(outdir,f'hidden_shift_{state}.png')
bpy.ops.render.render(write_still=True)
