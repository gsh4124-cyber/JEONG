import bpy, pathlib, sys, json, base64
from mathutils import Vector

ROOT = pathlib.Path.cwd()
OUT = ROOT / "render_output" / "morphmint_005_gem_designer_g1b"
OUT.mkdir(parents=True, exist_ok=True)
ADDON_PARENT = ROOT / ".cache" / "gem_designer"
ADDON_COMMIT = "5ccbb18f95b15ce32a354beaeb9fa503ad7688d3"

sys.path.insert(0, str(ADDON_PARENT))
import blender_gem_designer as bgd
bgd.register()

ASC = """GemCad 5.0
g 96 0.0
y 8 y
I 1.54
H Standard Round Brilliant
H Gem Designer G1b MorphMint POC
a -90.000000 1.02653281 93 n G 87 81 75 69 63 57 51 45 39 33 27 21 15 9 3
a -42.500000 0.61819401 93 n 1 87 81 75 69 63 57 51 45 39 33 27 21 15 9 3
a -41.500000 0.61701256 96 n 2 84 72 60 48 36 24 12
a 34.000000 0.68444470 3 n A 9 15 21 27 33 39 45 51 57 63 69 75 81 87 93
a 28.000000 0.60896430 96 n B 12 24 36 48 60 72 84
a 16.000000 0.50613241 6 n C 18 30 42 54 66 78 90
a 0.000000 0.36450932 96 n T
F GemCad for Windows Manual standard round brilliant fixture
"""
asc_path = OUT / "standard_round_brilliant.asc"
asc_path.write_text(ASC, encoding="ascii")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
res = bpy.ops.gem.import_asc(filepath=str(asc_path))
if "FINISHED" not in res:
    raise RuntimeError(f"Gem Designer ASC import failed: {res}")

gem = bpy.context.active_object
if gem is None or not gem.get("gem_designer"):
    raise RuntimeError("Gem Designer did not create an active gem object")
gem.name = "MorphMint_G1b_GemDesigner_Diamond"

from blender_gem_designer.data.materials import GEMS
from blender_gem_designer.utils.node_utils import create_gem_material

d = GEMS["Diamond"]
diamond = create_gem_material(
    gem_name="Diamond",
    main_ior=d["main_ior"],
    birefringence_ior=d["birefringence_ior"],
    dispersion=d["dispersion"],
    color=(1.0, 1.0, 1.0),
    color_density=1.0,
    has_birefringence=d.get("has_birefringence", "No birefringence"),
    render_dispersion="Full Dispersion",
)
if gem.data.materials:
    gem.data.materials[0] = diamond
else:
    gem.data.materials.append(diamond)

