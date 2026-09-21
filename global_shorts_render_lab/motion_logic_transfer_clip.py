import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
variant=args[0]
outdir=args[1]
start=int(args[2]); end=int(args[3]); step=int(args[4])
os.makedirs(outdir,exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=180
scene.render.resolution_y=320
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.004,0.007,0.014)
scene.frame_start=1; scene.frame_end=54; scene.render.fps=18

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
M_RAIL=mat('Rail',(0.15,0.22,0.33,1),0.82,0.16)
M_SLOT=mat('Slot',(0.006,0.010,0.018,1),0.06,0.62)
M_ORANGE=mat('Orange',(0.96,0.065,0.008,1),0.42,0.18)
M_YELLOW=mat('Yellow',(0.95,0.52,0.02,1),0.30,0.18)
M_BLUE=mat('Blue',(0.008,0.18,1.0,1),0.90,0.10)
M_GREEN=mat('Green',(0.01,0.34,0.04,1),0.10,0.18,(0.02,1.0,0.10,1),2.4)
M_WHITE=mat('White',(0.86,0.94,1.0,1),0.65,0.16)
M_RED=mat('Red',(0.82,0.018,0.014,1),0.48,0.18)
M_EDGE=mat('Edge',(1.0,0.20,0.02,1),0.20,0.16,(1.0,0.08,0.01,1),1.0)

def cube(name,loc,scale,material,bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=4
    o.data.materials.append(material)
    return o

def sphere(name,loc,radius,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=radius,location=loc)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    return o

def torus(name,loc,major,minor,material):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=56,minor_segments=14,
                                    location=loc,rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    return o

def parent_keep(o,p):
    o.parent=p; o.matrix_parent_inverse=p.matrix_world.inverted()

def key_loc(o,keys):
    for f,loc in keys:
        o.location=loc; o.keyframe_insert('location',frame=f)

def key_rot_y(o,keys):
    for f,deg in keys:
        o.rotation_euler=(0,math.radians(deg),0); o.keyframe_insert('rotation_euler',frame=f)

# shared chassis
cube('BackPanel',(0,0.78,0),(2.50,0.18,4.80),M_PANEL,0.22)
cube('RailL',(-2.06,0.12,0),(0.13,0.18,4.48),M_RAIL,0.11)
cube('RailR',(2.06,0.12,0),(0.13,0.18,4.48),M_RAIL,0.11)
cube('TopCap',(0,0.30,4.62),(2.26,0.14,0.12),M_RAIL,0.09)
cube('BottomCap',(0,0.30,-4.62),(2.26,0.14,0.12),M_RAIL,0.09)

goal=torus('GoalRing',(0,-0.04,-3.55),0.80,0.13,M_GREEN)
cube('GoalPad',(0,0.20,-3.84),(0.96,0.20,0.16),M_GREEN,0.14)
goal.scale=(0.88,0.88,0.88); goal.keyframe_insert('scale',frame=43)
goal.scale=(1.24,1.24,1.24); goal.keyframe_insert('scale',frame=49)
goal.scale=(1.06,1.06,1.06); goal.keyframe_insert('scale',frame=54)

hero=sphere('HeroBall',(0,-0.36,4.10),0.47,M_BLUE)

if variant=='bridge':
    # upper chute and trigger
    left=cube('UpperRamp',(-0.65,0.00,2.90),(1.20,0.15,0.11),M_RAIL,0.08)
    left.rotation_euler.y=math.radians(-12)
    trig=cube('Trigger',(-1.15,-0.08,1.35),(0.38,0.24,0.16),M_YELLOW,0.09)
    torus('TriggerHalo',(-1.15,0.20,1.35),0.48,0.045,M_YELLOW)

    # gap and bridge
    cube('GapLeft',(-1.35,0.55,-0.05),(0.95,0.05,0.72),M_SLOT,0.10)
    cube('GapRight',(1.35,0.55,-0.05),(0.95,0.05,0.72),M_SLOT,0.10)
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=(-0.95,0.0,-0.10))
    pivot=bpy.context.object; pivot.name='BridgePivot'
    bridge=cube('Bridge',(0.0,-0.04,-0.10),(1.05,0.22,0.13),M_ORANGE,0.10)
    parent_keep(bridge,pivot)
    edge=cube('BridgeEdge',(0.0,-0.29,-0.01),(0.90,0.02,0.03),M_EDGE,0.02); parent_keep(edge,pivot)
    key_rot_y(pivot,[(1,-78),(14,-78),(24,0),(54,0)])

    # exit ramp
    out=cube('ExitRamp',(0.65,0.02,-1.60),(1.45,0.15,0.11),M_RAIL,0.08)
    out.rotation_euler.y=math.radians(12)

    key_loc(hero,[
        (1,(0,-0.36,4.10)),(8,(-0.45,-0.36,3.20)),(14,(-1.00,-0.36,1.65)),
        (18,(-1.15,-0.36,1.36)),(24,(-0.80,-0.36,0.45)),(30,(0.05,-0.36,-0.05)),
        (36,(0.85,-0.36,-0.65)),(43,(0.35,-0.36,-2.10)),(49,(0,-0.36,-3.35)),(54,(0,-0.36,-3.55))
    ])

