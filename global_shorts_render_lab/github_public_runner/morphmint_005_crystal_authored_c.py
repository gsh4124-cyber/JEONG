import bpy, math, pathlib, json
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[2]
ASSET=ROOT/"assets"/"third_party"/"raysect_diamond.obj"
OUT=pathlib.Path("render_output/morphmint_005_crystal_authored_c1")
OUT.mkdir(parents=True,exist_ok=True)
W,H=540,960

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.resolution_x=W
scene.render.resolution_y=H
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.render.engine="CYCLES"
scene.cycles.samples=144
scene.cycles.use_denoising=True
scene.cycles.max_bounces=12
scene.cycles.transmission_bounces=12
scene.cycles.glossy_bounces=8
scene.cycles.diffuse_bounces=3
scene.view_settings.look="AgX - Medium High Contrast"

# Authored donor topology: imported as-is, then only centered and anisotropically
# retargeted to MorphMint's round medallion envelope. Connectivity/facet layout
# stays from the external authored mesh.
bpy.ops.wm.obj_import(filepath=str(ASSET))
meshes=[o for o in bpy.context.selected_objects if o.type=="MESH"]
if not meshes:
    raise RuntimeError("Raysect donor OBJ import produced no mesh")
bpy.context.view_layer.objects.active=meshes[0]
for o in meshes:
    o.select_set(True)
if len(meshes)>1:
    bpy.ops.object.join()
gem=bpy.context.view_layer.objects.active
gem.name="MorphMint_RaysectAuthoredCrystal"

# Center and retarget object-space vertices.
xs=[]; ys=[]; zs=[]
for v in gem.data.vertices:
    xs.append(v.co.x); ys.append(v.co.y); zs.append(v.co.z)
cx=(min(xs)+max(xs))*0.5
cy=(min(ys)+max(ys))*0.5
cz=(min(zs)+max(zs))*0.5
ex=max(xs)-min(xs); ey=max(ys)-min(ys); ez=max(zs)-min(zs)
sx=3.04/ex
sy=0.58/ey
sz=3.04/ez
for v in gem.data.vertices:
    v.co.x=(v.co.x-cx)*sx
    v.co.y=(v.co.y-cy)*sy
    v.co.z=(v.co.z-cz)*sz
for p in gem.data.polygons:
    p.use_smooth=False
gem.data.update()

def authored_glass():
    m=bpy.data.materials.new("MM_AuthoredCrystal")
    m.use_nodes=True
    nt=m.node_tree
    nt.nodes.clear()
    out=nt.nodes.new("ShaderNodeOutputMaterial")
    glass=nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["Color"].default_value=(0.985,0.997,1.0,1)
    glass.inputs["Roughness"].default_value=0.008
    glass.inputs["IOR"].default_value=1.545
    vol=nt.nodes.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value=(0.28,0.66,1.0,1)
    vol.inputs["Density"].default_value=0.0010
    nt.links.new(glass.outputs["BSDF"],out.inputs["Surface"])
    nt.links.new(vol.outputs["Volume"],out.inputs["Volume"])
    return m

gem.data.materials.clear()
gem.data.materials.append(authored_glass())

# Preserve MorphMint's same-object identity with one restrained frosted insert.
m=bpy.data.materials.new("MM_IdentityFrost")
m.use_nodes=True
bs=m.node_tree.nodes.get("Principled BSDF")
bs.inputs["Base Color"].default_value=(0.58,0.86,1.0,1)
bs.inputs["Roughness"].default_value=0.19
if "Transmission Weight" in bs.inputs:
    bs.inputs["Transmission Weight"].default_value=0.68
if "IOR" in bs.inputs:
    bs.inputs["IOR"].default_value=1.46

bpy.ops.mesh.primitive_cube_add(location=(0,-0.315,0))
bar=bpy.context.object
bar.name="MorphMint_IdentityBar"
bar.scale=(0.12,0.022,0.68)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bar.data.materials.append(m)
bev=bar.modifiers.new("IdentityBarBevel","BEVEL")
bev.width=0.035
bev.segments=2

