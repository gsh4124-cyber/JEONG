import bpy, math, pathlib, json, base64, bmesh
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[2]
ASSET=ROOT/"global_shorts_render_lab"/"assets"/"runtime"/"hansolosnipe_diamond.glb"
OUT=pathlib.Path("render_output/morphmint_005_crystal_authored_c3")
OUT.mkdir(parents=True,exist_ok=True)
W,H=540,960

if not ASSET.exists():
    raise RuntimeError(f"runtime donor missing: {ASSET}")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.resolution_x=W
scene.render.resolution_y=H
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.render.engine="CYCLES"
scene.cycles.samples=160
scene.cycles.use_denoising=True
scene.cycles.max_bounces=14
scene.cycles.transmission_bounces=14
scene.cycles.glossy_bounces=10
scene.cycles.diffuse_bounces=3
scene.view_settings.look="AgX - Medium High Contrast"

# Import genuinely different authored round-diamond donor.
before={o.name for o in bpy.data.objects}
bpy.ops.import_scene.gltf(filepath=str(ASSET))
meshes=[o for o in bpy.data.objects if o.name not in before and o.type=="MESH"]
if not meshes:
    raise RuntimeError("HanSoloSnipe donor GLB imported no mesh")

bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
if len(meshes)>1:
    bpy.ops.object.join()
gem=bpy.context.view_layer.objects.active
gem.name="MorphMint_C3_HanSoloSnipeDiamond"
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)

# Auto-detect the two near-equal round-face axes and the remaining depth axis.
coords=[[v.co.x,v.co.y,v.co.z] for v in gem.data.vertices]
mins=[min(p[i] for p in coords) for i in range(3)]
maxs=[max(p[i] for p in coords) for i in range(3)]
ext=[maxs[i]-mins[i] for i in range(3)]
centers=[(mins[i]+maxs[i])*0.5 for i in range(3)]
pairs=[(0,1),(0,2),(1,2)]
face_axes=min(pairs,key=lambda ij: abs(ext[ij[0]]-ext[ij[1]])/max(ext[ij[0]],ext[ij[1]],1e-9))
depth_axis=({0,1,2}-set(face_axes)).pop()
if min(ext)<1e-9:
    raise RuntimeError(f"degenerate donor extents: {ext}")

FACE=3.04
DEPTH=0.58
for v in gem.data.vertices:
    p=[v.co.x,v.co.y,v.co.z]
    x=(p[face_axes[0]]-centers[face_axes[0]])*(FACE/ext[face_axes[0]])
    z=(p[face_axes[1]]-centers[face_axes[1]])*(FACE/ext[face_axes[1]])
    y=(p[depth_axis]-centers[depth_axis])*(DEPTH/ext[depth_axis])
    v.co=(x,y,z)

bm=bmesh.new()
bm.from_mesh(gem.data)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
bm.to_mesh(gem.data)
bm.free()
for poly in gem.data.polygons:
    poly.use_smooth=False
gem.data.update()

def diamond_mat():
    m=bpy.data.materials.new("MM_C3_PremiumCrystal")
    m.use_nodes=True
    nt=m.node_tree
    nt.nodes.clear()
    out=nt.nodes.new("ShaderNodeOutputMaterial")
    glass=nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["Color"].default_value=(0.995,0.999,1.0,1)
    glass.inputs["Roughness"].default_value=0.008
    glass.inputs["IOR"].default_value=2.417
    nt.links.new(glass.outputs["BSDF"],out.inputs["Surface"])
    return m

gem.data.materials.clear()
gem.data.materials.append(diamond_mat())

# MorphMint identity insert: restrained frosted optical bar integrated at front.
identity=bpy.data.materials.new("MM_C3_IdentityFrost")
identity.use_nodes=True
bs=identity.node_tree.nodes.get("Principled BSDF")
bs.inputs["Base Color"].default_value=(0.74,0.93,1.0,1)
bs.inputs["Roughness"].default_value=0.18
if "Transmission Weight" in bs.inputs:
    bs.inputs["Transmission Weight"].default_value=0.55
if "IOR" in bs.inputs:
    bs.inputs["IOR"].default_value=1.46

bpy.ops.mesh.primitive_cube_add(location=(0,-0.292,0))
bar=bpy.context.object
bar.name="MorphMint_C3_IdentityBar"
bar.scale=(0.115,0.014,0.64)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bar.data.materials.append(identity)
bev=bar.modifiers.new("IdentityBarBevel","BEVEL")
bev.width=0.032
bev.segments=3

