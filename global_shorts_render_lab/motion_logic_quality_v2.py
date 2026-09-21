import bpy, os, sys, math
from mathutils import Vector, Quaternion

args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir = args[0] if args else "."
os.makedirs(outdir, exist_ok=True)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=270
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.003,0.005,0.012)

def make_mat(name, base, metallic=0.0, rough=0.4, emission=None, strength=0.0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=base
    b.inputs["Metallic"].default_value=metallic
    b.inputs["Roughness"].default_value=rough
    if "Coat Weight" in b.inputs: b.inputs["Coat Weight"].default_value=0.22
    if emission and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value=emission
        b.inputs["Emission Strength"].default_value=strength
    return m

MAT_DARK=make_mat("V2_DarkMetal",(0.014,0.022,0.042,1),0.72,0.26)
MAT_EDGE=make_mat("V2_EdgeMetal",(0.08,0.12,0.19,1),0.8,0.2)
MAT_ORANGE=make_mat("V2_Paddle",(0.95,0.095,0.015,1),0.28,0.22)
MAT_BLUE=make_mat("V2_Ball",(0.012,0.12,0.95,1),0.9,0.12)
MAT_GREEN=make_mat("V2_Goal",(0.01,0.32,0.035,1),0.15,0.18,(0.02,1.0,0.09,1),4.2)
MAT_CYAN=make_mat("V2_Accent",(0.01,0.12,0.18,1),0.2,0.2,(0.02,0.55,0.9,1),2.2)

# Re-style original materials.
for m in bpy.data.materials:
    n=m.name.lower()
    if "ball" in n:
        m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value=(0.012,0.12,0.95,1); b.inputs["Metallic"].default_value=.9; b.inputs["Roughness"].default_value=.12
    elif "domino" in n:
        m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value=(0.95,0.095,0.015,1); b.inputs["Metallic"].default_value=.28; b.inputs["Roughness"].default_value=.22
    elif "ramp" in n:
        m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value=(0.028,0.045,0.085,1); b.inputs["Metallic"].default_value=.6; b.inputs["Roughness"].default_value=.27
    elif "floor" in n:
        m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value=(0.008,0.012,0.024,1); b.inputs["Metallic"].default_value=.15; b.inputs["Roughness"].default_value=.48
    elif "goal" in n:
        m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value=(0.01,0.32,0.035,1); b.inputs["Metallic"].default_value=.15; b.inputs["Roughness"].default_value=.18
        if "Emission Color" in b.inputs:
            b.inputs["Emission Color"].default_value=(0.02,1.0,0.09,1); b.inputs["Emission Strength"].default_value=4.2

def cube(name, loc, scale, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        md=o.modifiers.new("Bevel","BEVEL"); md.width=bevel; md.segments=3
    return o

# Mechanical cabinet/backplate fills the narrow dead space and provides visual depth.
back=cube("MachineBack",(0,1.05,0.45),(4.8,.10,1.35),MAT_DARK,.10)
railL=cube("RailL",(0,-.95,.55),(4.75,.08,.11),MAT_EDGE,.06)
railR=cube("RailR",(0,.95,.55),(4.75,.08,.11),MAT_EDGE,.06)

# Add repeated hinge housings / glowing status nodes.
xs=[-.45,.03,.51,.99,1.47,1.95,2.43]
for i,x in enumerate(xs):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.17, depth=.98, location=(x,0,.04), rotation=(math.radians(90),0,0))
    hub=bpy.context.object; hub.name=f"Hub_{i+1}"; hub.data.materials.append(MAT_EDGE)
    bpy.ops.mesh.primitive_torus_add(major_radius=.23, minor_radius=.035, location=(x,-.55,.18), rotation=(math.radians(90),0,0))
    led=bpy.context.object; led.name=f"Status_{i+1}"; led.data.materials.append(MAT_CYAN)

# Heavy entrance frame around ramp.
cube("EntryTop",(-3.55,0,2.25),(1.35,1.10,.10),MAT_EDGE,.06)
cube("EntryL",(-4.75,-1.02,1.20),(.10,.10,1.10),MAT_EDGE,.04)
cube("EntryR",(-4.75,1.02,1.20),(.10,.10,1.10),MAT_EDGE,.04)

# Larger goal portal: nested emissive rings + central lock disk.
for radius,minor in [(0.78,.07),(0.58,.045)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=minor, location=(3.10,0,.50), rotation=(math.radians(90),0,0))
    o=bpy.context.object; o.data.materials.append(MAT_GREEN)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.36, depth=.18, location=(3.10,.12,.50), rotation=(math.radians(90),0,0))
lock=bpy.context.object; lock.data.materials.append(MAT_GREEN)

# Goal pulse animation tied to end of cascade.
lock.scale=(.82,.82,.82); lock.keyframe_insert(data_path="scale",frame=60)
lock.scale=(1.25,1.25,1.25); lock.keyframe_insert(data_path="scale",frame=78)
lock.scale=(1.0,1.0,1.0); lock.keyframe_insert(data_path="scale",frame=90)

# Lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target=(0,0,.65)):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area("WarmKey",(-2.5,-4.2,6.8),1600,4.8,(1.0,.72,.52))
area("CoolFill",(3.7,-2.0,4.2),1000,4.0,(.42,.62,1.0))
area("Rim",(0,3.4,5.5),1250,3.2,(.42,.70,1.0))

# Perspective camera, roll long machine into portrait but retain depth.
cam=scene.camera
cam.data.type='PERSP'
cam.data.lens=64
cam.location=(0,-12.8,6.2)
direction=Vector((-0.1,0,.65))-cam.location
base=direction.to_track_quat('-Z','Y')
roll=Quaternion((0,0,1),math.radians(90))
cam.rotation_mode='QUATERNION'
cam.rotation_quaternion=base @ roll

for fno,name in [(1,"v2_start.png"),(60,"v2_action.png"),(90,"v2_payoff.png")]:
    scene.frame_set(fno)
    scene.render.filepath=os.path.join(outdir,name)
    bpy.ops.render.render(write_still=True)

with open(os.path.join(outdir,"v2_meta.txt"),"w") as f:
    f.write("V2_MECHANICAL_TOWER 270x480 frames 1,60,90\n")
