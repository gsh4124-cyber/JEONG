import bpy, bmesh, math, pathlib, json
from mathutils import Vector

OUT = pathlib.Path("render_output/morphmint_005_crystal_cutgem_a")
OUT.mkdir(parents=True, exist_ok=True)
W, H = 540, 960

# Clean factory scene.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.engine = "CYCLES"
scene.cycles.samples = 112
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 12
scene.cycles.transmission_bounces = 12
scene.cycles.glossy_bounces = 8
scene.cycles.diffuse_bounces = 3
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world.color = (0.002, 0.005, 0.014)

CANDIDATES = [
    {
        "id": "A_TRUE_CUT_GEM_TOPOLOGY",
        "summary": "Single closed cut-gem body with real table/crown/girdle/pavilion planar facets.",
        "strength": "Facet grammar is intrinsic to the object, so silhouette, highlight and refraction all agree.",
        "risk": "Requires disciplined topology and facet count.",
        "selected": True,
    },
    {
        "id": "B_MODULAR_BEVELLED_PRIMITIVES",
        "summary": "Reusable bevelled wedges/prisms assembled around a transparent core.",
        "strength": "Fast and deterministic art direction.",
        "risk": "Can read as decorative gear/jewelry trim instead of premium cut crystal.",
        "selected": False,
    },
    {
        "id": "C_GEOMETRY_NODES_FACET_GRAMMAR",
        "summary": "Geometry Nodes driven irregular facet/cell system.",
        "strength": "High variation and transferability.",
        "risk": "Can drift toward cracked-ice/noise and repeat the procedural-look failure.",
        "selected": False,
    },
]

def principled(name, base, metallic=0.0, rough=0.35):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    return m

