import os, subprocess, pathlib, json, textwrap, sys, shutil, time

ROOT=pathlib.Path("/kaggle/working/global_shorts_blender")
ROOT.mkdir(parents=True, exist_ok=True)
BLENDER_VER="5.2.2"
ARCHIVE=ROOT/f"blender-{BLENDER_VER}-linux-x64.tar.xz"
BLENDER_DIR=ROOT/f"blender-{BLENDER_VER}-linux-x64"
BLENDER_BIN=BLENDER_DIR/"blender"
URL=f"https://download.blender.org/release/Blender5.2/blender-{BLENDER_VER}-linux-x64.tar.xz"

def run(cmd, check=True):
    print("+", " ".join(map(str,cmd)), flush=True)
    p=subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(p.stdout, flush=True)
    if check and p.returncode!=0:
        raise RuntimeError(f"command failed: {cmd} rc={p.returncode}")
    return p

print("=== GPU ===")
run(["nvidia-smi"], check=False)

if not BLENDER_BIN.exists():
    if not ARCHIVE.exists():
        run(["wget","-q","-O",str(ARCHIVE),URL])
    run(["tar","-xf",str(ARCHIVE),"-C",str(ROOT)])

scene_script=ROOT/"smoke_scene.py"
scene_script.write_text(r'''
import bpy, os, json, pathlib

OUT=pathlib.Path("/kaggle/working/global_shorts_blender/output")
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1.0)
sphere=bpy.context.object
sphere.name="Kaggle_Remote_Sphere"

mat=bpy.data.materials.new("RemoteSmokeMaterial")
mat.use_nodes=True
bsdf=mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value=(0.08,0.22,0.82,1)
bsdf.inputs["Metallic"].default_value=0.35
bsdf.inputs["Roughness"].default_value=0.22
sphere.data.materials.append(mat)

bpy.ops.object.light_add(type='AREA', location=(3,-4,5))
key=bpy.context.object
key.data.energy=1200
key.data.shape='DISK'
key.data.size=4

bpy.ops.object.light_add(type='AREA', location=(-4,-2,2))
fill=bpy.context.object
fill.data.energy=500
fill.data.size=3

bpy.ops.object.camera_add(location=(0,-6,0.6))
cam=bpy.context.object
bpy.context.scene.camera=cam
import mathutils
cam.rotation_euler=(mathutils.Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=64
scene.render.resolution_x=256
scene.render.resolution_y=256
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/"kaggle_blender_smoke.png")

device_report=[]
try:
    prefs=bpy.context.preferences.addons["cycles"].preferences
    prefs.refresh_devices()
    try:
        prefs.compute_device_type="CUDA"
    except Exception as e:
        device_report.append(f"compute_device_type:{e}")
    prefs.get_devices()
    for dev in prefs.devices:
        if dev.type in {"CUDA","OPTIX","HIP","ONEAPI","METAL"}:
            dev.use=True
        device_report.append(f"{dev.name}:{dev.type}:use={dev.use}")
    scene.cycles.device='GPU'
except Exception as e:
    device_report.append(f"GPU_SETUP_FAIL:{type(e).__name__}:{e}")
    scene.cycles.device='CPU'

bpy.ops.render.render(write_still=True)
blend_path=OUT/"kaggle_blender_smoke.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

result={
  "marker":"KAGGLE_BLENDER_REMOTE_SMOKE_PASS",
  "render":str(OUT/"kaggle_blender_smoke.png"),
  "blend":str(blend_path),
  "engine":scene.render.engine,
  "cycles_device":scene.cycles.device,
  "devices":device_report
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(json.dumps(result,indent=2))
print("KAGGLE_BLENDER_REMOTE_SMOKE_PASS")
''',encoding="utf-8")

run([str(BLENDER_BIN),"--background","--factory-startup","--python",str(scene_script)])

out=ROOT/"output"
required=[out/"kaggle_blender_smoke.png",out/"kaggle_blender_smoke.blend",out/"result.json"]
for p in required:
    if not p.exists() or p.stat().st_size==0:
        raise RuntimeError(f"missing output: {p}")

print("KAGGLE_REMOTE_WORKER_PASS")
for p in required:
    print(p, p.stat().st_size)
