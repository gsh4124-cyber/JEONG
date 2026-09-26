import bpy, pathlib, sys, json, base64, math
from mathutils import Vector

ROOT = pathlib.Path.cwd()
OUT = ROOT / "render_output" / "morphmint_005_gem_designer_g2"
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
H Gem Designer G2 MorphMint POC
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
gem.name = "MorphMint_G2_GemDesigner_Diamond"

from blender_gem_designer.data.materials import GEMS
from blender_gem_designer.utils.node_utils import create_gem_material

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


def world_bbox(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    return [ev.matrix_world @ Vector(corner) for corner in ev.bound_box]

pts = world_bbox(gem)
xs = [p.x for p in pts]; ys = [p.y for p in pts]
span_xy = max(max(xs)-min(xs), max(ys)-min(ys))
if span_xy <= 1e-6:
    raise RuntimeError("Generated gem has invalid bounds")
scale = 3.10 / span_xy
gem.scale = tuple(v * scale for v in gem.scale)
# A small rotational presentation shift avoids putting primary facets exactly
# on the frame axes without altering geometry.
gem.rotation_euler[2] = math.radians(11.25)
bpy.context.view_layer.update()

pts = world_bbox(gem)
xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
gem.location -= Vector(((min(xs)+max(xs))*0.5, (min(ys)+max(ys))*0.5, (min(zs)+max(zs))*0.5))
bpy.context.view_layer.update()
pts = world_bbox(gem)
zs = [p.z for p in pts]
zmax, zmin = max(zs), min(zs)

# G2 identity: an almost flush optical frost mark. No opaque detached bar.
identity_mat = bpy.data.materials.new("MorphMint_G2_FlushFrost")
identity_mat.use_nodes = True
nt = identity_mat.node_tree
nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputMaterial")
transparent = nt.nodes.new("ShaderNodeBsdfTransparent")
glass = nt.nodes.new("ShaderNodeBsdfGlass")
glass.inputs["Color"].default_value = (0.86, 0.96, 1.0, 1.0)
glass.inputs["Roughness"].default_value = 0.30
glass.inputs["IOR"].default_value = 1.46
mix = nt.nodes.new("ShaderNodeMixShader")
mix.inputs[0].default_value = 0.34
nt.links.new(transparent.outputs[0], mix.inputs[1])
nt.links.new(glass.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], out.inputs[0])

bpy.ops.mesh.primitive_cube_add(location=(0, 0, zmax + 0.0005))
mark = bpy.context.object
mark.name = "MorphMint_G2_FlushIdentity"
mark.scale = (0.075, 0.55, 0.0035)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mark.data.materials.append(identity_mat)
bev = mark.modifiers.new("FlushIdentityBevel", "BEVEL")
bev.width = 0.030
bev.segments = 4

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 176
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 20
scene.cycles.transmission_bounces = 16
scene.cycles.glossy_bounces = 10
scene.render.resolution_x = 540
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -0.35

# Neutral world only. G1's warm/muddy machine-shop HDRI is intentionally removed.
world = bpy.data.worlds.new("MorphMint_G2_NeutralWorld") if not bpy.data.worlds else bpy.data.worlds[0]
scene.world = world
world.use_nodes = True
wnt = world.node_tree
wnt.nodes.clear()
wout = wnt.nodes.new("ShaderNodeOutputWorld")
bg = wnt.nodes.new("ShaderNodeBackground")
bg.inputs["Color"].default_value = (0.018, 0.025, 0.040, 1.0)
bg.inputs["Strength"].default_value = 0.22
wnt.links.new(bg.outputs[0], wout.inputs[0])


def simple_principled(name, color, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    return m

bpy.ops.mesh.primitive_plane_add(size=24, location=(0, 0, zmin - 0.31))
floor = bpy.context.object
floor.name = "G2_Floor"
floor.data.materials.append(simple_principled("G2_FloorMat", (0.020, 0.027, 0.042, 1), 0.24))


def area(name, loc, energy, sx, sy):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object
    l.name = name
    l.data.energy = energy
    l.data.shape = "RECTANGLE"
    l.data.size = sx
    l.data.size_y = sy
    l.data.color = (1.0, 1.0, 1.0)
    l.rotation_euler = (Vector((0,0,0)) - l.location).to_track_quat("-Z", "Y").to_euler()
    return l

# Narrow jewelry strips create readable facet contrast without giant clipped cards.
area("G2_Strip_Left", (-4.3, -1.1, 4.6), 420, 0.22, 4.5)
area("G2_Strip_Right", (4.0, 1.3, 4.0), 330, 0.20, 4.0)
area("G2_Strip_Back", (0.6, 4.5, 4.7), 270, 0.18, 3.5)
area("G2_Soft_Top", (-0.7, -2.5, 6.8), 150, 2.6, 2.6)

# Exact face-on camera locks the canonical round read.
bpy.ops.object.camera_add(location=(0, 0, 8.9))
cam = bpy.context.object
cam.name = "MorphMint_G2_Camera"
cam.data.lens = 82
cam.rotation_euler = (Vector((0,0,0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

scene.render.filepath = str(OUT / "crystal.png")
bpy.ops.render.render(write_still=True)

# Persist full preview plus a compact JPEG QA readback in the same run.
img = bpy.data.images.load(str(OUT / "crystal.png"), check_existing=False)
img.scale(270, 480)
img.filepath_raw = str(OUT / "crystal_preview.png")
img.file_format = "PNG"
img.save()
(OUT / "crystal_preview.b64").write_text(base64.b64encode((OUT / "crystal_preview.png").read_bytes()).decode("ascii"), encoding="ascii")

img.scale(135, 240)
img.filepath_raw = str(OUT / "qa_thumb.jpg")
img.file_format = "JPEG"
img.save()
(OUT / "qa_thumb.b64").write_text(base64.b64encode((OUT / "qa_thumb.jpg").read_bytes()).decode("ascii"), encoding="ascii")

result = {
    "marker": "MORPHMINT_005_GEM_DESIGNER_G2_RENDER_PASS",
    "asset": "morphmint_material_shift_005",
    "stage": "CRYSTAL_GEM_DESIGNER_G2_QA",
    "route": "BLENDER_GEM_DESIGNER",
    "addon": {
        "repository": "Dekker3D/Blender-Gem-Designer",
        "commit": ADDON_COMMIT,
        "license": "GPL-3.0",
        "version": "1.0.1"
    },
    "design": {
        "source": "GemCad manual Standard Round Brilliant fixture",
        "gear": 96,
        "tiers": 7,
        "construction": "Gem Designer ASC importer + Geometry Nodes tier cutter"
    },
    "material": {
        "preset": "Diamond",
        "ior": d["main_ior"],
        "dispersion": d["dispersion"],
        "render_dispersion": "Full Dispersion"
    },
    "g2_changes": [
        "neutral world instead of packed HDRI",
        "narrow neutral jewelry strip reflections",
        "face-on canonical round camera",
        "near-flush transparent/frost identity"
    ],
    "resolution": "540x960",
    "engine": "CYCLES",
    "samples": 176,
    "ceramic": "PASS_LOCKED_UNTOUCHED",
    "chrome": "PASS_LOCKED_UNTOUCHED",
    "quality_gate_90": "PENDING_AI_VISUAL_QA",
    "transition_gate": "BLOCKED_UNTIL_CRYSTAL_QUALITY_90"
}
(OUT / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("MORPHMINT_005_GEM_DESIGNER_G2_RENDER_PASS")
