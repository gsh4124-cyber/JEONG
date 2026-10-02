import bpy, math, os, shutil
from mathutils import Vector
OUT='/tmp/core_visual_proof_odd_factory'; FRAMES=OUT+'/frames'; os.makedirs(FRAMES,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=360; sc.render.resolution_y=640; sc.render.resolution_percentage=100
sc.render.fps=12; sc.frame_start=1; sc.frame_end=30; sc.render.image_settings.file_format='PNG'; sc.render.film_transparent=False
sc.world=bpy.data.worlds.new('World'); sc.world.color=(0.006,0.008,0.015)
try: sc.view_settings.look='AgX - Medium High Contrast'
except: pass

def mat(name,c,metal=0,rough=.35,emit=None,strength=0):
 m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*c,1); b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=rough
 if emit:
  if 'Emission Color' in b.inputs: b.inputs['Emission Color'].default_value=(*emit,1)
  if 'Emission Strength' in b.inputs: b.inputs['Emission Strength'].default_value=strength
 return m
black=mat('black',(0.012,.016,.024),.7,.22); gold=mat('gold',(.42,.16,.025),.9,.18); cyan=mat('cyan',(.01,.25,.38),.2,.2,(.02,.75,1),5); red=mat('apple',(.5,.018,.012),.15,.22); pearl=mat('pearl',(.72,.82,.9),.45,.18)
def track(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=3.5,depth=.28,location=(0,0,-.45)); bpy.context.object.data.materials.append(black)
for x in (-2.15,2.15):
 bpy.ops.mesh.primitive_cube_add(location=(x,.15,.85),scale=(.22,.42,1.65)); o=bpy.context.object; o.data.materials.append(black); be=o.modifiers.new('bevel','BEVEL'); be.width=.15; be.segments=3
bpy.ops.mesh.primitive_torus_add(major_radius=1.55,minor_radius=.18,major_segments=48,minor_segments=10,location=(0,0,.9),rotation=(math.pi/2,0,0)); bpy.context.object.data.materials.append(gold)
bpy.ops.mesh.primitive_torus_add(major_radius=1.22,minor_radius=.055,major_segments=48,minor_segments=8,location=(0,-.03,.9),rotation=(math.pi/2,0,0)); bpy.context.object.data.materials.append(cyan)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.62,location=(0,0,.92)); apple=bpy.context.object; apple.scale=(1,.88,.92); apple.data.materials.append(red); apple.keyframe_insert('scale',frame=1); apple.scale=(.78,.68,.72); apple.keyframe_insert('scale',frame=13)
bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.07,depth=.38,location=(0,0,1.55)); stem=bpy.context.object; stem.data.materials.append(gold); stem.keyframe_insert('scale',frame=1); stem.scale=(.1,.1,.1); stem.keyframe_insert('scale',frame=15)
for i in range(8):
 a=2*math.pi*i/8; bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.42,location=(.62*math.cos(a),0,.92+.62*math.sin(a))); p=bpy.context.object; p.scale=(.72,.28,1.35); p.rotation_euler[1]=a; p.data.materials.append(gold if i%2==0 else pearl); p.scale=(.01,.01,.01); p.keyframe_insert('scale',frame=12); p.scale=(.72,.28,1.35); p.keyframe_insert('scale',frame=23)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.36,location=(0,-.03,.92)); core=bpy.context.object; core.data.materials.append(cyan); core.scale=(.01,.01,.01); core.keyframe_insert('scale',frame=12); core.scale=(1,1,1); core.keyframe_insert('scale',frame=21)
apple.scale=(.05,.05,.05); apple.keyframe_insert('scale',frame=18)
bpy.ops.mesh.primitive_torus_add(major_radius=.72,minor_radius=.04,major_segments=36,minor_segments=8,location=(0,-.08,.92),rotation=(math.pi/2,0,0)); sw=bpy.context.object; sw.data.materials.append(cyan); sw.scale=(.2,.2,.2); sw.keyframe_insert('scale',frame=10); sw.scale=(2.2,2.2,2.2); sw.keyframe_insert('scale',frame=19)
bpy.ops.object.camera_add(location=(0,-8.2,2.8)); cam=bpy.context.object; sc.camera=cam; cam.data.lens=58; track(cam,(0,0,.85)); cam.keyframe_insert('location',frame=1); cam.location=(0,-7.6,2.6); cam.keyframe_insert('location',frame=30)
for loc,energy,color,size in [((0,-4,5),900,(1,1,1),4),((3,-2,2.5),650,(.08,.5,1),2.5),((-3,-1,2),500,(1,.24,.05),2)]:
 bpy.ops.object.light_add(type='AREA',location=loc); l=bpy.context.object; l.data.energy=energy; l.data.color=color; l.data.shape='DISK'; l.data.size=size; track(l,(0,0,.8))
sc.render.filepath=FRAMES+'/frame_'; bpy.ops.render.render(animation=True)
for f,name in [(1,'frame_001_hook.png'),(16,'frame_016_reveal.png'),(30,'frame_030_payoff.png')]:
 src=f'{FRAMES}/frame_{f:04d}.png'; dst=OUT+'/'+name
 if not os.path.isfile(src) or os.path.getsize(src)==0: raise RuntimeError('missing '+src)
 shutil.copy2(src,dst)
with open(OUT+'/result.txt','w') as fh: fh.write('ODD_FACTORY_VISUAL_PROOF_FRAMES_RENDERED\n30 frames\n360x640\n12fps\n2.5s\n')
print('ODD_FACTORY_VISUAL_PROOF_FRAMES_RENDERED')