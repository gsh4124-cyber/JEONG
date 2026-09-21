import bpy, math, os, sys, json
from mathutils import Vector

args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir=args[0]
start=int(args[1]); end=int(args[2]); step=int(args[3])
write_events=int(args[4]) if len(args)>4 else 0
os.makedirs(outdir,exist_ok=True)

# clean
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in (bpy.data.meshes,bpy.data.curves,bpy.data.materials,bpy.data.cameras,bpy.data.lights):
    pass

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=180
scene.render.resolution_y=320
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.color=(0.008,0.012,0.022)
scene.frame_start=1
scene.frame_end=49
scene.render.fps=18

def mat(name, base, metallic=0.0, rough=0.35, emission=None, estr=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=base
    b.inputs['Metallic'].default_value=metallic
    b.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value=0.12
    if emission is not None and 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value=emission
        b.inputs['Emission Strength'].default_value=estr
    return m

M_PANEL=mat('Panel',(0.018,0.026,0.045,1),0.1,0.48)
M_RAIL=mat('Rail',(0.13,0.18,0.26,1),0.72,0.22)
M_GATE=mat('Gate',(1.0,0.12,0.025,1),0.35,0.22)
M_HINGE=mat('Hinge',(0.7,0.78,0.9,1),0.85,0.16)
M_BALL=mat('Ball',(0.015,0.22,1.0,1),0.86,0.11)
M_GOAL=mat('Goal',(0.02,0.24,0.035,1),0.12,0.22,(0.05,0.9,0.08,1),0.8)
M_WHITE=mat('White',(0.82,0.9,1.0,1),0.35,0.24)

def cube(name,loc,scale,material,bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=3
    o.data.materials.append(material)
    return o

def cyl(name,loc,radius,depth,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=0.04; mod.segments=2
    return o

# panel and rails
cube('BackPanel',(0,0.75,0),(2.45,0.14,4.75),M_PANEL,0.18)
cube('RailL',(-2.02,0.15,0),(0.12,0.16,4.45),M_RAIL,0.10)
cube('RailR',(2.02,0.15,0),(0.12,0.16,4.45),M_RAIL,0.10)
# top funnel
r1=cube('TopGuideL',(-0.93,0.12,3.82),(1.05,0.13,0.12),M_RAIL,0.08); r1.rotation_euler.y=math.radians(-12)
r2=cube('TopGuideR',(0.93,0.12,3.82),(1.05,0.13,0.12),M_RAIL,0.08); r2.rotation_euler.y=math.radians(12)

# gate creation with pivot empties
def make_gate(idx,z,hinge_left=True):
    hinge_x=-1.63 if hinge_left else 1.63
    sign=1 if hinge_left else -1
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=(hinge_x,0.0,z))
    pivot=bpy.context.object; pivot.name=f'GatePivot_{idx}'
    # board center relative to hinge
    board=cube(f'Gate_{idx}',(hinge_x+sign*1.55,0.0,z),(1.55,0.22,0.12),M_GATE,0.10)
    board.parent=pivot
    # preserve transform then localize
    board.matrix_parent_inverse=pivot.matrix_world.inverted()
    cyl(f'Hinge_{idx}',(hinge_x,-0.03,z),0.20,0.52,M_HINGE)
    # small white tip for contact clarity
    tipx=hinge_x+sign*3.02
    cube(f'GateTip_{idx}',(tipx,-0.02,z),(0.08,0.24,0.16),M_WHITE,0.05).parent=pivot
    return pivot

g1=make_gate(1,2.15,True)
g2=make_gate(2,0.25,False)
g3=make_gate(3,-1.65,True)

def kf_rot(obj, f0, f1, degrees):
    obj.rotation_euler=(0,0,0); obj.keyframe_insert('rotation_euler',frame=f0)
    obj.rotation_euler.y=math.radians(degrees); obj.keyframe_insert('rotation_euler',frame=f1)
    # settle
    obj.rotation_euler.y=math.radians(degrees); obj.keyframe_insert('rotation_euler',frame=f1+4)

kf_rot(g1,10,16,-72)
kf_rot(g2,22,28,72)
kf_rot(g3,34,40,-72)

# Ball
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.43, location=(0,-0.35,4.15))
ball=bpy.context.object; ball.name='HeroBall'; ball.data.materials.append(M_BALL)
mod=ball.modifiers.new('BallBevel','BEVEL'); mod.width=0.025; mod.segments=2

ball_keys=[
(1,(0,-0.35,4.15)),
(7,(0,-0.35,3.15)),
(11,(0,-0.35,2.47)),
(16,(0,-0.35,1.62)),
(22,(0,-0.35,0.58)),
(28,(0,-0.35,-0.28)),
(34,(0,-0.35,-1.35)),
(40,(0,-0.35,-2.10)),
(46,(0,-0.35,-3.28)),
(49,(0,-0.35,-3.52)),
]
for f,loc in ball_keys:
    ball.location=loc; ball.keyframe_insert('location',frame=f)

# Add subtle ball spin
ball.rotation_euler=(0,0,0); ball.keyframe_insert('rotation_euler',frame=1)
ball.rotation_euler=(0,math.radians(680),0); ball.keyframe_insert('rotation_euler',frame=49)

# Goal: ring + pad
bpy.ops.mesh.primitive_torus_add(major_radius=0.78,minor_radius=0.12,major_segments=64,minor_segments=16,location=(0,0.0,-3.52),rotation=(math.pi/2,0,0))
goal=bpy.context.object; goal.name='GoalRing'; goal.data.materials.append(M_GOAL)
cube('GoalPad',(0,0.22,-3.82),(0.92,0.18,0.15),M_GOAL,0.12)

# target chevrons
for sx in (-1,1):
    q=cube(f'GoalWing_{sx}',(sx*1.05,0.05,-3.52),(0.34,0.12,0.07),M_GOAL,0.05)
    q.rotation_euler.y=math.radians(sx*32)

# goal pulse by scaling
goal.scale=(0.88,0.88,0.88); goal.keyframe_insert('scale',frame=42)
goal.scale=(1.20,1.20,1.20); goal.keyframe_insert('scale',frame=47)
goal.scale=(1.05,1.05,1.05); goal.keyframe_insert('scale',frame=49)

# indicator lights next to gates (subtle)
for i,z in enumerate((2.15,0.25,-1.65),1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=0.10,location=(1.78 if i%2 else -1.78,-0.1,z+0.38))
    led=bpy.context.object; led.data.materials.append(M_WHITE)

# Lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-3.0,-5.0,5.5),1100,4.0,(1.0,0.78,0.62),(0,0,0.5))
area('Fill',(3.8,-3.0,1.0),720,3.6,(0.38,0.60,1.0),(0,0,0))
area('Rim',(0,2.0,4.5),950,3.0,(0.30,0.50,1.0),(0,0,0))

# Camera
bpy.ops.object.camera_add(location=(3.1,-12.8,0.9))
cam=bpy.context.object; cam.name='Camera'; scene.camera=cam
cam.data.type='ORTHO'; cam.data.ortho_scale=9.6
cam.rotation_euler=(Vector((0,0,-0.15))-cam.location).to_track_quat('-Z','Y').to_euler()

# Slight vignette frame pieces
cube('TopCap',(0,0.36,4.62),(2.22,0.12,0.12),M_RAIL,0.08)
cube('BottomCap',(0,0.36,-4.62),(2.22,0.12,0.12),M_RAIL,0.08)

# render selected frames
for f in range(start,end+1,step):
    scene.frame_set(f)
    scene.render.filepath=os.path.join(outdir,f'frame_{f:04d}.png')
    bpy.ops.render.render(write_still=True)

if write_events:
    ev={"gate_contact_frames":[11,23,35],"goal_frame":46}
    with open(os.path.join(outdir,'events.json'),'w') as fp: json.dump(ev,fp,indent=2)
