import bpy, os, sys, mathutils
args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir = args[0] if args else "."
os.makedirs(outdir, exist_ok=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=270
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.006,0.008,0.015)

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
    scene.camera.data.ortho_scale=10.6

scene.frame_set(60)
scene.render.filepath=os.path.join(outdir,'quality_fast_60.png')
bpy.ops.render.render(write_still=True)
