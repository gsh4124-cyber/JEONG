import bpy, os

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=270
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.fps=30
scene.render.image_settings.file_format='FFMPEG'
scene.render.ffmpeg.format='MPEG4'
scene.render.ffmpeg.codec='H264'
scene.render.ffmpeg.constant_rate_factor='MEDIUM'
scene.frame_start=max(scene.frame_start,1)
scene.frame_end=min(scene.frame_end,90)

out=os.environ.get("GS_PROXY_OUT", os.path.join(os.path.expanduser("~"),"GlobalShorts","renders"))
os.makedirs(out,exist_ok=True)
scene.render.filepath=os.path.join(out,"MorphMint_005_proxy.mp4")
bpy.ops.render.render(animation=True)
print("MORPHMINT_005_PROXY_RENDERED")
print(scene.render.filepath)
