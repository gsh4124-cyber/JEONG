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
scene.frame_end=144
scene.world.color=(0.004,0.006,0.012)

def princ(mat):
    return mat.node_tree.nodes.get('Principled BSDF')

# animated material shared by all coin parts
coin_mat=bpy.data.materials.new('MorphCoin')
coin_mat.use_nodes=True
b=princ(coin_mat)
# start ceramic
b.inputs['Base Color'].default_value=(0.58,0.16,0.05,1)
b.inputs['Metallic'].default_value=0.02
b.inputs['Roughness'].default_value=0.38
if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=0.18

for f in (1,24):
    b.inputs['Base Color'].keyframe_insert('default_value',frame=f)
    b.inputs['Metallic'].keyframe_insert('default_value',frame=f)
    b.inputs['Roughness'].keyframe_insert('default_value',frame=f)
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].keyframe_insert('default_value',frame=f)

# liquid chrome state
b.inputs['Base Color'].default_value=(0.14,0.18,0.24,1)
b.inputs['Metallic'].default_value=1.0
b.inputs['Roughness'].default_value=0.07
if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=0.45
for f in (54,78):
    b.inputs['Base Color'].keyframe_insert('default_value',frame=f)
    b.inputs['Metallic'].keyframe_insert('default_value',frame=f)
    b.inputs['Roughness'].keyframe_insert('default_value',frame=f)
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].keyframe_insert('default_value',frame=f)

# crystalline glossy state
b.inputs['Base Color'].default_value=(0.035,0.30,0.82,1)
b.inputs['Metallic'].default_value=0.16
b.inputs['Roughness'].default_value=0.05
if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=0.70
if 'Transmission Weight' in b.inputs:
    b.inputs['Transmission Weight'].default_value=0.0
    b.inputs['Transmission Weight'].keyframe_insert('default_value',frame=78)
    b.inputs['Transmission Weight'].default_value=0.62
    b.inputs['Transmission Weight'].keyframe_insert('default_value',frame=112)
    b.inputs['Transmission Weight'].keyframe_insert('default_value',frame=144)
for f in (112,144):
    b.inputs['Base Color'].keyframe_insert('default_value',frame=f)
    b.inputs['Metallic'].keyframe_insert('default_value',frame=f)
    b.inputs['Roughness'].keyframe_insert('default_value',frame=f)
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].keyframe_insert('default_value',frame=f)

# supporting materials
def mat(name,base,metal=0,rough=.4,em=None,estr=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=princ(m)
    p.inputs['Base Color'].default_value=base
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in p.inputs: p.inputs['Coat Weight'].default_value=.2
    if em is not None and 'Emission Color' in p.inputs:
        p.inputs['Emission Color'].default_value=em
        p.inputs['Emission Strength'].default_value=estr
    return m

DARK=mat('Dark',(0.009,0.012,0.020,1),.35,.24)
PLATFORM=mat('Platform',(0.055,0.072,0.105,1),.72,.16)
BLUEGLOW=mat('Glow',(0.03,0.50,1.0,1),.12,.16,(0.03,0.45,1.0,1),2.2)

def cube(name,loc,scale,material,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=5
    o.data.materials.append(material); return o

# floor/pedestal
cube('Floor',(0,.7,-3.55),(3.6,2.3,.18),DARK,.12)
cube('Pedestal',(0,.20,-2.15),(1.65,.85,.28),PLATFORM,.18)
cube('PedestalGlow',(0,-.12,-1.86),(1.35,.06,.035),BLUEGLOW,.03)

# coin parent
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0,0,0.10))
root=bpy.context.object; root.name='CoinRoot'

# main coin
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.38,depth=.30,location=(0,-.25,.30),rotation=(math.pi/2,0,0))
coin=bpy.context.object; coin.name='CoinBody'; coin.data.materials.append(coin_mat)
bevel=coin.modifiers.new('CoinBevel','BEVEL'); bevel.width=.12; bevel.segments=6
bpy.ops.object.shade_smooth()
coin.parent=root

# rim
bpy.ops.mesh.primitive_torus_add(major_radius=1.10,minor_radius=.115,major_segments=96,minor_segments=24,
                                location=(0,-.42,.30),rotation=(math.pi/2,0,0))
rim=bpy.context.object; rim.name='CoinRim'; rim.data.materials.append(coin_mat); rim.parent=root

# inner emboss ring
bpy.ops.mesh.primitive_torus_add(major_radius=.62,minor_radius=.065,major_segments=72,minor_segments=18,
                                location=(0,-.44,.30),rotation=(math.pi/2,0,0))
inner=bpy.context.object; inner.name='CoinInner'; inner.data.materials.append(coin_mat); inner.parent=root

# simple embossed bar symbol for identity anchor
bar=cube('EmbossBar',(0,-.46,.30),(.12,.05,.64),coin_mat,.045)
bar.parent=root

# liquid deformation: scale/shear illusion on same assembly; returns to original for crystal
for f,scale,rot,z in [
    (1,(1,1,1),0,.10),
    (24,(1,1,1),0,.10),
    (54,(1.10,.94,.86),-8,-.02),
    (66,(.92,1.06,1.18),7,.02),
    (78,(1.08,.95,.90),-5,-.03),
    (112,(1,1,1),0,.10),
    (144,(1,1,1),0,.10),
]:
    root.scale=scale
    root.rotation_euler=(0,math.radians(rot),math.radians(rot*.45))
    root.location.z=z
    root.keyframe_insert('scale',frame=f)
    root.keyframe_insert('rotation_euler',frame=f)
    root.keyframe_insert('location',frame=f)

# slight continuous turn for specular evolution
root.rotation_euler.y=math.radians(-8); root.keyframe_insert('rotation_euler',frame=1)
root.rotation_euler.y=math.radians(8); root.keyframe_insert('rotation_euler',frame=144)

# glow payoff behind final crystal state only
bpy.ops.mesh.primitive_torus_add(major_radius=1.75,minor_radius=.045,major_segments=96,minor_segments=14,
                                location=(0,.10,.30),rotation=(math.pi/2,0,0))
halo=bpy.context.object; halo.name='FinalHalo'; halo.data.materials.append(BLUEGLOW)
halo.scale=(0,0,0); halo.keyframe_insert('scale',frame=100)
halo.scale=(1.0,1.0,1.0); halo.keyframe_insert('scale',frame=116)
halo.scale=(1.10,1.10,1.10); halo.keyframe_insert('scale',frame=126)
halo.scale=(1.0,1.0,1.0); halo.keyframe_insert('scale',frame=144)

# lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area('WarmKey',(-4.0,-5.0,5.8),1500,4.5,(1.0,.66,.45),(0,0,.2))
area('CoolFill',(4.2,-3.2,1.4),1100,3.8,(.25,.48,1.0),(0,0,.3))
area('TopRim',(0,2.4,5.5),1200,3.2,(.55,.75,1.0),(0,0,.6))

# camera
bpy.ops.object.camera_add(location=(2.25,-13.5,1.15))
cam=bpy.context.object; scene.camera=cam
cam.data.type='PERSP'; cam.data.lens=62
cam.rotation_euler=(Vector((0,0,.05))-cam.location).to_track_quat('-Z','Y').to_euler()

scene.frame_set(frame)
scene.render.filepath=os.path.join(outdir,f'morphmint_{frame:04d}.png')
bpy.ops.render.render(write_still=True)
