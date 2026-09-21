import bpy, os, math, sys

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
outdir = args[0] if args else os.path.join(os.getcwd(), "global_shorts_render_lab", "quality_frame")
os.makedirs(outdir, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 540
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.color = (0.006, 0.008, 0.015)

# Eevee quality knobs compatible with Blender 5.2
if hasattr(scene, "eevee"):
    pass

# Upgrade all existing materials to Principled.
def set_principled(mat, base, metallic=0.0, rough=0.4, emission=None, emission_strength=0.0):
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if not bsdf:
        return
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.18
    if emission and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength

for mat in bpy.data.materials:
    name = mat.name.lower()
    if "ball" in name:
        set_principled(mat, (0.025,0.18,0.95,1), metallic=0.82, rough=0.16)
    elif "domino" in name:
        set_principled(mat, (0.95,0.13,0.025,1), metallic=0.12, rough=0.28)
    elif "goal" in name:
        set_principled(mat, (0.02,0.48,0.09,1), metallic=0.08, rough=0.22,
                       emission=(0.03,0.7,0.08,1), emission_strength=1.8)
    elif "ramp" in name:
        set_principled(mat, (0.055,0.075,0.12,1), metallic=0.35, rough=0.34)
    elif "floor" in name:
        set_principled(mat, (0.012,0.016,0.028,1), metallic=0.05, rough=0.52)

# Remove existing lights; rebuild a controlled three-light rig.
for o in list(bpy.data.objects):
    if o.type == 'LIGHT':
        bpy.data.objects.remove(o, do_unlink=True)

def add_area(name, loc, energy, size, color, target=(0.2,0,0.5)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.name = name
    l.data.energy = energy
    l.data.shape = 'DISK'
    l.data.size = size
    l.data.color = color
    import mathutils
    d = mathutils.Vector(target) - l.location
    l.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
    return l

add_area("Key", (-2.5,-4.5,7.0), 1500, 5.5, (1.0,0.84,0.70))
add_area("Fill", (4.0,-1.0,4.0), 900, 4.0, (0.60,0.75,1.0))
add_area("Rim", (1.0,4.5,5.5), 1200, 3.6, (0.55,0.70,1.0))

# Slightly tighten camera framing, preserving portrait path.
cam = scene.camera
if cam:
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 9.2

# Add subtle floor accent behind goal for payoff read.
bpy.ops.mesh.primitive_torus_add(major_radius=0.88, minor_radius=0.045, location=(2.95,0,0.18), rotation=(0,0,0))
ring = bpy.context.object
ring.name = "GoalAccent"
gmat = bpy.data.materials.get("Goal")
if gmat:
    ring.data.materials.append(gmat)

# Render first / action / payoff frames.
for fno, name in [(1,"quality_01_start.png"), (60,"quality_60_action.png"), (90,"quality_90_payoff.png")]:
    scene.frame_set(fno)
    scene.render.filepath = os.path.join(outdir, name)
    bpy.ops.render.render(write_still=True)

with open(os.path.join(outdir, "quality_meta.txt"), "w", encoding="utf-8") as f:
    f.write("engine=BLENDER_EEVEE\nresolution=540x960\nframes=1,60,90\n")
