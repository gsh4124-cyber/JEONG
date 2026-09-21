import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir=args[0]
start=int(args[1]); end=int(args[2])
os.makedirs(outdir,exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=360
scene.render.resolution_y=640
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.fps=18
scene.frame_start=start
scene.frame_end=end
scene.render.filepath=os.path.join(outdir,"frame_")
scene.world.color=(0.005,0.008,0.015)

def mat(name, base, metal=0.0, rough=.4, em=None, estr=0.0, trans=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=base
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in p.inputs: p.inputs['Coat Weight'].default_value=.22
    if 'Transmission Weight' in p.inputs: p.inputs['Transmission Weight'].default_value=trans
    if 'IOR' in p.inputs: p.inputs['IOR'].default_value=1.46
    if em is not None and 'Emission Color' in p.inputs:
        p.inputs['Emission Color'].default_value=em
        p.inputs['Emission Strength'].default_value=estr
    return m

CERAMIC=mat('Ceramic',(0.78,0.12,0.035,1),.02,.28)
CERAMIC_HI=mat('CeramicHighlight',(1.0,.34,.12,1),.02,.22)
CHROME=mat('Chrome',(0.72,0.80,0.92,1),.82,.10)
CHROME_HI=mat('ChromeHi',(0.95,0.99,1.0,1),.45,.05,em=(.55,.78,1.0,1),estr=.16)
CRYSTAL=mat('Crystal',(0.06,.42,1.0,1),.02,.04,em=(.02,.16,.78,1),estr=.36,trans=.18)
CRYSTAL_EDGE=mat('CrystalEdge',(.72,.95,1.0,1),.02,.025,em=(.12,.68,1.0,1),estr=1.25)
STEM=mat('Stem',(.12,.045,.012,1),.02,.46)
LEAF=mat('Leaf',(.04,.38,.12,1),.02,.34)
DARK=mat('Dark',(0.008,.011,.018,1),.30,.23)
PLAT=mat('Platform',(.055,.075,.11,1),.68,.17)
GLOW=mat('Glow',(.02,.46,1.0,1),.05,.10,em=(.03,.48,1.0,1),estr=3.2)
WHITE=mat('WhiteCard',(.96,.98,1.0,1),0,.10,em=(1,1,1,1),estr=4.2)

def cube(name,loc,scale,material,bevel=.06,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        md=o.modifiers.new('Bevel','BEVEL'); md.width=bevel; md.segments=4
    o.data.materials.append(material); return o

def apple_uv(name, material, scale=(1.25,.88,1.35), loc=(0,-.18,.30)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72,ring_count=36,radius=1.0,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    md=o.modifiers.new('AppleBevel','BEVEL'); md.width=.035; md.segments=3
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o

def apple_ico(name, material, scale=(1.30,.92,1.40), loc=(0,-.20,.30)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=1.0,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    return o

def linear_keys(obj, prop):
    if not obj.animation_data or not obj.animation_data.action: return
    for fc in obj.animation_data.action.fcurves:
        if fc.data_path==prop:
            for kp in fc.keyframe_points: kp.interpolation='LINEAR'

# stage
cube('Floor',(0,.65,-3.55),(3.5,2.2,.18),DARK,.10)
cube('Pedestal',(0,.10,-2.05),(1.75,.82,.30),PLAT,.18)
cube('PedestalGlow',(0,-.14,-1.72),(1.38,.05,.035),GLOW,.02)

# identity anchors
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.095,depth=.78,location=(.03,-.18,1.95),rotation=(0,0,math.radians(-8)))
bpy.context.object.data.materials.append(STEM)
cube('Leaf',(.46,-.20,1.95),(.34,.06,.15),LEAF,.08,rot=(0,math.radians(12),math.radians(-18)))

# ceramic body
apple_uv('CeramicApple',CERAMIC)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=.20,location=(-.43,-1.02,.76))
spot=bpy.context.object; spot.scale=(.42,.06,.90)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
spot.data.materials.append(CERAMIC_HI)

# chrome shell grows from bottom
chrome=apple_uv('ChromeShell',CHROME,scale=(1.285,.915,1.385),loc=(0,-.23,.30))
chrome.scale.z=.015; chrome.location.z=-1.03
chrome.keyframe_insert('scale',frame=28); chrome.keyframe_insert('location',frame=28)
chrome.scale.z=1.0; chrome.location.z=.30
chrome.keyframe_insert('scale',frame=70); chrome.keyframe_insert('location',frame=70)
linear_keys(chrome,'scale'); linear_keys(chrome,'location')

# two specular ribs ride with same bottom-up reveal
for name,x,zoff,tilt in [('ChromeRibL',-.48,.10,-10),('ChromeRibR',.52,-.08,12)]:
    rib=cube(name,(x,-1.16,.40+zoff),(.09,.028,.90),CHROME_HI,.02,rot=(0,0,math.radians(tilt)))
    rib.scale.z=.015; rib.location.z=-1.00
    rib.keyframe_insert('scale',frame=28); rib.keyframe_insert('location',frame=28)
    rib.scale.z=1.0; rib.location.z=.40+zoff
    rib.keyframe_insert('scale',frame=70); rib.keyframe_insert('location',frame=70)
    linear_keys(rib,'scale'); linear_keys(rib,'location')

# crystal geometry grows out of completed chrome
crystal=apple_ico('CrystalGrowth',CRYSTAL)
crystal.scale=(.015,.015,.015); crystal.keyframe_insert('scale',frame=86)
crystal.scale=(1,1,1); crystal.keyframe_insert('scale',frame=120)
linear_keys(crystal,'scale')

facet_objs=[]
for i,ang in enumerate((0,45,90,135)):
    a=math.radians(ang)
    bar=cube(f'CrystalFacet{i}',(0,-1.13,.30),(.035,.022,.95),CRYSTAL_EDGE,.01)
    bar.rotation_euler.y=a; bar.rotation_euler.z=a*.20
    bar.scale=(.015,.015,.015); bar.keyframe_insert('scale',frame=86)
    bar.scale=(1,1,1); bar.keyframe_insert('scale',frame=120)
    linear_keys(bar,'scale')
    facet_objs.append(bar)

bpy.ops.mesh.primitive_torus_add(major_radius=.82,minor_radius=.028,major_segments=48,minor_segments=10,
                                location=(0,-1.18,.30),rotation=(math.pi/2,0,0))
ring=bpy.context.object; ring.name='CrystalRing'; ring.data.materials.append(CRYSTAL_EDGE)
ring.scale=(.015,.015,.015); ring.keyframe_insert('scale',frame=92)
ring.scale=(1,1,1); ring.keyframe_insert('scale',frame=122)
linear_keys(ring,'scale')

# payoff halo
bpy.ops.mesh.primitive_torus_add(major_radius=1.68,minor_radius=.045,major_segments=72,minor_segments=12,
                                location=(0,.12,.32),rotation=(math.pi/2,0,0))
halo=bpy.context.object; halo.data.materials.append(GLOW)
halo.scale=(.001,.001,.001); halo.keyframe_insert('scale',frame=112)
halo.scale=(1,1,1); halo.keyframe_insert('scale',frame=126)
halo.scale=(1.08,1.08,1.08); halo.keyframe_insert('scale',frame=134)
halo.scale=(1,1,1); halo.keyframe_insert('scale',frame=144)
linear_keys(halo,'scale')

# reflection cards
cube('CardL',(-3.0,.40,.75),(.18,.04,2.5),WHITE,.02)
cube('CardR',(3.0,.35,.55),(.16,.04,2.3),WHITE,.02)
cube('CardTop',(0,.45,3.0),(1.8,.04,.13),WHITE,.02)

for o in list(bpy.data.objects):
    if o.type=='LIGHT': bpy.data.objects.remove(o,do_unlink=True)

def area(name,loc,energy,size,color,target):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=name; l.data.energy=energy; l.data.size=size; l.data.color=color
    l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()

area('Key',(-4.0,-4.8,5.6),1800,4.4,(1.0,.72,.52),(0,0,.35))
area('Fill',(4.1,-3.8,1.2),1500,3.6,(.42,.62,1.0),(0,0,.3))
area('Rim',(0,2.3,5.6),1500,3.0,(.70,.86,1.0),(0,0,.8))
area('StripL',(-3.1,-1.7,1.2),1600,1.0,(1,1,1),(0,0,.4))
area('StripR',(3.1,-1.5,.4),1450,1.0,(.72,.90,1),(0,0,.2))

bpy.ops.object.camera_add(location=(2.0,-13.8,1.0))
cam=bpy.context.object; scene.camera=cam; cam.data.lens=64
cam.rotation_euler=(Vector((0,0,.18))-cam.location).to_track_quat('-Z','Y').to_euler()

bpy.ops.render.render(animation=True)