def glass_mat(name, color=(0.985, 1.0, 1.0, 1), rough=0.006, ior=1.545,
              absorption=(0.36, 0.78, 1.0, 1), density=0.0022):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    glass = nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["Color"].default_value = color
    glass.inputs["Roughness"].default_value = rough
    glass.inputs["IOR"].default_value = ior
    vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value = absorption
    vol.inputs["Density"].default_value = density
    nt.links.new(glass.outputs["BSDF"], out.inputs["Surface"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return m

CRYSTAL = glass_mat("MM_CutGemCrystal")
CRYSTAL_ACCENT = glass_mat(
    "MM_CutGemAccent",
    color=(0.94, 0.995, 1.0, 1),
    rough=0.004,
    ior=1.57,
    absorption=(0.15, 0.64, 1.0, 1),
    density=0.004,
)

# ------------------------------------------------------------------
# Selected upstream grammar:
# A_TRUE_CUT_GEM_TOPOLOGY
#
# Unlike V21, this is not a smooth medallion plus torus/ring overlays.
# The transparent hero body itself is a closed, flat-shaded cut-gem mesh.
# ------------------------------------------------------------------
SEG = 24
rings = [
    # name, radius, y-depth, angular offset
    ("table",     0.74, -0.235, 0.0),
    ("star",      1.02, -0.190, math.pi / SEG),
    ("bezel",     1.31, -0.105, 0.0),
    ("girdle_f",  1.52, -0.028, math.pi / SEG),
    ("girdle_b",  1.52,  0.032, math.pi / SEG),
    ("pavilion",  1.08,  0.155, 0.0),
]

verts = []
ring_idx = {}
for name, radius, y, offset in rings:
    ids = []
    for i in range(SEG):
        a = 2.0 * math.pi * i / SEG + offset
        ids.append(len(verts))
        verts.append((radius * math.cos(a), y, radius * math.sin(a)))
    ring_idx[name] = ids

culet_idx = len(verts)
verts.append((0.0, 0.285, 0.0))

faces = []

# Table front face points toward camera (-Y).
faces.append(tuple(ring_idx["table"]))

def bridge_quads(a_ids, b_ids):
    for i in range(SEG):
        j = (i + 1) % SEG
        # Winding will be normalized by bmesh recalc.
        faces.append((a_ids[i], a_ids[j], b_ids[j], b_ids[i]))

def bridge_tri_alternating(a_ids, b_ids):
    # Two planar triangular facets per sector make the crown visibly cut,
    # rather than merely polygonal.
    for i in range(SEG):
        j = (i + 1) % SEG
        if i % 2 == 0:
            faces.append((a_ids[i], a_ids[j], b_ids[i]))
            faces.append((a_ids[j], b_ids[j], b_ids[i]))
        else:
            faces.append((a_ids[i], a_ids[j], b_ids[j]))
            faces.append((a_ids[i], b_ids[j], b_ids[i]))

bridge_tri_alternating(ring_idx["table"], ring_idx["star"])
bridge_tri_alternating(ring_idx["star"], ring_idx["bezel"])
bridge_tri_alternating(ring_idx["bezel"], ring_idx["girdle_f"])
bridge_quads(ring_idx["girdle_f"], ring_idx["girdle_b"])
bridge_tri_alternating(ring_idx["girdle_b"], ring_idx["pavilion"])

for i in range(SEG):
    j = (i + 1) % SEG
    faces.append((ring_idx["pavilion"][i], ring_idx["pavilion"][j], culet_idx))

mesh = bpy.data.meshes.new("MorphMint_CutGemBody_Mesh")
mesh.from_pydata(verts, [], faces)
mesh.update()

bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
mesh.validate(verbose=False)
mesh.update()

gem = bpy.data.objects.new("MorphMint_CutGemBody", mesh)
bpy.context.collection.objects.link(gem)
gem.data.materials.append(CRYSTAL)
for p in gem.data.polygons:
    p.use_smooth = False

# Preserve MorphMint's central identity bar as a cut optical insert, not a
# rounded opaque UI bar. It is shallow so the gem facets remain the hero.
bpy.ops.mesh.primitive_cube_add(location=(0.0, -0.255, 0.0))
bar = bpy.context.object
bar.name = "MorphMint_CutCrystalIdentityBar"
bar.scale = (0.125, 0.026, 0.70)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bar.data.materials.append(CRYSTAL_ACCENT)
bev = bar.modifiers.new("IdentityBarSingleCut", "BEVEL")
bev.width = 0.055
bev.segments = 1

# Small octagonal optical seal gives the center a controlled focal glint.
bpy.ops.mesh.primitive_cylinder_add(
    vertices=8, radius=0.19, depth=0.035,
    location=(0.0, -0.286, 0.0),
    rotation=(math.radians(90), 0.0, 0.0),
)
seal = bpy.context.object
seal.name = "MorphMint_CutCrystalSeal"
seal.data.materials.append(CRYSTAL_ACCENT)
for p in seal.data.polygons:
    p.use_smooth = False

# Dark studio floor and backdrop: visible to camera, excluded from transmission
# so giant background polygons do not appear inside the gem.
floor_mat = principled("FloorMat", (0.008, 0.013, 0.026, 1), 0.0, 0.42)
back_mat = principled("BackdropMat", (0.002, 0.006, 0.018, 1), 0.0, 0.58)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 2.0, -2.25))
floor = bpy.context.object
floor.name = "MorphMint_Floor"
floor.data.materials.append(floor_mat)

bpy.ops.mesh.primitive_plane_add(size=18, location=(0, 3.0, 1.1), rotation=(math.radians(90),0,0))
back = bpy.context.object
back.name = "MorphMint_Backdrop"
back.data.materials.append(back_mat)

for obj in (floor, back):
    try:
        obj.visible_transmission = False
    except Exception:
        pass

# Broad studio areas reveal whole facet planes.
def add_area(name, loc, energy, size, color, rectangle=None):
    bpy.ops.object.light_add(type="AREA", location=loc)
    l = bpy.context.object
    l.name = name
    l.data.energy = energy
    l.data.color = color
    if rectangle:
        l.data.shape = "RECTANGLE"
        l.data.size = rectangle[0]
        l.data.size_y = rectangle[1]
    else:
        l.data.size = size
    l.rotation_euler = (Vector((0,0,0)) - l.location).to_track_quat("-Z","Y").to_euler()
    return l