# Dark neutral product stage.
def principled(name,color,rough):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    b=mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=color
    b.inputs["Roughness"].default_value=rough
    return mat

bpy.ops.mesh.primitive_plane_add(size=30,location=(0,2,-2.22))
floor=bpy.context.object
floor.data.materials.append(principled("Floor",(0.008,0.012,0.022,1),0.36))

bpy.ops.mesh.primitive_plane_add(size=18,location=(0,3.0,1.0),rotation=(math.radians(90),0,0))
back=bpy.context.object
back.data.materials.append(principled("Backdrop",(0.002,0.005,0.014,1),0.52))
for o in (floor,back):
    try:
        o.visible_transmission=False
        o.visible_glossy=False
    except Exception:
        pass

world=scene.world
world.use_nodes=True
nt=world.node_tree
nt.nodes.clear()
wo=nt.nodes.new("ShaderNodeOutputWorld")
bg=nt.nodes.new("ShaderNodeBackground")
bg.inputs["Color"].default_value=(0.045,0.065,0.095,1)
bg.inputs["Strength"].default_value=0.42
nt.links.new(bg.outputs["Background"],wo.inputs["Surface"])

def area(name,loc,energy,size,color,rect=None):
    bpy.ops.object.light_add(type="AREA",location=loc)
    l=bpy.context.object
    l.name=name
    l.data.energy=energy
    l.data.color=color
    if rect:
        l.data.shape="RECTANGLE"
        l.data.size=rect[0]; l.data.size_y=rect[1]
    else:
        l.data.size=size
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat("-Z","Y").to_euler()
    return l

# Jewelry-studio grammar: broad planes plus two narrow grazing strips.
area("Key",(-3.6,-4.5,4.8),980,4.5,(1.0,0.93,0.84))
area("Fill",(4.1,-3.2,1.0),600,3.6,(0.58,0.78,1.0))
area("Top",(0.2,0.0,5.8),1050,2.6,(0.78,0.91,1.0))
area("StripL",(-4.6,-1.6,0.1),360,1.0,(0.72,0.88,1.0),rect=(0.32,3.6))
area("StripR",(4.7,-1.2,0.8),300,1.0,(1.0,0.88,0.72),rect=(0.26,3.2))

bpy.ops.object.camera_add(location=(0.95,-10.25,0.72))
cam=bpy.context.object
cam.name="MorphMint_Camera"
cam.data.lens=68
target=Vector((0,0,0.05))
cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
scene.camera=cam

scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)

img=bpy.data.images.load(str(OUT/"crystal.png"),check_existing=False)
img.scale(270,480)
img.filepath_raw=str(OUT/"crystal_preview.png")
img.file_format="PNG"
img.save()

result={
    "marker":"MORPHMINT_005_CRYSTAL_AUTHORED_C1_RENDER_PASS",
    "asset":"morphmint_material_shift_005",
    "stage":"CRYSTAL_STILL_GRAMMAR_QA",
    "construction_method":"REFERENCE_DERIVED_AUTHORED_DONOR_RETARGET",
    "donor":{
        "repository":"raysect/source",
        "path":"demos/resources/diamond.obj",
        "blob_sha":"1d36d81a2f2b89949f342a69a535ce82ae736cfa",
        "license":"BSD-3-Clause"
    },
    "retarget":{
        "preserved":"donor mesh connectivity and facet layout",
        "changed":"centering, anisotropic envelope fit, material, studio lighting, MorphMint identity insert"
    },
    "resolution":f"{W}x{H}",
    "engine":"CYCLES",
    "samples":144,
    "ceramic":"PASS_LOCKED_UNTOUCHED",
    "chrome":"PASS_LOCKED_UNTOUCHED",
    "quality_gate_90":"PENDING_AI_VISUAL_QA",
    "transition_gate":"BLOCKED_UNTIL_CRYSTAL_QUALITY_90"
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_CRYSTAL_AUTHORED_C1_RENDER_PASS")
