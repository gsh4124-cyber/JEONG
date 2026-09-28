import bpy, json, pathlib
out=pathlib.Path('/tmp/hwangje_support_smoke'); out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=256; scene.render.resolution_y=256; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0)
bpy.ops.object.camera_add(location=(0,-6,0))
cam=bpy.context.object; cam.rotation_euler=(1.5708,0,0); scene.camera=cam
scene.render.filepath=str(out/'smoke.png')
bpy.ops.render.render(write_still=True)
(out/'result.json').write_text(json.dumps({'marker':'HWANGJE_GLOBAL_SHORTS_RUNTIME_PASS','engine':scene.render.engine}),encoding='utf-8')
print('HWANGJE_GLOBAL_SHORTS_RUNTIME_PASS')
