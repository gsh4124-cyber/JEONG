import bpy, pathlib, json, mathutils

OUT=pathlib.Path("render_output/jeong_public_smoke")
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0)
obj=bpy.context.object
mat=bpy.data.materials.new("JEONG_Smoke_Material")
mat.use_nodes=True
bsdf=mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value=(0.08,0.30,0.90,1)
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
scene.render.filepath=str(OUT/"jeong_public_blender_smoke.png")

bpy.ops.render.render(write_still=True)
(OUT/"result.json").write_text(json.dumps({
  "marker":"JEONG_PUBLIC_BLENDER_SMOKE_PASS",
  "engine":scene.render.engine
},indent=2),encoding="utf-8")
print("JEONG_PUBLIC_BLENDER_SMOKE_PASS")
