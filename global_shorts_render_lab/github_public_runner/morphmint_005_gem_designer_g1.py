import bpy, pathlib, sys, json, base64, math
from mathutils import Vector

ROOT = pathlib.Path.cwd()
OUT = ROOT / "render_output" / "morphmint_005_gem_designer_g1"
OUT.mkdir(parents=True, exist_ok=True)
ADDON_PARENT = ROOT / ".cache" / "gem_designer"
ADDON_COMMIT = "5ccbb18f95b15ce32a354beaeb9fa503ad7688d3"

sys.path.insert(0, str(ADDON_PARENT))
import blender_gem_designer as bgd
bgd.register()

# Standard Round Brilliant listing from the GemCad manual fixture.
# This deliberately enters through Gem Designer's own ASC importer so the POC
# exercises its actual facet-tier / Geometry Nodes construction pipeline.
ASC = """GemCad 5.0
g 96 0.0
y 8 y
I 1.54
H Standard Round Brilliant
H Gem Designer G1 MorphMint POC
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

# Clean scene before importing through the add-on.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

res = bpy.ops.gem.import_asc(filepath=str(asc_path))
if "FINISHED" not in res:
    raise RuntimeError(f"Gem Designer ASC import failed: {res}")

gem = bpy.context.active_object
if gem is None or not gem.get("gem_designer"):
    raise RuntimeError("Gem Designer did not create an active gem object")
gem.name = "MorphMint_G1_GemDesigner_Diamond"

# Replace the ASC fallback material with Gem Designer's actual Diamond preset.
from blender_gem_designer.data.materials import GEMS
from blender_gem_designer.utils.node_utils import create_gem_material, load_world_asset

d = GEMS["Diamond"]
diamond = create_gem_material(
    gem_name="Diamond",
    main_ior=d["main_ior"],
    birefringence_ior=d["birefringence_ior"],
    dispersion=d["dispersion"],
    color=d["color"],
    color_density=d.get("color_density", 5.0),
    has_birefringence=d.get("has_birefringence", "No birefringence"),
    render_dispersion="Full Dispersion",
)
if gem.data.materials:
    gem.data.materials[0] = diamond
else:
    gem.data.materials.append(diamond)

# Evaluate current generated geometry and normalize uniformly so the face reads
# as the same round MorphMint object rather than a donor-shaped medallion.
def world_bbox(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    pts = [ev.matrix_world @ Vector(corner) for corner in ev.bound_box]
    return pts

pts = world_bbox(gem)
xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
span_xy = max(max(xs)-min(xs), max(ys)-min(ys))
if span_xy <= 1e-6:
    raise RuntimeError("Generated gem has invalid bounds")
scale = 3.10 / span_xy
gem.scale = tuple(v * scale for v in gem.scale)
bpy.context.view_layer.update()

pts = world_bbox(gem)
xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
cx = (min(xs)+max(xs))*0.5
cy = (min(ys)+max(ys))*0.5
cz = (min(zs)+max(zs))*0.5
# Center without altering facet proportions.
gem.location -= Vector((cx, cy, cz))
bpy.context.view_layer.update()

pts = world_bbox(gem)
zs = [p.z for p in pts]
zmax, zmin = max(zs), min(zs)

# MorphMint identity: shallow translucent/frosted inset intersecting the table,
# not a floating opaque part. Its material stays optical rather than ceramic.
mat = bpy.data.materials.new("MorphMint_G1_IdentityFrost")
mat.use_nodes = True
bs = mat.node_tree.nodes.get("Principled BSDF")
bs.inputs["Base Color"].default_value = (0.82, 0.94, 1.0, 1.0)
bs.inputs["Roughness"].default_value = 0.22
bs.inputs["IOR"].default_value = 1.46
bs.inputs["Transmission Weight"].default_value = 0.92

bpy.ops.mesh.primitive_cube_add(location=(0, 0, zmax - 0.018))
bar = bpy.context.object
bar.name = "MorphMint_G1_IntegratedIdentity"
bar.scale = (0.105, 0.62, 0.030)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bar.data.materials.append(mat)
bev = bar.modifiers.new("IdentityBevel", "BEVEL")
bev.width = 0.045
bev.segments = 4

# Use Gem Designer's packed reflective world, then add restrained jewelry cards.
load_world_asset()
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 192
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 20
scene.cycles.transmission_bounces = 16
scene.cycles.glossy_bounces = 10
scene.render.resolution_x = 540
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "AgX - Medium High Contrast"

# Dark neutral floor; nearly top-down camera preserves circular silhouette.
def simple_principled(name, color, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    return m

bpy.ops.mesh.primitive_plane_add(size=24, location=(0, 0, zmin - 0.34))
floor = bpy.context.object
floor.name = "G1_Floor"
floor.data.materials.append(simple_principled("G1_FloorMat", (0.012, 0.018, 0.030, 1), 0.30))

def area(name, loc, energy, sx, sy, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object
    l.name = name
    l.data.energy = energy
    l.data.shape = "RECTANGLE"
    l.data.size = sx
    l.data.size_y = sy
    l.data.color = color
    l.rotation_euler = (Vector((0,0,0)) - l.location).to_track_quat("-Z", "Y").to_euler()
    return l

area("G1_Key", (-3.8,-4.4,5.8), 1200, 3.8, 5.0, (1.0,0.94,0.88))
area("G1_Fill", (4.2,-2.8,4.5), 850, 3.0, 4.0, (0.72,0.87,1.0))
area("G1_Rim", (0.0,4.5,4.1), 720, 1.2, 4.5, (0.90,0.96,1.0))
area("G1_Strip", (-4.8,0.0,2.2), 520, 0.30, 4.2, (0.68,0.86,1.0))

bpy.ops.object.camera_add(location=(0.18, -0.28, 8.8))
cam = bpy.context.object
cam.name = "MorphMint_G1_Camera"
cam.data.lens = 78
target = Vector((0,0,0))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

scene.render.filepath = str(OUT / "crystal.png")
bpy.ops.render.render(write_still=True)

img = bpy.data.images.load(str(OUT / "crystal.png"), check_existing=False)
img.scale(270,480)
img.filepath_raw = str(OUT / "crystal_preview.png")
img.file_format = "PNG"
img.save()
(OUT / "crystal_preview.b64").write_text(
    base64.b64encode((OUT / "crystal_preview.png").read_bytes()).decode("ascii"),
    encoding="ascii",
)

result = {
    "marker": "MORPHMINT_005_GEM_DESIGNER_G1_RENDER_PASS",
    "asset": "morphmint_material_shift_005",
    "stage": "CRYSTAL_GEM_DESIGNER_POC",
    "route": "BLENDER_GEM_DESIGNER",
    "addon": {
        "repository": "Dekker3D/Blender-Gem-Designer",
        "commit": ADDON_COMMIT,
        "license": "GPL-3.0",
        "version": "1.0.1",
    },
    "design": {
        "source": "GemCad manual Standard Round Brilliant fixture",
        "gear": 96,
        "tiers": 7,
        "construction": "Gem Designer ASC importer + Geometry Nodes tier cutter",
    },
    "material": {
        "preset": "Diamond",
        "ior": d["main_ior"],
        "dispersion": d["dispersion"],
        "render_dispersion": "Full Dispersion",
    },
    "resolution": "540x960",
    "engine": "CYCLES",
    "samples": 192,
    "ceramic": "PASS_LOCKED_UNTOUCHED",
    "chrome": "PASS_LOCKED_UNTOUCHED",
    "quality_gate_90": "PENDING_AI_VISUAL_QA",
    "transition_gate": "BLOCKED_UNTIL_CRYSTAL_QUALITY_90",
}
(OUT / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("MORPHMINT_005_GEM_DESIGNER_G1_RENDER_PASS")
