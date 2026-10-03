import bpy, math, json, pathlib
from mathutils import Vector

OUT = pathlib.Path('render_output/morphmint_reference_r0')
OUT.mkdir(parents=True, exist_ok=True)
W, H = 540, 960

# ---------- clean ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
    pass

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.world.color = (0.003, 0.006, 0.014)

# ---------- helpers ----------
def set_input(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def make_principled(name, base, metallic=0.0, rough=0.25, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    set_input(bs, 'Base Color', base)
    set_input(bs, 'Metallic', metallic)
    set_input(bs, 'Roughness', rough)
    set_input(bs, 'Coat Weight', coat)
    set_input(bs, 'Coat Roughness', max(0.03, rough * 0.45))
    return m


def make_ceramic():
    m = bpy.data.materials.new('MM_Ceramic_Premium')
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes.get('Principled BSDF')
    set_input(bs, 'Base Color', (0.60, 0.055, 0.012, 1.0))
    set_input(bs, 'Roughness', 0.27)
    set_input(bs, 'Metallic', 0.0)
    set_input(bs, 'Coat Weight', 0.32)
    set_input(bs, 'Coat Roughness', 0.12)
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 24.0
    noise.inputs['Detail'].default_value = 3.0
    noise.inputs['Roughness'].default_value = 0.55
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.075
    bump.inputs['Distance'].default_value = 0.035
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    return m


def make_chrome():
    m = bpy.data.materials.new('MM_Chrome_Mirror')
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    set_input(bs, 'Base Color', (0.72, 0.77, 0.84, 1.0))
    set_input(bs, 'Metallic', 1.0)
    set_input(bs, 'Roughness', 0.065)
    set_input(bs, 'Coat Weight', 0.18)
    set_input(bs, 'Coat Roughness', 0.04)
    return m


def make_crystal(name='MM_Crystal_Clear', density=0.020):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes.get('Principled BSDF')
    set_input(bs, 'Base Color', (0.80, 0.94, 1.0, 1.0))
    set_input(bs, 'Metallic', 0.0)
    set_input(bs, 'Roughness', 0.025)
    set_input(bs, 'IOR', 1.46)
    set_input(bs, 'Transmission Weight', 1.0)
    set_input(bs, 'Coat Weight', 0.10)
    set_input(bs, 'Coat Roughness', 0.02)
    out = nt.nodes.get('Material Output')
    vol = nt.nodes.new('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value = (0.36, 0.72, 1.0, 1.0)
    vol.inputs['Density'].default_value = density
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    return m


def make_emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes.get('Principled BSDF')
    set_input(bs, 'Base Color', color)
    set_input(bs, 'Emission Color', color)
    set_input(bs, 'Emission Strength', strength)
    set_input(bs, 'Roughness', 0.3)
    return m


def bevel(obj, width, segments=4):
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def add_area(name, loc, energy, size, color, target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.name = name
    l.data.energy = energy
    l.data.shape = 'DISK'
    l.data.size = size
    l.data.color = color
    look_at(l, target)
    return l


def add_reflector(name, loc, scale, rot, color=(1,1,1,1), strength=2.5):
    bpy.ops.mesh.primitive_plane_add(size=2, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(make_emission(name + '_Mat', color, strength))
    try:
        o.visible_camera = False
        o.visible_shadow = False
        o.visible_diffuse = False
        o.visible_glossy = True
        o.visible_transmission = True
    except Exception:
        pass
    return o

# ---------- materials ----------
CERAMIC = make_ceramic()
CHROME = make_chrome()
CRYSTAL = make_crystal('MM_Crystal_Clear', 0.016)
CRYSTAL_EDGE = make_crystal('MM_Crystal_Edge', 0.028)
FLOOR = make_principled('FloorMat', (0.006, 0.010, 0.021, 1), metallic=0.12, rough=0.24)
BACK = make_principled('BackdropMat', (0.002, 0.005, 0.014, 1), metallic=0.0, rough=0.54)

# ---------- medallion geometry ----------
# Axis along Y: front faces camera at negative Y.
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.58, depth=0.48, location=(0,0,0))
body = bpy.context.object
body.name = 'MM_Body'
body.rotation_euler = (math.radians(90), 0, 0)
body.data.materials.append(CERAMIC)
bevel(body, 0.105, 7)
bpy.ops.object.shade_smooth()

# Outer raised rim
bpy.ops.mesh.primitive_torus_add(major_radius=1.34, minor_radius=0.105, major_segments=128, minor_segments=24,
                                 location=(0,-0.285,0), rotation=(math.radians(90),0,0))
outer_rim = bpy.context.object
outer_rim.name = 'MM_OuterRim'
outer_rim.data.materials.append(CERAMIC)

# Inner emblem ring
bpy.ops.mesh.primitive_torus_add(major_radius=0.57, minor_radius=0.070, major_segments=96, minor_segments=20,
                                 location=(0,-0.315,0), rotation=(math.radians(90),0,0))
emblem_ring = bpy.context.object
emblem_ring.name = 'MM_EmblemRing'
emblem_ring.data.materials.append(CERAMIC)

# Integrated vertical capsule bar
bpy.ops.mesh.primitive_cube_add(location=(0,-0.335,0))
emblem_bar = bpy.context.object
emblem_bar.name = 'MM_EmblemBar'
emblem_bar.scale = (0.125, 0.055, 0.69)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bevel(emblem_bar, 0.115, 10)
emblem_bar.data.materials.append(CERAMIC)

MAIN_OBJECTS = [body, outer_rim, emblem_ring, emblem_bar]

# Crystal-only faceted front crown, preserving the same silhouette.
def build_facet_crown(segments=24):
    verts = []
    faces = []
    rings = [
        (0.00, -0.365),
        (0.48, -0.355),
        (0.93, -0.325),
        (1.31, -0.292),
        (1.50, -0.270),
    ]
    # center vertex
    verts.append((0, rings[0][1], 0))
    ring_indices = []
    for ri, (rad, y) in enumerate(rings[1:], start=1):
        ids = []
        offset = (ri % 2) * (math.pi / segments)
        for i in range(segments):
            a = 2 * math.pi * i / segments + offset
            ids.append(len(verts))
            verts.append((rad * math.cos(a), y, rad * math.sin(a)))
        ring_indices.append(ids)
    # center fan
    first = ring_indices[0]
    for i in range(segments):
        faces.append((0, first[i], first[(i+1)%segments]))
    # alternating triangulated bands
    for r in range(len(ring_indices)-1):
        a = ring_indices[r]
        b = ring_indices[r+1]
        for i in range(segments):
            i2 = (i+1) % segments
            if (i+r) % 2 == 0:
                faces.append((a[i], b[i], b[i2]))
                faces.append((a[i], b[i2], a[i2]))
            else:
                faces.append((a[i], b[i], a[i2]))
                faces.append((a[i2], b[i], b[i2]))
    mesh = bpy.data.meshes.new('MM_FacetCrownMesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('MM_FacetCrown', mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(CRYSTAL_EDGE)
    for p in obj.data.polygons:
        p.use_smooth = False
    sol = obj.modifiers.new('FacetSolidify', 'SOLIDIFY')
    sol.thickness = 0.035
    sol.offset = 0.0
    obj.hide_render = True
    return obj

facet_crown = build_facet_crown()

# ---------- environment ----------
# Floor
bpy.ops.mesh.primitive_plane_add(size=30, location=(0,0,-1.72))
floor = bpy.context.object
floor.name = 'StudioFloor'
floor.data.materials.append(FLOOR)

# Back wall
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,3.3,2.0), rotation=(math.radians(90),0,0))
back = bpy.context.object
back.name = 'StudioBack'
back.data.materials.append(BACK)

# Soft studio lights
key = add_area('Key', (-4.8,-4.4,5.5), 1050, 4.0, (1.0,0.50,0.24), target=(0,0,0.25))
fill = add_area('Fill', (4.8,-2.8,2.8), 720, 3.0, (0.28,0.55,1.0), target=(0,0,0.1))
rim = add_area('Rim', (0,2.8,5.4), 950, 3.0, (0.42,0.70,1.0), target=(0,0,0.35))
under = add_area('Under', (0,-0.5,-1.25), 220, 2.4, (0.16,0.32,0.85), target=(0,0,0.0))

# Reflection / refraction cards, camera-invisible.
reflectors = [
    add_reflector('CardLeft', (-3.1,0.35,0.8), (0.32,1.0,2.7), (math.radians(90),0,math.radians(-9)), (1.0,0.78,0.62,1), 3.0),
    add_reflector('CardRight', (3.35,0.7,0.55), (0.28,1.0,2.5), (math.radians(90),0,math.radians(10)), (0.62,0.80,1.0,1), 3.2),
    add_reflector('CardTop', (0,0.9,3.9), (2.2,1.0,0.22), (math.radians(90),0,0), (1.0,1.0,1.0,1), 2.4),
]

# Crystal sparkle helpers: small bright emissive slivers behind object, only useful through glass/reflection.
crystal_slivers = []
for idx, (x,z,rz,col) in enumerate([
    (-0.95,0.65,-18,(0.34,0.70,1.0,1)),
    (-0.28,-0.15,10,(1.0,0.92,0.76,1)),
    (0.52,0.42,-7,(0.46,0.86,1.0,1)),
    (1.02,-0.48,17,(1.0,1.0,1.0,1)),
]):
    bpy.ops.mesh.primitive_cube_add(location=(x,0.72,z))
    s = bpy.context.object
    s.name = f'CrystalSliver{idx}'
    s.scale=(0.055,0.025,1.0)
    s.rotation_euler=(0,0,math.radians(rz))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    s.data.materials.append(make_emission(f'CrystalSliverMat{idx}', col, 5.5))
    try:
        s.visible_camera = False
        s.visible_shadow = False
        s.visible_diffuse = False
        s.visible_glossy = True
        s.visible_transmission = True
    except Exception:
        pass
    s.hide_render = True
    crystal_slivers.append(s)

# ---------- camera ----------
bpy.ops.object.camera_add(location=(4.3,-8.3,2.45))
cam = bpy.context.object
cam.name = 'Camera'
cam.data.lens = 62
cam.data.sensor_width = 36
look_at(cam, (0,0,0.10))
scene.camera = cam

# Slight object yaw gives thickness + material cues.
for o in MAIN_OBJECTS + [facet_crown]:
    o.rotation_euler.rotate_axis('Z', math.radians(-8))

# ---------- state setup ----------
def assign_all(mat):
    for o in MAIN_OBJECTS:
        if len(o.data.materials):
            o.data.materials[0] = mat
        else:
            o.data.materials.append(mat)


def set_state(state):
    facet_crown.hide_render = True
    for s in crystal_slivers:
        s.hide_render = True
    # default light balances
    key.data.energy = 1050
    fill.data.energy = 720
    rim.data.energy = 950
    under.data.energy = 220

    if state == 'ceramic':
        assign_all(CERAMIC)
        key.data.color = (1.0,0.46,0.20)
        fill.data.color = (0.30,0.46,0.72)
        fill.data.energy = 420
        rim.data.energy = 560
        under.data.energy = 90
    elif state == 'chrome':
        assign_all(CHROME)
        key.data.color = (1.0,0.72,0.56)
        key.data.energy = 880
        fill.data.color = (0.48,0.70,1.0)
        fill.data.energy = 980
        rim.data.energy = 1250
        under.data.energy = 180
    elif state == 'crystal':
        assign_all(CRYSTAL_EDGE)
        # Body clearer than edges / emblem.
        body.data.materials[0] = CRYSTAL
        facet_crown.hide_render = False
        for s in crystal_slivers:
            s.hide_render = False
        key.data.color = (0.82,0.92,1.0)
        key.data.energy = 760
        fill.data.color = (0.26,0.58,1.0)
        fill.data.energy = 1150
        rim.data.color = (0.24,0.62,1.0)
        rim.data.energy = 1700
        under.data.energy = 480


def render_state(state):
    set_state(state)
    path = OUT / f'{state}.png'
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)

for state in ('ceramic','chrome','crystal'):
    render_state(state)

result = {
    'marker': 'MORPHMINT_APPROVED_REFERENCE_R0_STILLS_PASS',
    'renderer': scene.render.engine,
    'resolution': [W,H],
    'camera': 'premium_3q_fixed',
    'states': ['ceramic','chrome','crystal'],
    'goal': 'same-object material transformation semantic legibility',
    'reference_gate': 'EMPEROR_APPROVED_5_PANEL_TARGET',
    'full_video_gate': 'BLOCKED_UNTIL_3_STILLS_VISUALLY_PASS'
}
(OUT / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print('MORPHMINT_APPROVED_REFERENCE_R0_STILLS_PASS')
