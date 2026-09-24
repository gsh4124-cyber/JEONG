import bpy, pathlib, json, mathutils

OUT = pathlib.Path("output")
OUT.mkdir(exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0)
obj=bpy.context.object
obj.name="PublicRunnerSmokeSphere"

mat=bpy.data.materials.new("SmokeMaterial")
mat.use_nodes=True
bsdf=mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value=(0.08,0.3,0.9,1)
bsdf.inputs["Metallic"].default_value=0.5
bsdf.inputs["Roughness"].default_value=0.2
obj.data.materials.append(mat)

bpy.ops.object.light_add(type='AREA', location=(3,-4,5))
bpy.context.object.data.energy=1200
bpy.context.object.data.size=4

bpy.ops.object.camera_add(location=(0,-6,0.6))
cam=bpy.context.object
cam.rotation_euler=(mathutils.Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera=cam

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=256
scene.render.resolution_y=256
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/"public_github_blender_smoke.png")

bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"public_github_blender_smoke.blend"))

result={
  "marker":"PUBLIC_GITHUB_BLENDER_SMOKE_PASS",
  "engine":scene.render.engine,
  "png":str(OUT/"public_github_blender_smoke.png"),
  "blend":str(OUT/"public_github_blender_smoke.blend")
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("PUBLIC_GITHUB_BLENDER_SMOKE_PASS")