def world_bbox(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    return [ev.matrix_world @ Vector(corner) for corner in ev.bound_box]

pts = world_bbox(gem)
xs=[p.x for p in pts]; ys=[p.y for p in pts]
span_xy=max(max(xs)-min(xs), max(ys)-min(ys))
if span_xy <= 1e-6:
    raise RuntimeError("Generated gem has invalid bounds")
scale = 3.00/span_xy
gem.scale = tuple(v*scale for v in gem.scale)
bpy.context.view_layer.update()

pts=world_bbox(gem)
xs=[p.x for p in pts]; ys=[p.y for p in pts]; zs=[p.z for p in pts]
center=Vector(((min(xs)+max(xs))*0.5,(min(ys)+max(ys))*0.5,(min(zs)+max(zs))*0.5))
gem.location -= center
bpy.context.view_layer.update()
pts=world_bbox(gem); zs=[p.z for p in pts]
zmax,zmin=max(zs),min(zs)

# Structural fix 1: subtle identity below the table, not a bright glued-on part.
mat=bpy.data.materials.new("MorphMint_G1b_SubtableIdentity")
mat.use_nodes=True
bs=mat.node_tree.nodes.get("Principled BSDF")
bs.inputs["Base Color"].default_value=(0.70,0.88,1.0,1.0)
bs.inputs["Roughness"].default_value=0.34
bs.inputs["IOR"].default_value=1.46
bs.inputs["Transmission Weight"].default_value=0.98
bpy.ops.mesh.primitive_cube_add(location=(0,0,zmax-0.095))
bar=bpy.context.object
bar.name="MorphMint_G1b_SubtableIdentity"
bar.scale=(0.070,0.40,0.012)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bar.data.materials.append(mat)
bev=bar.modifiers.new("IdentityBevel","BEVEL")
bev.width=0.022
bev.segments=3

scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=192
scene.cycles.use_denoising=True
scene.cycles.max_bounces=20
scene.cycles.transmission_bounces=16
scene.cycles.glossy_bounces=10
scene.render.resolution_x=540
scene.render.resolution_y=960
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.view_settings.look="AgX - Medium High Contrast"

# Structural fix 2: no workshop HDRI. Clean neutral jewelry studio only.
world=bpy.data.worlds.new("MorphMint_G1b_CleanWorld") if not scene.world else scene.world
scene.world=world
world.use_nodes=True
wn=world.node_tree
wn.nodes.clear()
out=wn.nodes.new("ShaderNodeOutputWorld")
bg=wn.nodes.new("ShaderNodeBackground")
bg.inputs["Color"].default_value=(0.008,0.014,0.026,1)
bg.inputs["Strength"].default_value=0.16
wn.links.new(bg.outputs["Background"],out.inputs["Surface"])

def simple_principled(name,color,rough):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value=color
    p.inputs["Roughness"].default_value=rough
    return m

bpy.ops.mesh.primitive_plane_add(size=24,location=(0,0,zmin-0.30))
floor=bpy.context.object
floor.name="G1b_Floor"
floor.data.materials.append(simple_principled("G1b_FloorMat",(0.008,0.012,0.022,1),0.28))

def area(name,loc,energy,sx,sy,color):
    bpy.ops.object.light_add(type="AREA",location=loc)
    l=bpy.context.object; l.name=name
    l.data.energy=energy; l.data.shape="RECTANGLE"; l.data.size=sx; l.data.size_y=sy; l.data.color=color
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat("-Z","Y").to_euler()
    return l

area("G1b_SoftKey",(-3.6,-3.2,6.4),760,4.8,5.8,(1.0,0.98,0.95))
area("G1b_CoolFill",(4.2,-2.0,4.8),520,4.2,5.0,(0.82,0.92,1.0))
area("G1b_Rim",(0.5,4.8,4.4),430,2.0,5.4,(0.94,0.98,1.0))
area("G1b_LeftStrip",(-5.0,0.8,2.2),260,0.45,4.8,(0.76,0.90,1.0))
area("G1b_RightStrip",(5.0,0.2,1.8),230,0.38,4.5,(1.0,0.92,0.82))

# Structural fix 3: wider product framing for readable round silhouette.
bpy.ops.object.camera_add(location=(0.12,-0.18,10.4))
cam=bpy.context.object
cam.name="MorphMint_G1b_Camera"
cam.data.lens=72
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat("-Z","Y").to_euler()
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
  "marker":"MORPHMINT_005_GEM_DESIGNER_G1B_RENDER_PASS",
  "asset":"morphmint_material_shift_005",
  "stage":"CRYSTAL_GEM_DESIGNER_STRUCTURAL_FIX_QA",
  "route":"BLENDER_GEM_DESIGNER",
  "construction":"Gem Designer ASC importer + Geometry Nodes tier cutter",
  "design":"GemCad manual Standard Round Brilliant 7-tier",
  "material":{"preset":"Diamond","ior":2.417,"dispersion":0.044,"render_dispersion":"Full Dispersion"},
  "structural_fixes":["REMOVE_WORKSHOP_HDRI","CLEAN_JEWELRY_STUDIO","SUBTABLE_FROSTED_IDENTITY","WIDER_PRODUCT_CAMERA"],
  "ceramic":"PASS_LOCKED_UNTOUCHED",
  "chrome":"PASS_LOCKED_UNTOUCHED",
  "quality_gate_90":"PENDING_AI_VISUAL_QA",
  "transition_gate":"BLOCKED_UNTIL_CRYSTAL_QUALITY_90"
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_GEM_DESIGNER_G1B_RENDER_PASS")