def principled(name,color,rough):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    b=mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=color
    b.inputs["Roughness"].default_value=rough
    return mat

bpy.ops.mesh.primitive_plane_add(size=30,location=(0,2,-2.18))
floor=bpy.context.object
floor.data.materials.append(principled("C3_Floor",(0.012,0.020,0.035,1),0.30))

bpy.ops.mesh.primitive_plane_add(size=18,location=(0,3.0,1.0),rotation=(math.radians(90),0,0))
back=bpy.context.object
back.data.materials.append(principled("C3_Backdrop",(0.035,0.050,0.080,1),0.44))

world=scene.world
world.use_nodes=True
nt=world.node_tree
nt.nodes.clear()
wo=nt.nodes.new("ShaderNodeOutputWorld")
bg=nt.nodes.new("ShaderNodeBackground")
bg.inputs["Color"].default_value=(0.16,0.20,0.27,1)
bg.inputs["Strength"].default_value=0.72
nt.links.new(bg.outputs["Background"],wo.inputs["Surface"])

def area(name,loc,energy,size,color,rect=None):
    bpy.ops.object.light_add(type="AREA",location=loc)
    l=bpy.context.object
    l.name=name
    l.data.energy=energy
    l.data.color=color
    if rect:
        l.data.shape="RECTANGLE"
        l.data.size=rect[0]
        l.data.size_y=rect[1]
    else:
        l.data.size=size
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat("-Z","Y").to_euler()
    return l

area("C3_Key",(-3.8,-4.5,4.7),1450,4.8,(1.0,0.96,0.90))
area("C3_Fill",(4.2,-3.3,1.0),980,4.2,(0.72,0.88,1.0))
area("C3_Top",(0.0,-0.2,5.8),1300,2.8,(0.88,0.96,1.0))
area("C3_StripL",(-4.7,-1.2,0.1),620,1.0,(0.72,0.90,1.0),rect=(0.24,3.8))
area("C3_StripR",(4.8,-1.0,0.7),540,1.0,(1.0,0.90,0.76),rect=(0.22,3.5))
area("C3_Backlight",(0.2,2.0,2.7),800,3.0,(0.80,0.92,1.0))

bpy.ops.object.camera_add(location=(0.34,-10.65,0.28))
cam=bpy.context.object
cam.name="MorphMint_C3_Camera"
cam.data.lens=72
target=Vector((0,0,0.02))
cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
scene.camera=cam

scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)

img=bpy.data.images.load(str(OUT/"crystal.png"),check_existing=False)
img.scale(270,480)
img.filepath_raw=str(OUT/"crystal_preview.png")
img.file_format="PNG"
img.save()
(OUT/"crystal_preview.b64").write_text(base64.b64encode((OUT/"crystal_preview.png").read_bytes()).decode("ascii"),encoding="ascii")

result={
    "marker":"MORPHMINT_005_CRYSTAL_AUTHORED_C3_RENDER_PASS",
    "asset":"morphmint_material_shift_005",
    "stage":"CRYSTAL_STILL_GRAMMAR_QA",
    "construction_method":"AUTHORED_ROUND_DIAMOND_GLTF_RETARGET",
    "donor":{
        "creator":"HanSoloSnipe",
        "title":"Diamond [Low-Poly]",
        "source":"https://sketchfab.com/3d-models/diamond-low-poly-405cc8175019452daa01999fd1466731",
        "license":"Creative Commons Attribution",
        "runtime_transport_repo":"gkjohnson/3d-demo-data",
        "runtime_transport_path":"models/diamond/diamond.glb",
        "runtime_transport_blob":"b6e5fe60258450cd5d2f803bef2acd59c36cd242"
    },
    "auto_axes":{"face_axes":list(face_axes),"depth_axis":depth_axis,"source_extents":ext},
    "retarget":"round-face axes normalized to 3.04 x 3.04; depth axis compressed to 0.58",
    "resolution":f"{W}x{H}",
    "engine":"CYCLES",
    "samples":160,
    "ceramic":"PASS_LOCKED_UNTOUCHED",
    "chrome":"PASS_LOCKED_UNTOUCHED",
    "quality_gate_90":"PENDING_AI_VISUAL_QA",
    "transition_gate":"BLOCKED_UNTIL_CRYSTAL_QUALITY_90"
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_CRYSTAL_AUTHORED_C3_RENDER_PASS")
