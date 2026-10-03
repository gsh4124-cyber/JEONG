import bpy, math, os, shutil
from mathutils import Vector
OUT='/tmp/core_visual_proof_odd_factory'; FRAMES=OUT+'/frames'; os.makedirs(FRAMES,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='BLENDER_WORKBENCH'
sc.display.shading.light='STUDIO'; sc.display.shading.studio_light='paint.sl'; sc.display.shading.color_type='MATERIAL'; sc.display.shading.show_shadows=True; sc.display.shading.show_cavity=True; sc.display.shading.cavity_type='WORLD'
# Visual Proof is a cheap storyboard gate, not the final render. Render only 3 decisive frames.
sc.render.resolution_x=270; sc.render.resolution_y=480; sc.render.resolution_percentage=100; sc.render.fps=3; sc.frame_start=1; sc.frame_end=30; sc.render.image_settings.file_format='PNG'; sc.render.film_transparent=False
sc.world=bpy.data.worlds.new('World'); sc.world.color=(0.008,0.01,0.018)
def mat(name,c):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); return m
black=mat('obsidian',(0.025,.035,.055)); gold=mat('gold',(.85,.34,.04)); cyan=mat('cyan',(.02,.62,.95)); red=mat('apple',(.8,.025,.018)); pearl=mat('pearl',(.72,.84,.95))
def track(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=3.5,depth=.28,location=(0,0,-.45)); bpy.context.object.data.materials.append(black)
for x in (-2.15,2.15):
 bpy.ops.mesh.primitive_cube_add(location=(x,.15,.85),scale=(.22,.42,1.65)); o=bpy.context.object; o.data.materials.append(black); be=o.modifiers.new('bevel','BEVEL'); be.width=.15; be.segments=1
bpy.ops.mesh.primitive_torus_add(major_radius=1.55,minor_radius=.18,major_segments=24,minor_segments=6,location=(0,0,.9),rotation=(math.pi/2,0,0)); bpy.context.object.data.materials.append(gold)
bpy.ops.mesh.primitive_torus_add(major_radius=1.22,minor_radius=.055,major_segments=24,minor_segments=6,location=(0,-.03,.9),rotation=(math.pi/2,0,0)); bpy.context.object.data.materials.append(cyan)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.62,location=(0,0,.92)); apple=bpy.context.object; apple.scale=(1,.88,.92); apple.data.materials.append(red); apple.keyframe_insert('scale',frame=1); apple.scale=(.78,.68,.72); apple.keyframe_insert('scale',frame=13)
bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.07,depth=.38,location=(0,0,1.55)); stem=bpy.context.object; stem.data.materials.append(gold); stem.keyframe_insert('scale',frame=1); stem.scale=(.1,.1,.1); stem.keyframe_insert('scale',frame=15)
for i in range(8):
 a=2*math.pi*i/8; bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.42,location=(.62*math.cos(a),0,.92+.62*math.sin(a))); p=bpy.context.object; p.scale=(.72,.28,1.35); p.rotation_euler[1]=a; p.data.materials.append(gold if i%2==0 else pearl); p.scale=(.01,.01,.01); p.keyframe_insert('scale',frame=12); p.scale=(.72,.28,1.35); p.keyframe_insert('scale',frame=23)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.36,location=(0,-.03,.92)); core=bpy.context.object; core.data.materials.append(cyan); core.scale=(.01,.01,.01); core.keyframe_insert('scale',frame=12); core.scale=(1,1,1); core.keyframe_insert('scale',frame=21)
apple.scale=(.05,.05,.05); apple.keyframe_insert('scale',frame=18)
bpy.ops.mesh.primitive_torus_add(major_radius=.72,minor_radius=.04,major_segments=20,minor_segments=5,location=(0,-.08,.92),rotation=(math.pi/2,0,0)); sw=bpy.context.object; sw.data.materials.append(cyan); sw.scale=(.2,.2,.2); sw.keyframe_insert('scale',frame=10); sw.scale=(2.2,2.2,2.2); sw.keyframe_insert('scale',frame=19)
bpy.ops.object.camera_add(location=(0,-8.2,2.8)); cam=bpy.context.object; sc.camera=cam; cam.data.lens=58; track(cam,(0,0,.85)); cam.keyframe_insert('location',frame=1); cam.location=(0,-7.6,2.6); cam.keyframe_insert('location',frame=30)
# Render only hook / reveal / payoff. This avoids spending runner minutes on 27 redundant proof frames.
for frame,name in [(1,'frame_001_hook.png'),(16,'frame_016_reveal.png'),(30,'frame_030_payoff.png')]:
 sc.frame_set(frame); sc.render.filepath=f'{FRAMES}/{name}'; bpy.ops.render.render(write_still=True)
 src=f'{FRAMES}/{name}'; dst=OUT+'/'+name
 if not os.path.isfile(src) or os.path.getsize(src)==0: raise RuntimeError('missing '+src)
 shutil.copy2(src,dst)
with open(OUT+'/result.txt','w') as fh: fh.write('ODD_FACTORY_VISUAL_PROOF_KEYFRAMES_RENDERED\n3 keyframes\n270x480\nhook/reveal/payoff\nworkbench\n')
print('ODD_FACTORY_VISUAL_PROOF_KEYFRAMES_RENDERED')