add_area("SoftKey", (-3.7,-4.4,5.0), 1080, 4.0, (1.0,0.76,0.58))
add_area("CoolFill", (4.0,-3.2,1.1), 760, 3.2, (0.38,0.65,1.0))
add_area("TopRim", (0.1,0.2,5.6), 1450, 2.5, (0.62,0.86,1.0))
add_area("SideCut", (-4.8,-0.8,-0.2), 470, 2.0, (0.35,0.80,1.0), rectangle=(0.30,3.7))

# Camera-invisible optical cards: unlike V21's hidden_render cards, these stay
# in the ray scene so transmission/reflection receives crisp premium gradients.
def emissive_card(name, loc, scale, rz, color, strength):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    p = bpy.context.object
    p.name = name
    p.scale = scale
    p.rotation_euler = (0.0, 0.0, math.radians(rz))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    m = bpy.data.materials.new(name + "_Mat")
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = color
    bs.inputs["Roughness"].default_value = 0.32
    if "Emission Color" in bs.inputs:
        bs.inputs["Emission Color"].default_value = color
        bs.inputs["Emission Strength"].default_value = strength
    p.data.materials.append(m)

    try:
        p.visible_camera = False
        p.visible_diffuse = False
        p.visible_shadow = False
        p.visible_glossy = True
        p.visible_transmission = True
    except Exception:
        pass
    return p

emissive_card("OpticalWarm", (-1.45, 1.30, 0.28), (0.11,0.025,1.80), -13, (1.0,0.66,0.34,1), 4.8)
emissive_card("OpticalIceA", (-0.46, 1.38,-0.08), (0.075,0.025,2.10),  7, (0.68,0.92,1.0,1), 5.2)
emissive_card("OpticalIceB", ( 0.48, 1.32,0.20), (0.090,0.025,1.90), -9, (0.24,0.70,1.0,1), 4.7)
emissive_card("OpticalWhite",( 1.42, 1.24,-0.18), (0.090,0.025,1.65), 16, (1.0,1.0,1.0,1), 4.2)

# Existing MorphMint 3Q product camera is retained so this tests asset grammar,
# not a camera rescue.
bpy.ops.object.camera_add(location=(0.95,-10.25,0.72))
cam = bpy.context.object
cam.name = "MorphMint_Camera"
cam.data.lens = 68
target = Vector((0.0,0.0,0.05))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z","Y").to_euler()
scene.camera = cam

scene.render.filepath = str(OUT / "crystal.png")
bpy.ops.render.render(write_still=True)

# Compact preview is persisted as both PNG and base64 text by the workflow so
# Chat can inspect the exact current render instead of relying on stale images.
img = bpy.data.images.load(str(OUT / "crystal.png"), check_existing=False)
img.scale(270, 480)
img.filepath_raw = str(OUT / "crystal_preview.png")
img.file_format = "PNG"
img.save()

result = {
    "marker": "MORPHMINT_005_CRYSTAL_CUTGEM_A_RENDER_PASS",
    "asset": "morphmint_material_shift_005",
    "stage": "CRYSTAL_STILL_GRAMMAR_QA",
    "resolution": f"{W}x{H}",
    "engine": "CYCLES",
    "samples": 112,
    "candidate_comparison": CANDIDATES,
    "selected_method": "A_TRUE_CUT_GEM_TOPOLOGY",
    "visual_grammar": [
        "single closed crystal body; no torus crown/rim/glint overlays",
        "real table/star/bezel/girdle/pavilion planar facet topology",
        "flat-shaded facets create geometry-native highlight/refraction changes",
        "central identity bar retained as shallow cut optical insert",
        "camera-invisible but ray-visible optical cards provide premium crystal gradients",
        "ceramic/chrome remain untouched PASS_LOCKED",
    ],
    "gate": "AI_VISUAL_QA_REQUIRED",
    "quality_gate_90": "PENDING",
    "transition_gate": "BLOCKED_UNTIL_CRYSTAL_QUALITY_90",
}
(OUT / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("MORPHMINT_005_CRYSTAL_CUTGEM_A_RENDER_PASS")
