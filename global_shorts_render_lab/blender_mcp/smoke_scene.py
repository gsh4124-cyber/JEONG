import bpy, os, math

OUT = os.environ.get("GS_SMOKE_OUT", os.path.join(os.path.expanduser("~"), "GlobalShorts", "renders"))
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(0,0,0))
sphere=bpy.context.object
sphere.name="MCP_Smoke_Sphere"

mat=bpy.data.materials.new("SmokeMaterial")
mat.diffuse_color=(0.15,0.35,0.8,1)
sphere.data.materials.append(mat)

bpy.ops.object.light_add(type='AREA', location=(2.5,-3.0,4.0))
light=bpy.context.object
light.name="MCP_Smoke_Key"
light.data.energy=900
light.data.shape='DISK'
light.data.size=3.0

bpy.ops.object.camera_add(location=(0,-5.5,0.4))
cam=bpy.context.object
cam.name="MCP_Smoke_Camera"
bpy.context.scene.camera=cam

def look_at(obj, target=(0,0,0)):
    import mathutils
    direction=mathutils.Vector(target)-obj.location
    obj.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()

look_at(cam)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=64
scene.render.resolution_y=64
scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(OUT,"blender_mcp_smoke.png")
scene.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True)

blend_path=os.path.join(OUT,"blender_mcp_smoke.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

assert os.path.exists(scene.render.filepath)
assert os.path.exists(blend_path)
print("BLENDER_MCP_LOCAL_SMOKE_PASS")
print(scene.render.filepath)
print(blend_path)
