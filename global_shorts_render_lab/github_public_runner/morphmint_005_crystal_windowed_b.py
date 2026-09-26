import bpy, bmesh, math, pathlib, json
from mathutils import Vector

OUT = pathlib.Path("render_output/morphmint_005_crystal_windowed_b2")
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
        "selected": False,
    },
    {
        "id": "B_WINDOWED_FACETED_EDGE_SOLID",
        "summary": "Single thick clear crystal solid with a broad flat optical window and geometry-native faceted perimeter.",
        "strength": "Preserves premium clarity in the center while concentrating sparkle and cut grammar at the edge.",
        "risk": "Can read as plain glass if the edge cut or thickness is too weak.",
        "selected": True,
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

def glass_mat(name, color=(0.985, 1.0, 1.0, 1), rough=0.012, ior=1.545,
              absorption=(0.36, 0.78, 1.0, 1), density=0.00055):
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
    density=0.0012,
)

def frosted_crystal_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (0.62, 0.88, 1.0, 1)
    bs.inputs["Roughness"].default_value = 0.16
    if "Transmission Weight" in bs.inputs:
        bs.inputs["Transmission Weight"].default_value = 0.72
    if "IOR" in bs.inputs:
        bs.inputs["IOR"].default_value = 1.46
    return m

FROSTED_INLAY = frosted_crystal_mat("MM_FrostedCrystalInlay")

# ------------------------------------------------------------------
# Selected upstream grammar:
# A_TRUE_CUT_GEM_TOPOLOGY
#
# Unlike V21, this is not a smooth medallion plus torus/ring overlays.
# The transparent hero body itself is a closed, flat-shaded cut-gem mesh.
# ------------------------------------------------------------------
# B2 windowed-front + rear-pavilion crystal solid.
# The front remains a broad calm optical window. All premium sparkle grammar
# comes from real geometry on the perimeter and rear pavilion, visible through
# the clear body as a controlled internal starburst.
FRONT_SEG = 32
BACK_SEG = 16

verts = []
front_table = []
front_edge = []
back_edge = []
back_pavilion = []

for i in range(FRONT_SEG):
    a = 2.0 * math.pi * i / FRONT_SEG
    front_table.append(len(verts))
    verts.append((1.33 * math.cos(a), -0.285, 1.33 * math.sin(a)))
    front_edge.append(len(verts))
    verts.append((1.52 * math.cos(a), -0.115, 1.52 * math.sin(a)))
    back_edge.append(len(verts))
    verts.append((1.52 * math.cos(a), 0.100, 1.52 * math.sin(a)))

for i in range(BACK_SEG):
    a = 2.0 * math.pi * i / BACK_SEG
    back_pavilion.append(len(verts))
    verts.append((1.03 * math.cos(a), 0.335, 1.03 * math.sin(a)))

culet = len(verts)
verts.append((0.0, 0.610, 0.0))

faces = []
faces.append(tuple(front_table))

# Front precision chamfer: readable cut edge without breaking the window.
for i in range(FRONT_SEG):
    j = (i + 1) % FRONT_SEG
    faces.append((front_table[i], front_table[j], front_edge[j], front_edge[i]))

# Thick polished girdle.
for i in range(FRONT_SEG):
    j = (i + 1) % FRONT_SEG
    faces.append((front_edge[i], front_edge[j], back_edge[j], back_edge[i]))

# Rear pavilion: each 22.5-degree main facet family receives two 11.25-degree
# girdle sectors, producing an ordered starburst visible through the front.
for i in range(BACK_SEG):
    j = (i + 1) % BACK_SEG
    g0 = (2 * i) % FRONT_SEG
    g1 = (2 * i + 1) % FRONT_SEG
    g2 = (2 * i + 2) % FRONT_SEG
    faces.append((back_edge[g0], back_pavilion[i], back_edge[g1]))
    faces.append((back_edge[g1], back_pavilion[i], back_pavilion[j]))
    faces.append((back_edge[g1], back_pavilion[j], back_edge[g2]))

