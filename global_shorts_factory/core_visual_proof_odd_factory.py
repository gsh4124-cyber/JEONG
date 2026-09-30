import bpy, math, os
from mathutils import Vector

OUT='/tmp/core_visual_proof_odd_factory'
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE_NEXT'
sc.render.resolution_x=540; sc.render.resolution_y=960; sc.render.resolution_percentage=100
sc.render.fps=24; sc.frame_start=1; sc.frame_end=60
sc.render.image_settings.file_format='PNG'
sc.render.film_transparent=False
sc.world.color=(0.003,0.005,0.012)

# color management
sc.view_settings.look='AgX - Medium High Contrast'

def mat(name, base, metallic=0.0, rough=.35, emission=None, strength=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*base,1)
    m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*base,1); bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission Color'].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=strength
    return m

gold=mat('warm machined gold',(0.34,0.12,0.018),.92,.18)
black=mat('obsidian metal',(0.008,0.012,0.018),.8,.2)
cyan=mat('cyan energy',(0.005,0.16,0.22),.25,.18,(0.01,0.75,1.0),7)
crystal=mat('crystal',(0.05,0.16,0.20),.1,.08,(0.02,0.3,0.42),1.5)
white=mat('pearl',(0.72,0.82,0.88),.55,.14)

# floor with bevelled dais
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=4.3, depth=.22, location=(0,0,-.35)); dais=bpy.context.object; dais.data.materials.append(black)
bev=dais.modifiers.new('soft bevel','BEVEL'); bev.width=.16; bev.segments=4

# sculptural machine rings
for z,r,minor in [(1.0,2.25,.16),(1.0,1.82,.08)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, major_segments=96, minor_segments=16, location=(0,0,z), rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.data.materials.append(gold if r>2 else cyan)

# side pylons with custom beveled profile
for x in (-2.55,2.55):
    bpy.ops.mesh.primitive_cube_add(location=(x,.2,.8), scale=(.24,.34,2.0)); p=bpy.context.object; p.data.materials.append(black)
    b=p.modifiers.new('architectural bevel','BEVEL'); b.width=.18; b.segments=5
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=.22, location=(x,-.18,2.25)); s=bpy.context.object; s.scale=(1,.45,1.8); s.data.materials.append(cyan)

# conveyor cradle
for x in (-1.15,1.15):
    bpy.ops.mesh.primitive_torus_add(major_radius=.55,minor_radius=.07,major_segments=64,minor_segments=12,location=(x,0,-.05),rotation=(math.pi/2,0,0)); bpy.context.object.data.materials.append(gold)

# incoming seed: elongated faceted gem, not primitive final silhouette
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=.72,location=(0,0,.95)); seed=bpy.context.object; seed.name='faceted_seed'; seed.scale=(.72,.72,1.28); seed.data.materials.append(crystal)
seed.rotation_euler=(0,.2,0)
seed.keyframe_insert('scale',frame=1); seed.keyframe_insert('rotation_euler',frame=1)
seed.scale=(.56,.56,.98); seed.rotation_euler=(0,.2,math.pi*.55); seed.keyframe_insert('scale',frame=28); seed.keyframe_insert('rotation_euler',frame=28)
seed.scale=(.08,.08,.12); seed.rotation_euler=(0,.2,math.pi*1.0); seed.keyframe_insert('scale',frame=39); seed.keyframe_insert('rotation_euler',frame=39)

# custom blossom petals, payoff hidden until transformation
petals=[]
for i in range(12):
    a=2*math.pi*i/12
    # tapered diamond petal mesh
    verts=[(0,0,0),(.22,0,.18),(0,0,1.55),(-.22,0,.18),(0,.10,.55),(0,-.10,.55)]
    faces=[(0,1,4),(0,4,3),(0,3,5),(0,5,1),(1,2,4),(4,2,3),(3,2,5),(5,2,1)]
    me=bpy.data.meshes.new('petalmesh'); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new('petal',me); bpy.context.collection.objects.link(o); o.data.materials.append(gold if i%2==0 else white)
    o.location=(0,0,.55); o.rotation_euler=(0,math.radians(58),a); o.scale=(.01,.01,.01); o.keyframe_insert('scale',frame=34)
    o.scale=(1,1,1); o.keyframe_insert('scale',frame=49)
    o.rotation_euler=(0,math.radians(72),a+.16); o.keyframe_insert('rotation_euler',frame=49)
    petals.append(o)
# luminous core
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4,radius=.36,location=(0,0,.72)); core=bpy.context.object; core.data.materials.append(cyan); core.scale=(.05,.05,.05); core.keyframe_insert('scale',frame=34); core.scale=(1,1,1); core.keyframe_insert('scale',frame=46)

# energy sweep ring
bpy.ops.mesh.primitive_torus_add(major_radius=.78,minor_radius=.045,major_segments=64,minor_segments=10,location=(0,0,.8),rotation=(math.pi/2,0,0)); sweep=bpy.context.object; sweep.data.materials.append(cyan); sweep.scale=(.2,.2,.2); sweep.keyframe_insert('scale',frame=25); sweep.scale=(2.6,2.6,2.6); sweep.keyframe_insert('scale',frame=42); sweep.hide_render=False

# camera
bpy.ops.object.camera_add(location=(0,-9.6,3.3)); cam=bpy.context.object; sc.camera=cam
def track(obj,pt):
    q=(Vector(pt)-obj.location).to_track_quat('-Z','Y'); obj.rotation_euler=q.to_euler()
track(cam,(0,0,.9)); cam.data.lens=58
cam.keyframe_insert('location',frame=1); cam.location=(0,-8.7,3.0); cam.keyframe_insert('location',frame=60)

# lights
bpy.ops.object.light_add(type='AREA', location=(0,-4,5)); key=bpy.context.object; key.data.energy=1150; key.data.shape='DISK'; key.data.size=5; track(key,(0,0,.7))
bpy.ops.object.light_add(type='AREA', location=(4,-1,2.6)); rim=bpy.context.object; rim.data.energy=850; rim.data.color=(0.1,.55,1); rim.data.size=3; track(rim,(0,0,1))
bpy.ops.object.light_add(type='AREA', location=(-4,-.5,1.8)); fill=bpy.context.object; fill.data.energy=700; fill.data.color=(1,.28,.05); fill.data.size=2.5; track(fill,(0,0,.8))

# render proof video + evidence frames
sc.render.image_settings.file_format='FFMPEG'; sc.render.ffmpeg.format='MPEG4'; sc.render.ffmpeg.codec='H264'; sc.render.ffmpeg.constant_rate_factor='MEDIUM'; sc.render.filepath=OUT+'/odd_factory_visual_proof.mp4'
bpy.ops.render.render(animation=True)
sc.render.image_settings.file_format='PNG'
for f,name in [(1,'frame_001_hook.png'),(32,'frame_032_reveal.png'),(60,'frame_060_payoff.png')]:
    sc.frame_set(f); sc.render.filepath=OUT+'/'+name; bpy.ops.render.render(write_still=True)
with open(OUT+'/result.txt','w') as fh: fh.write('ODD_FACTORY_VISUAL_PROOF_RENDERED\n60 frames\n540x960\n24fps\n2.5s\n')
print('ODD_FACTORY_VISUAL_PROOF_RENDERED')
