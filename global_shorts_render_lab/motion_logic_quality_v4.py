import bpy, os, sys, math
from mathutils import Vector, Quaternion

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir=args[0] if args else "."
os.makedirs(outdir, exist_ok=True)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=270
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.002,0.004,0.010)

def make_mat(name, base, metallic=0.0, rough=0.4, emission=None, strength=0.0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=base
    b.inputs["Metallic"].default_value=metallic
    b.inputs["Roughness"].default_value=rough
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value=0.22
    if emission and "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value=emission
        b.inputs["Emission Strength"].default_value=strength
    return m

DARK=make_mat("V4_Dark",(0.010,0.018,0.036,1),0.72,0.24)
MID=make_mat("V4_Mid",(0.045,0.075,0.13,1),0.78,0.20)
ORANGE=make_mat("V4_Orange",(1.0,0.10,0.012,1),0.30,0.18)
BLUE=make_mat("V4_Blue",(0.005,0.10,1.0,1),0.92,0.10)
GREEN=make_mat("V4_Green",(0.004,0.18,0.018,1),0.16,0.14,(0.01,1.0,0.07,1),0.25)
CYAN=make_mat("V4_Cyan",(0.005,0.10,0.16,1),0.2,0.16,(0.01,0.55,1.0,1),2.5)
GOLD=make_mat("V4_Gold",(0.95,0.42,0.025,1),0.55,0.16,(1.0,0.28,0.01,1),2.2)

# Restyle core dynamic objects.
for o in bpy.data.objects:
    n=o.name.lower()
    if n=="bluemarble":
        o.data.materials.clear(); o.data.materials.append(BLUE)
    elif n.startswith("domino_"):
        o.data.materials.clear(); o.data.materials.append(ORANGE)
    elif n in {"goalbell","goalring","successgate"}:
        if getattr(o,"data",None):
            o.data.materials.clear(); o.data.materials.append(GREEN)
    elif n in {"ramp","impactbridge"} or n.startswith("rail"):
        if getattr(o,"data",None):
            o.data.materials.clear(); o.data.materials.append(MID)
    elif n=="ground":
        o.data.materials.clear(); o.data.materials.append(DARK)

def cube(name,loc,scale,mat,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        md=o.modifiers.new("Bevel","BEVEL"); md.width=bevel; md.segments=4
    return o

# Delete decorative leftovers from earlier quality experiments.
for o in list(bpy.data.objects):
    if o.name.startswith(("V2_","V4_","Hub_","Status_","Entry","Machine","Portal","SideWall","Deck")):
        bpy.data.objects.remove(o,do_unlink=True)

# A compact machine deck/backplate creates a designed object instead of a physics demo.
deck=cube("Deck",(0,0,-0.02),(4.85,1.12,0.08),DARK,.10)
back=cube("MachineBack",(0,1.12,0.70),(4.85,.09,1.15),DARK,.10)
# Side ribs create perspective/parallax but do not obscure the mechanism.
for x in (-4.65,2.80):
    cube(f"SideWall_{x}",(x,0.72,0.75),(.09,.38,1.05),MID,.05)

# Hinge housings and status LEDs for 5 paddles.
xs=[-0.35,0.25,0.85,1.45,2.05]
for i,x in enumerate(xs):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.16,depth=.78,
        location=(x,0,.08),rotation=(math.radians(90),0,0))
    hub=bpy.context.object; hub.name=f"V4_Hub_{i+1}"; hub.data.materials.append(MID)

    bpy.ops.mesh.primitive_torus_add(major_radius=.22,minor_radius=.035,
        location=(x,-.52,.18),rotation=(math.radians(90),0,0))
    led=bpy.context.object; led.name=f"V4_Status_{i+1}"; led.data.materials.append(CYAN)

# Entrance collar around the blue marble path.
cube("V4_EntryTop",(-3.60,0,2.10),(1.15,1.0,.08),MID,.06)
cube("V4_EntryL",(-4.62,-.88,1.18),(.08,.08,.92),MID,.04)
cube("V4_EntryR",(-4.62,.88,1.18),(.08,.08,.92),MID,.04)

# Purpose-built goal portal at the bottom/end.
portal_x=2.95
for radius,minor in [(0.88,.075),(0.64,.045)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=minor,
        location=(portal_x,0,.58),rotation=(math.radians(90),0,0))
    o=bpy.context.object; o.name="V4_PortalRing"; o.data.materials.append(GREEN)

bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.34,depth=.16,
    location=(portal_x,.10,.58),rotation=(math.radians(90),0,0))