elif variant=='counterweight':
    # diagonal feed ramp
    ramp=cube('FeedRamp',(-0.65,0.02,2.85),(1.45,0.15,0.11),M_RAIL,0.08)
    ramp.rotation_euler.y=math.radians(-13)

    # counterweight ball and cradle
    weight=sphere('Counterweight',(1.12,-0.34,1.60),0.40,M_YELLOW)
    cube('WeightCradle',(1.12,0.12,1.38),(0.62,0.13,0.10),M_RAIL,0.07)

    # door pivot
    bpy.ops.object.empty_add(type='PLAIN_AXES',location=(0.0,0.0,0.25))
    doorp=bpy.context.object; doorp.name='DoorPivot'
    door=cube('Door',(0.0,-0.02,0.25),(1.55,0.23,0.13),M_RED,0.10)
    parent_keep(door,doorp)
    edge=cube('DoorEdge',(0,-0.27,0.34),(1.38,0.02,0.03),M_EDGE,0.02); parent_keep(edge,doorp)
    key_rot_y(doorp,[(1,0),(22,0),(30,-78),(54,-78)])

    # weight drops as door opens
    key_loc(weight,[(1,(1.12,-0.34,1.60)),(20,(1.12,-0.34,1.60)),(30,(1.12,-0.34,0.70)),(38,(1.12,-0.34,-0.10)),(54,(1.12,-0.34,-0.10))])

    # lower chute
    out=cube('LowerRamp',(0.0,0.02,-1.70),(1.75,0.15,0.11),M_RAIL,0.08)
    out.rotation_euler.y=math.radians(-7)

    key_loc(hero,[
        (1,(0,-0.36,4.10)),(8,(-0.50,-0.36,3.15)),(15,(-0.95,-0.36,2.15)),
        (20,(0.35,-0.36,1.72)),(23,(0.72,-0.36,1.60)), # hit weight
        (30,(0.10,-0.36,0.82)),(36,(0.0,-0.36,0.10)),(42,(-0.25,-0.36,-1.55)),
        (49,(0,-0.36,-3.30)),(54,(0,-0.36,-3.55))
    ])
else:
    raise RuntimeError('unknown variant')

hero.rotation_euler=(0,0,0); hero.keyframe_insert('rotation_euler',frame=1)
hero.rotation_euler=(0,math.radians(760),0); hero.keyframe_insert('rotation_euler',frame=54)

# payoff light
bpy.ops.object.light_add(type='POINT',location=(0,-1.0,-3.45))
pl=bpy.context.object; pl.data.color=(0.12,1.0,0.18); pl.data.shadow_soft_size=1.1
pl.data.energy=10; pl.data.keyframe_insert('energy',frame=43)
pl.data.energy=330; pl.data.keyframe_insert('energy',frame=49)
pl.data.energy=110; pl.data.keyframe_insert('energy',frame=54)

# lighting
for o in list(bpy.data.objects):
    if o.type=='LIGHT' and o != pl: bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area('Key',(-3.2,-5.3,5.8),1350,4.4,(1.0,0.75,0.58),(0,0,0.4))
area('Fill',(4.2,-3.0,1.2),850,3.8,(0.32,0.56,1.0),(0,0,0.0))
area('Rim',(0,2.8,4.0),1100,3.2,(0.22,0.42,1.0),(0,0,0.1))

# camera follow
bpy.ops.object.camera_add(location=(2.55,-13.1,0.8))
cam=bpy.context.object; scene.camera=cam; cam.data.type='ORTHO'

def cam_key(f,z,target_z,scale):
    cam.location=(2.55,-13.1,z); cam.data.ortho_scale=scale
    cam.rotation_euler=(Vector((0,0,target_z))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.keyframe_insert('location',frame=f); cam.keyframe_insert('rotation_euler',frame=f); cam.data.keyframe_insert('ortho_scale',frame=f)

cam_key(1,0.8,-0.05,9.35)
cam_key(7,3.1,2.7,7.7)
cam_key(18,1.8,1.35,7.0)
cam_key(30,0.0,-0.25,6.7)
cam_key(43,-1.45,-2.0,6.5)
cam_key(49,-2.35,-3.05,6.25)
cam_key(54,-2.45,-3.20,6.20)

for frame in range(start,end+1,step):
    scene.frame_set(frame)
    scene.render.filepath=os.path.join(outdir,f'frame_{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