for i in range(BACK_SEG):
    j = (i + 1) % BACK_SEG
    faces.append((back_pavilion[i], back_pavilion[j], culet))

mesh = bpy.data.meshes.new("MorphMint_WindowedRearPavilion_Mesh")
mesh.from_pydata(verts, [], faces)
mesh.update()
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
mesh.validate(verbose=False)
mesh.update()

gem = bpy.data.objects.new("MorphMint_WindowedRearPavilion", mesh)
bpy.context.collection.objects.link(gem)
gem.data.materials.append(CRYSTAL)
for p in gem.data.polygons:
    p.use_smooth = False

# Preserve MorphMint's central identity bar as a cut optical insert, not a
# rounded opaque UI bar. It is shallow so the gem facets remain the hero.
bpy.ops.mesh.primitive_cube_add(location=(0.0, -0.318, 0.0))
bar = bpy.context.object
bar.name = "MorphMint_CutCrystalIdentityBar"
bar.scale = (0.125, 0.026, 0.70)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bar.data.materials.append(FROSTED_INLAY)
bev = bar.modifiers.new("IdentityBarSingleCut", "BEVEL")
bev.width = 0.055
bev.segments = 1

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

add_area("SoftKey", (-3.7,-4.4,5.0), 860, 4.6, (1.0,0.90,0.78))
add_area("CoolFill", (4.0,-3.2,1.1), 620, 3.8, (0.56,0.76,1.0))
add_area("TopRim", (0.1,0.2,5.6), 920, 3.0, (0.76,0.90,1.0))
add_area("SideCut", (-4.8,-0.8,-0.2), 260, 2.0, (0.48,0.78,1.0), rectangle=(0.52,3.8))

# Crystal optical environment A2.
# A1 proved that narrow ray-visible cards create giant black/white slabs inside
# the transparent object. A2 removes proxy-card geometry entirely.
# Camera sees the dark physical set; glossy/transmission rays are allowed to
# see a brighter neutral studio world so the real facets, not hidden props,
# generate the crystal pattern.
world = scene.world
world.use_nodes = True
wnt = world.node_tree
wnt.nodes.clear()
wout = wnt.nodes.new("ShaderNodeOutputWorld")
wbg = wnt.nodes.new("ShaderNodeBackground")
wbg.inputs["Color"].default_value = (0.16, 0.23, 0.34, 1)
wbg.inputs["Strength"].default_value = 0.72
wnt.links.new(wbg.outputs["Background"], wout.inputs["Surface"])

for obj in (floor, back):
    try:
        obj.visible_transmission = False
        obj.visible_glossy = False
    except Exception:
        pass

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
    "marker": "MORPHMINT_005_CRYSTAL_WINDOWED_B2_RENDER_PASS",
    "asset": "morphmint_material_shift_005",
    "stage": "CRYSTAL_STILL_GRAMMAR_QA",
    "resolution": f"{W}x{H}",
    "engine": "CYCLES",
    "samples": 112,
    "candidate_comparison": CANDIDATES,
    "selected_method": "B_WINDOWED_FRONT_REAR_PAVILION_B2",
    "visual_grammar": [
        "A-family true front faceting rejected below 90 because full-face facet patterns read opaque/fractured",
        "B1 clean windowed solid improved premium clarity but read too close to plain glass",
        "B2 keeps a broad flat front optical window and moves complex facet grammar to a real rear pavilion",
        "rear pavilion is geometry-native and ordered, intended to create a controlled internal starburst through refraction",
        "32-sided front/girdle preserves a near-round premium silhouette",
        "central MorphMint bar remains a shallow frosted crystal inset",
        "ceramic/chrome remain untouched PASS_LOCKED"
    ],
    "gate": "AI_VISUAL_QA_REQUIRED",
    "quality_gate_90": "PENDING",
    "transition_gate": "BLOCKED_UNTIL_CRYSTAL_QUALITY_90",
}
(OUT / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("MORPHMINT_005_CRYSTAL_WINDOWED_B2_RENDER_PASS")