lock=bpy.context.object; lock.name="V4_PortalCore"; lock.data.materials.append(GREEN)

# Strong payoff: portal stays dim during action, then lights hard.
green_bsdf=GREEN.node_tree.nodes.get("Principled BSDF")
if green_bsdf and "Emission Strength" in green_bsdf.inputs:
    es=green_bsdf.inputs["Emission Strength"]
    es.default_value=.20; es.keyframe_insert(data_path="default_value",frame=60)
    es.default_value=.20; es.keyframe_insert(data_path="default_value",frame=72)
    es.default_value=8.0; es.keyframe_insert(data_path="default_value",frame=82)
    es.default_value=5.0; es.keyframe_insert(data_path="default_value",frame=90)

lock.scale=(.74,.74,.74); lock.keyframe_insert(data_path="scale",frame=60)
lock.scale=(1.34,1.34,1.34); lock.keyframe_insert(data_path="scale",frame=82)
lock.scale=(1.08,1.08,1.08); lock.keyframe_insert(data_path="scale",frame=90)

# Sliding doors: closed at action, clearly open at payoff.
left=cube("V4_DoorL",(3.46,-.34,.58),(.08,.38,.58),MID,.05)
right=cube("V4_DoorR",(3.46,.34,.58),(.08,.38,.58),MID,.05)
left.keyframe_insert(data_path="location",frame=60)
right.keyframe_insert(data_path="location",frame=60)
left.location.y=-1.02; right.location.y=1.02
left.keyframe_insert(data_path="location",frame=84)
right.keyframe_insert(data_path="location",frame=84)
left.keyframe_insert(data_path="location",frame=90)
right.keyframe_insert(data_path="location",frame=90)

# Reward orb appears only after activation and rises through the portal.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.22,location=(2.96,0,.58))
reward=bpy.context.object; reward.name="V4_Reward"; reward.data.materials.append(GOLD)
reward.scale=(.01,.01,.01); reward.keyframe_insert(data_path="scale",frame=72)
reward.keyframe_insert(data_path="location",frame=72)
reward.scale=(1.0,1.0,1.0); reward.location.x=3.78
reward.keyframe_insert(data_path="scale",frame=88)
reward.keyframe_insert(data_path="location",frame=88)
reward.keyframe_insert(data_path="scale",frame=90)
reward.keyframe_insert(data_path="location",frame=90)

# Lighting — stronger model separation, lighter than previous dark prototype.
for o in list(bpy.data.objects):
    if o.type=='LIGHT':
        bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target=(0.0,0,.70)):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name
    l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area("V4_WarmKey",(-2.6,-4.2,6.3),2300,4.6,(1.0,.74,.52))
area("V4_Fill",(3.2,-2.0,4.2),1550,4.0,(.48,.66,1.0))
area("V4_Rim",(0.8,3.8,5.8),1450,3.2,(.38,.70,1.0))
area("V4_GoalGlow",(3.0,-1.2,2.0),700,2.0,(.25,1.0,.40),target=(2.95,0,.58))

# Perspective camera with 90-degree roll so the long X mechanism fills portrait,
# while retaining visible Y/Z depth.
cam=scene.camera
cam.data.type='PERSP'
cam.data.lens=56
cam.location=(-0.35,-9.15,4.65)
direction=Vector((-0.55,0,.70))-cam.location
base=direction.to_track_quat('-Z','Y')
roll=Quaternion((0,0,1),math.radians(90))
cam.rotation_mode='QUATERNION'
cam.rotation_quaternion=base @ roll

# Render action + payoff first; no need to spend on start until this art direction passes.
for fno,name in [(60,"v4_action.png"),(90,"v4_payoff.png")]:
    scene.frame_set(fno)
    scene.render.filepath=os.path.join(outdir,name)
    bpy.ops.render.render(write_still=True)

with open(os.path.join(outdir,"v4_meta.txt"),"w") as f:
    f.write("V4_PERSPECTIVE_MACHINE 270x480 frames 60,90 five-paddle\n")
