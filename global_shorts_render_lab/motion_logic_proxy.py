import bpy, math, os, sys, json
from mathutils import Vector, Quaternion

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
outdir = args[0] if args else os.path.join(os.getcwd(), "global_shorts_render_lab", "motion_logic_proxy")
os.makedirs(outdir, exist_ok=True)

# Clean scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 90
scene.render.fps = 18
scene.gravity = (0.0, 0.0, -9.81)
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 180
scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(outdir, "frame_")
scene.display.shading.light = 'STUDIO'
scene.display.shading.studio_light = 'paint.sl'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'WORLD'
scene.display.shading.curvature_ridge_factor = 1.5
scene.display.shading.curvature_valley_factor = 1.2
scene.world.color = (0.02, 0.025, 0.04)

def mat(name, rgba):
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba
    return m

MAT_FLOOR = mat("Floor", (0.055, 0.065, 0.09, 1))
MAT_RAMP = mat("Ramp", (0.12, 0.16, 0.22, 1))
MAT_BALL = mat("Ball", (0.05, 0.42, 1.0, 1))
MAT_DOMINO = mat("Domino", (1.0, 0.38, 0.06, 1))
MAT_GOAL = mat("Goal", (0.15, 0.9, 0.35, 1))

def add_cube(name, loc, scale, material, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return o

def add_passive(o, friction=0.6):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.rigidbody.object_add()
    o.rigid_body.type = 'PASSIVE'
    o.rigid_body.friction = friction
    o.rigid_body.restitution = 0.05
    o.select_set(False)

def add_active(o, mass=1.0, friction=0.5, restitution=0.1):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.rigidbody.object_add()
    o.rigid_body.type = 'ACTIVE'
    o.rigid_body.mass = mass
    o.rigid_body.friction = friction
    o.rigid_body.restitution = restitution
    o.select_set(False)

# Ground and side rails
floor = add_cube("Ground", (0,0,-0.18), (5.8,2.3,0.18), MAT_FLOOR, bevel=0.06)
add_passive(floor, 0.7)

# Inclined start ramp descending toward +X
ramp = add_cube("Ramp", (-2.9,0,0.68), (2.15,0.72,0.12), MAT_RAMP, rot=(0, math.radians(9), 0), bevel=0.05)
add_passive(ramp, 0.55)

# Low rails to keep marble readable/on-path
for y in (-0.82, 0.82):
    rail = add_cube("Rail", (-2.9,y,0.93), (2.2,0.08,0.22), MAT_RAMP, rot=(0, math.radians(9), 0), bevel=0.03)
    add_passive(rail, 0.5)

# Marble
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.42, location=(-4.20, 0, 1.72))
ball = bpy.context.object
ball.name = "BlueMarble"
ball.data.materials.append(MAT_BALL)
bpy.ops.object.shade_smooth()
add_active(ball, mass=1.2, friction=0.5, restitution=0.08)

# Domino chain
domino_xs = [-0.45, 0.12, 0.69, 1.26, 1.83, 2.40, 2.97]
dominos = []
for i, x in enumerate(domino_xs):
    d = add_cube(f"Domino_{i+1}", (x,0,0.62), (0.12,0.42,0.70), MAT_DOMINO, bevel=0.035)
    add_active(d, mass=0.38, friction=0.72, restitution=0.02)
    dominos.append(d)

# Goal bell/target
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.5, depth=0.18, location=(3.75,0,0.05))
goal_base = bpy.context.object
goal_base.data.materials.append(MAT_GOAL)
add_passive(goal_base, 0.7)

bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.38, location=(3.75,0,0.48))
goal = bpy.context.object
goal.name = "GoalBell"
goal.scale.z = 0.55
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
goal.data.materials.append(MAT_GOAL)
add_passive(goal, 0.6)

# Camera — portrait composition: map the long X-axis path onto screen vertical
bpy.ops.object.camera_add(location=(0.0, -10.5, 7.0))
cam = bpy.context.object
scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 11.6

def look_at_with_roll(obj, target, roll_deg=90):
    direction = Vector(target) - obj.location
    base = direction.to_track_quat('-Z', 'Y')
    roll = Quaternion((0, 0, 1), math.radians(roll_deg))
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = base @ roll

look_at_with_roll(cam, (-0.15, 0, 0.62), 90)

# Add simple area-like sun for preview depth
bpy.ops.object.light_add(type='SUN', location=(0,-4,8))
sun = bpy.context.object
sun.rotation_euler = (math.radians(28), math.radians(-20), math.radians(-28))
sun.data.energy = 2.2

# Rigid body solver quality
rw = scene.rigidbody_world
if rw:
    rw.substeps_per_frame = 12
    rw.solver_iterations = 20
    rw.point_cache.frame_start = 1
    rw.point_cache.frame_end = 45

# Headless rigid-body must be baked before render. Save first so cache has a stable mainfile.
blend_path = os.path.join(outdir, "motion_logic_proxy.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
scene.frame_set(scene.frame_start)
bpy.ops.ptcache.free_bake_all()
bake_result = bpy.ops.ptcache.bake_all(bake=True)
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

# Render baked animation
scene.frame_set(scene.frame_start)
bpy.ops.render.render(animation=True)

# Sample actual rigid-body state to separate "rendered" from "mechanism worked".
trace = []
for fno in (1, 30, 60, 90):
    scene.frame_set(fno)
    bpy.context.view_layer.update()
    trace.append({
        "frame": fno,
        "ball_location": [round(float(v), 4) for v in ball.matrix_world.translation],
        "domino_rot_y": [round(float(d.rotation_euler.y), 4) for d in dominos],
        "domino_rot_x": [round(float(d.rotation_euler.x), 4) for d in dominos],
    })
with open(os.path.join(outdir, "physics_trace.json"), "w", encoding="utf-8") as f:
    json.dump(trace, f, ensure_ascii=False, indent=2)

# Persist baked deterministic scene for later quality-frame reuse
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

meta = {
    "lane": "Motion Logic Lab",
    "stage": "LOW_RES_PHYSICS_PROXY",
    "engine": scene.render.engine,
    "resolution": [scene.render.resolution_x, scene.render.resolution_y],
    "fps": scene.render.fps,
    "frame_start": scene.frame_start,
    "frame_end": scene.frame_end,
    "mechanism": "gravity ramp -> marble -> domino chain -> goal",
    "composition_revision": "portrait path rotated into screen vertical; full ball-to-goal chain visible",
    "direct_cost_usd": 0,
    "rigid_body_bake": list(bake_result)
}
with open(os.path.join(outdir, "metadata.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)
