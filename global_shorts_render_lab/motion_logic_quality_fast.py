# five-paddle-payoff-fast-preview
import bpy, os, sys, math, mathutils
args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir = args[0] if args else "."
os.makedirs(outdir, exist_ok=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=180
scene.render.resolution_y=320
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.018,0.022,0.035)

def principled(mat, base, metallic, rough, emission=None, estr=0.0):
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get("Principled BSDF")
    if not bsdf: return
    bsdf.inputs["Base Color"].default_value=base
    bsdf.inputs["Metallic"].default_value=metallic
    bsdf.inputs["Roughness"].default_value=rough
    if "Coat Weight" in bsdf.inputs: bsdf.inputs["Coat Weight"].default_value=0.15
    if emission and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value=emission
        bsdf.inputs["Emission Strength"].default_value=estr

# Visual cleanup: keep collision helpers but remove them from camera.
for o in bpy.data.objects:
    if o.name.startswith("Rail") or o.name.startswith("ImpactBridge"):
        o.hide_render = True

# Reframe visual payoff objects without changing the baked physics.
goal_obj = bpy.data.objects.get("GoalBell")
goal_ring = bpy.data.objects.get("GoalRing")
goal_base = bpy.data.objects.get("Cylinder")
gate = bpy.data.objects.get("SuccessGate")
if goal_obj:
    goal_obj.scale *= 0.82
if goal_ring:
    goal_ring.scale *= 0.78
if goal_base:
    goal_base.scale *= 0.82

for m in bpy.data.materials:
    n=m.name.lower()
    if "ball" in n: principled(m,(0.02,0.18,1,1),0.85,0.14)
    elif "domino" in n: principled(m,(1.0,0.10,0.018,1),0.1,0.26)
    elif "goal" in n: principled(m,(0.01,0.55,0.05,1),0.05,0.2,(0.02,0.8,0.08,1),2.2)
    elif "ramp" in n: principled(m,(0.045,0.065,0.11,1),0.32,0.32)
    elif "floor" in n: principled(m,(0.010,0.014,0.025,1),0.03,0.5)

for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(loc,energy,size,color,target=(0.2,0,0.45)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l=bpy.context.object; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(mathutils.Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area((-2.5,-4.2,6.5),1400,5.0,(1.0,0.82,0.68))
area((4.0,-1.0,3.5),800,4.0,(0.55,0.72,1.0))
area((1.0,4.0,5.0),1000,3.0,(0.55,0.70,1.0))
if scene.camera:
    scene.camera.data.type='ORTHO'
    scene.camera.data.ortho_scale=7.7

goal_mat = bpy.data.materials.get("Goal")

# Strong payoff marker: a bright halo + radial burst that exists only in the success frame.
burst_mat = bpy.data.materials.new("SuccessBurstMat")
principled(burst_mat,(0.75,1.0,0.15,1),0.0,0.18,(0.55,1.0,0.10,1),14.0)

burst_parts=[]
if goal_obj:
    gx,gy,gz = goal_obj.location
    bpy.ops.mesh.primitive_torus_add(major_radius=1.05, minor_radius=0.075, location=(gx,gy,gz))
    halo=bpy.context.object
    halo.name="SuccessHalo"
    halo.data.materials.append(burst_mat)
    burst_parts.append(halo)
    for i in range(8):
        a=math.radians(i*45)
        x=gx+math.cos(a)*1.25
        z=gz+math.sin(a)*1.25
        bpy.ops.mesh.primitive_cube_add(location=(x,gy,z))
        ray=bpy.context.object
        ray.name=f"SuccessRay_{i}"
        ray.scale=(0.06,0.045,0.34)
        ray.rotation_euler=(0,-a,0)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        ray.data.materials.append(burst_mat)
        burst_parts.append(ray)

for fno,name in [(60,'quality_fast_60.png'),(90,'quality_fast_90.png')]:
    scene.frame_set(fno)
    if goal_mat and goal_mat.use_nodes:
        bsdf = goal_mat.node_tree.nodes.get("Principled BSDF")
        if bsdf and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 0.25 if fno == 60 else 11.0
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.01,0.22,0.03,1) if fno == 60 else (0.38,1.0,0.08,1)
    for p in burst_parts:
        p.hide_render = (fno != 90)
    if goal_ring:
        goal_ring.scale = (0.70,0.70,0.70) if fno == 60 else (1.42,1.42,1.42)
    if goal_obj:
        goal_obj.scale = (0.82,0.82,0.451) if fno == 60 else (1.00,1.00,0.55)
    scene.render.filepath=os.path.join(outdir,name)
    bpy.ops.render.render(write_still=True)
