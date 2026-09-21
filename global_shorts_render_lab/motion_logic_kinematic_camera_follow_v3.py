import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir=args[0]
start=int(args[1]); end=int(args[2]); step=int(args[3])
os.makedirs(outdir,exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=180
scene.render.resolution_y=320
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.color=(0.004,0.007,0.014)
scene.frame_start=1
scene.frame_end=49
scene.render.fps=18

def mat(name,base,metallic=0.0,rough=0.35,emission=None,estr=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=base
    b.inputs['Metallic'].default_value=metallic
    b.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=0.22
    if emission is not None and 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value=emission
        b.inputs['Emission Strength'].default_value=estr
    return m

M_PANEL=mat('Panel',(0.009,0.015,0.030,1),0.18,0.34)
M_SLOT=mat('Slot',(0.006,0.010,0.018,1),0.05,0.62)
M_RAIL=mat('Rail',(0.16,0.22,0.32,1),0.82,0.16)
M_GATE=mat('Gate',(0.95,0.055,0.008,1),0.46,0.18)
M_EDGE=mat('GateEdge',(1.0,0.24,0.025,1),0.20,0.16,(1.0,0.10,0.01,1),1.2)
M_HINGE=mat('Hinge',(0.72,0.82,0.96,1),0.90,0.12)
M_BALL=mat('Ball',(0.008,0.18,1.0,1),0.90,0.10)
M_GOAL=mat('Goal',(0.01,0.34,0.04,1),0.10,0.18,(0.02,1.0,0.10,1),2.3)
M_START=mat('Start',(0.01,0.10,0.70,1),0.12,0.18,(0.02,0.18,1.0,1),1.6)
M_WHITE=mat('White',(0.86,0.94,1.0,1),0.65,0.16)

def cube(name,loc,scale,material,bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=4
    o.data.materials.append(material)
    return o

def cyl(name,loc,radius,depth,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=0.045; mod.segments=3
    return o

# chassis
cube('BackPanel',(0,0.78,0),(2.50,0.18,4.80),M_PANEL,0.22)
cube('RailL',(-2.06,0.12,0),(0.13,0.18,4.48),M_RAIL,0.11)
cube('RailR',(2.06,0.12,0),(0.13,0.18,4.48),M_RAIL,0.11)
cube('TopCap',(0,0.30,4.62),(2.26,0.14,0.12),M_RAIL,0.09)
cube('BottomCap',(0,0.30,-4.62),(2.26,0.14,0.12),M_RAIL,0.09)

# recessed mechanism bays
for z in (2.15,0.25,-1.65):
    cube('Bay',(0,0.55,z),(1.80,0.045,0.62),M_SLOT,0.14)

# top funnel
r1=cube('TopGuideL',(-0.93,0.08,3.78),(1.05,0.14,0.11),M_RAIL,0.08); r1.rotation_euler.y=math.radians(-12)
r2=cube('TopGuideR',(0.93,0.08,3.78),(1.05,0.14,0.11),M_RAIL,0.08); r2.rotation_euler.y=math.radians(12)

def parent_keep(o,p):
    o.parent=p
    o.matrix_parent_inverse=p.matrix_world.inverted()

def make_gate(idx,z,hinge_left=True):
    hinge_x=-1.63 if hinge_left else 1.63
    sign=1 if hinge_left else -1
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=(hinge_x,0.0,z))
    pivot=bpy.context.object; pivot.name=f'GatePivot_{idx}'
    board=cube(f'Gate_{idx}',(hinge_x+sign*1.55,-0.02,z),(1.55,0.24,0.13),M_GATE,0.11)
    parent_keep(board,pivot)
    strip=cube(f'GateEdge_{idx}',(hinge_x+sign*1.55,-0.265,z+0.085),(1.38,0.022,0.026),M_EDGE,0.018)
    parent_keep(strip,pivot)
    cyl(f'Hinge_{idx}',(hinge_x,-0.05,z),0.22,0.56,M_HINGE)
    tip=cube(f'GateTip_{idx}',(hinge_x+sign*3.02,-0.04,z),(0.08,0.25,0.17),M_WHITE,0.05)
    parent_keep(tip,pivot)
    # hinge collar
    bpy.ops.mesh.primitive_torus_add(major_radius=0.28,minor_radius=0.045,major_segments=40,minor_segments=12,
                                    location=(hinge_x,-0.34,z),rotation=(math.pi/2,0,0))
    bpy.context.object.data.materials.append(M_EDGE)
    return pivot

g1=make_gate(1,2.15,True); g2=make_gate(2,0.25,False); g3=make_gate(3,-1.65,True)

def kf_rot(obj,f0,f1,degrees):
    obj.rotation_euler=(0,0,0); obj.keyframe_insert('rotation_euler',frame=f0)
    obj.rotation_euler.y=math.radians(degrees); obj.keyframe_insert('rotation_euler',frame=f1)
    obj.rotation_euler.y=math.radians(degrees); obj.keyframe_insert('rotation_euler',frame=f1+4)

kf_rot(g1,10,16,-72); kf_rot(g2,22,28,72); kf_rot(g3,34,40,-72)

# hero ball
bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,radius=0.48,location=(0,-0.38,4.15))
ball=bpy.context.object; ball.name='HeroBall'; ball.data.materials.append(M_BALL)
ball_keys=[
(1,(0,-0.38,4.15)),(7,(0,-0.38,3.15)),(11,(0,-0.38,2.47)),(16,(0,-0.38,1.62)),
(22,(0,-0.38,0.58)),(28,(0,-0.38,-0.28)),(34,(0,-0.38,-1.35)),(40,(0,-0.38,-2.10)),
(46,(0,-0.38,-3.28)),(49,(0,-0.38,-3.52))]
for f,loc in ball_keys:
    ball.location=loc; ball.keyframe_insert('location',frame=f)
ball.rotation_euler=(0,0,0); ball.keyframe_insert('rotation_euler',frame=1)
ball.rotation_euler=(0,math.radians(720),0); ball.keyframe_insert('rotation_euler',frame=49)

# start halo
bpy.ops.mesh.primitive_torus_add(major_radius=0.68,minor_radius=0.055,major_segments=56,minor_segments=12,
                                location=(0,0.25,4.12),rotation=(math.pi/2,0,0))
bpy.context.object.data.materials.append(M_START)

# goal module
bpy.ops.mesh.primitive_torus_add(major_radius=0.80,minor_radius=0.13,major_segments=72,minor_segments=18,
                                location=(0,-0.02,-3.52),rotation=(math.pi/2,0,0))
goal=bpy.context.object; goal.name='GoalRing'; goal.data.materials.append(M_GOAL)
cube('GoalPad',(0,0.20,-3.82),(0.96,0.20,0.16),M_GOAL,0.14)
for sx in (-1,1):
    q=cube(f'GoalWing_{sx}',(sx*1.06,0.02,-3.52),(0.36,0.14,0.075),M_GOAL,0.06)
    q.rotation_euler.y=math.radians(sx*32)
goal.scale=(0.88,0.88,0.88); goal.keyframe_insert('scale',frame=42)
goal.scale=(1.24,1.24,1.24); goal.keyframe_insert('scale',frame=47)
goal.scale=(1.07,1.07,1.07); goal.keyframe_insert('scale',frame=49)

# subtle status LEDs
for i,z in enumerate((2.15,0.25,-1.65),1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=0.11,
                                       location=(1.80 if i%2 else -1.80,-0.15,z+0.40))
    bpy.context.object.data.materials.append(M_WHITE)

# lights
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()
    return l
area('Key',(-3.2,-5.3,5.8),1450,4.5,(1.0,0.74,0.56),(0,0,0.4))
area('Fill',(4.2,-3.0,1.2),900,3.8,(0.32,0.56,1.0),(0,0,0.0))
area('Rim',(0,2.8,4.0),1200,3.2,(0.22,0.42,1.0),(0,0,0.1))
# payoff light
bpy.ops.object.light_add(type='POINT',location=(0,-1.0,-3.45))
pl=bpy.context.object; pl.name='GoalFlash'; pl.data.color=(0.12,1.0,0.18); pl.data.shadow_soft_size=1.1
pl.data.energy=15; pl.data.keyframe_insert('energy',frame=42)
pl.data.energy=340; pl.data.keyframe_insert('energy',frame=46)
pl.data.energy=120; pl.data.keyframe_insert('energy',frame=49)

# camera: slight 3/4 but readable
bpy.ops.object.camera_add(location=(2.65,-13.2,0.75))
cam=bpy.context.object; scene.camera=cam
cam.data.type='ORTHO'

def cam_key(f,z,target_z,scale):
    cam.location=(2.65,-13.2,z)
    cam.data.ortho_scale=scale
    cam.rotation_euler=(Vector((0,0,target_z))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.keyframe_insert('location',frame=f)
    cam.keyframe_insert('rotation_euler',frame=f)
    cam.data.keyframe_insert('ortho_scale',frame=f)

# Whole-machine promise, then follow the causal action downward.
cam_key(1,0.75,-0.05,9.35)
cam_key(5,3.20,2.75,7.80)
cam_key(12,2.85,2.35,7.20)
cam_key(24,1.10,0.55,6.90)
cam_key(36,-0.80,-1.45,6.65)
cam_key(46,-2.25,-2.95,6.35)
cam_key(49,-2.45,-3.20,6.20)

for frame in range(start,end+1,step):
    scene.frame_set(frame)
    scene.render.filepath=os.path.join(outdir,f'frame_{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
