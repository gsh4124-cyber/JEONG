import bpy, math, os, json
from mathutils import Vector

OUT='/tmp/hidden_shift_001'
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1080; scene.render.resolution_y=1920; scene.render.resolution_percentage=50
scene.render.image_settings.file_format='PNG'
scene.render.fps=30
scene.frame_start=1; scene.frame_end=300
scene.world.color=(0.025,0.03,0.04)

def mat(name,c,metal=0.0,rough=.45):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.metallic=metal; m.roughness=rough; return m
white=mat('ivory',(0.72,.69,.62)); wood=mat('wood',(.20,.08,.035)); red=mat('red',(.65,.035,.025)); green=mat('green',(.04,.42,.16)); blue=mat('blue',(.04,.18,.58)); gold=mat('gold',(.7,.38,.04),.7,.22)

def cube(name,loc,scale,ma,bevel=.05):
 bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(ma)
 if bevel: mod=o.modifiers.new('soft','BEVEL'); mod.width=bevel; mod.segments=3
 return o
# tabletop and back wall
cube('table',(0,0,-.35),(4.8,3,.3),wood,.08); cube('back',(0,2.7,3.2),(4.8,.18,3.8),white,.05)
# three obvious colored blocks; only center changes position after observation window
cube('left',(-1.8,.1,.35),(.55,.55,.7),red,.12)
center=cube('center',(0,.1,.35),(.55,.55,.7),green,.12)
cube('right',(1.8,.1,.35),(.55,.55,.7),blue,.12)
# distinct gold token creates a fair landmark; stays fixed
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.34,depth=.12,location=(0,-1.15,.05)); token=bpy.context.object; token.data.materials.append(gold)
# single meaningful shift: green block moves behind token at frame 151, no other scene change
center.keyframe_insert('location',frame=150); center.location.x=.78; center.keyframe_insert('location',frame=151); center.keyframe_insert('location',frame=270)
# camera locked
bpy.ops.object.camera_add(location=(0,-10.5,5.8)); cam=bpy.context.object; scene.camera=cam
def track(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
track(cam,(0,.1,.55)); cam.data.lens=53
# lighting
bpy.ops.object.light_add(type='AREA',location=(-3,-4,7)); bpy.context.object.data.energy=950; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=5
track(bpy.context.object,(0,0,.5))
bpy.ops.object.light_add(type='AREA',location=(3,-1,4)); bpy.context.object.data.energy=650; bpy.context.object.data.size=4; track(bpy.context.object,(0,0,.5))
# render representative before/after frames for automated market-gate proof
for f,label in [(90,'before'),(210,'after')]:
 scene.frame_set(f); scene.render.filepath=f'{OUT}/{label}.png'; bpy.ops.render.render(write_still=True)
with open(f'{OUT}/result.json','w') as fp: json.dump({'marker':'HIDDEN_SHIFT_001_RENDER_PASS','episode':'hidden_shift_001','mechanism':'single_object_lateral_shift','before_frame':90,'after_frame':210,'camera_locked':True,'intentional_changes':1},fp)
print('HIDDEN_SHIFT_001_RENDER_PASS')
