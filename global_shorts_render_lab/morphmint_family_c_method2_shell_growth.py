import bpy, math, os, sys
from mathutils import Vector

args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
outdir=args[0]
frame=int(args[1])
os.makedirs(outdir,exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=270
scene.render.resolution_y=480
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.006,0.008,0.015)
scene.render.fps=18

def mat(name, base, metal=0.0, rough=.4, em=None, estr=0.0, trans=0.0, ior=1.45):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=base
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    if 'Coat Weight' in p.inputs: p.inputs['Coat Weight'].default_value=.22
    if 'Transmission Weight' in p.inputs: p.inputs['Transmission Weight'].default_value=trans
    if 'IOR' in p.inputs: p.inputs['IOR'].default_value=ior
    if em is not None and 'Emission Color' in p.inputs:
        p.inputs['Emission Color'].default_value=em
        p.inputs['Emission Strength'].default_value=estr
    return m

CERAMIC=mat('Ceramic',(0.78,0.12,0.035,1),.02,.28)
CERAMIC_HI=mat('CeramicHighlight',(1.0,.34,.12,1),.02,.22)
CHROME=mat('Chrome',(0.72,0.78,0.88,1),.82,.10)
CHROME_HI=mat('ChromeHi',(0.95,0.98,1.0,1),.55,.06,em=(.55,.72,1.0,1),estr=.18)
CRYSTAL=mat('Crystal',(0.07,.42,1.0,1),.02,.045,em=(.03,.18,.8,1),estr=.35,trans=.18,ior=1.46)
CRYSTAL_EDGE=mat('CrystalEdge',(.70,.93,1.0,1),.02,.03,em=(.15,.65,1.0,1),estr=1.3)
STEM=mat('Stem',(.12,.045,.012,1),.02,.46)
LEAF=mat('Leaf',(.04,.38,.12,1),.02,.34)
DARK=mat('Dark',(0.008,.011,.018,1),.30,.23)
PLAT=mat('Platform',(.055,.075,.11,1),.68,.17)
GLOW=mat('Glow',(.02,.46,1.0,1),.05,.10,em=(.03,.48,1.0,1),estr=3.5)
WHITE=mat('WhiteCard',(.96,.98,1.0,1),0,.10,em=(1,1,1,1),estr=4.5)

def cube(name,loc,scale,material,bevel=.06,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        md=o.modifiers.new('Bevel','BEVEL'); md.width=bevel; md.segments=4
    o.data.materials.append(material); return o

def apple_uv(name, material, scale=(1.25,.88,1.35), loc=(0,-.18,.30), detail=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72,ring_count=36,radius=1.0,location=loc)
    o=bpy.context.object; o.name=name
    o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if detail:
        md=o.modifiers.new('AppleBevel','BEVEL'); md.width=.035; md.segments=3
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o

def apple_ico(name, material, scale=(1.30,.92,1.40), loc=(0,-.20,.30)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=1.0,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    # keep flat facets
    return o

# Stage.
cube('Floor',(0,.65,-3.55),(3.5,2.2,.18),DARK,.10)
cube('Pedestal',(0,.10,-2.05),(1.75,.82,.30),PLAT,.18)
cube('PedestalGlow',(0,-.14,-1.72),(1.38,.05,.035),GLOW,.02)

# Familiar identity anchors: stem + leaf never disappear.
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.095,depth=.78,location=(.03,-.18,1.95),rotation=(0,0,math.radians(-8)))
stem=bpy.context.object; stem.data.materials.append(STEM)
leaf=cube('Leaf',(.46,-.20,1.95),(.34,.06,.15),LEAF,.08,rot=(0,math.radians(12),math.radians(-18)))

# Ceramic base body.
base=apple_uv('CeramicApple',CERAMIC)

# Ceramic shine spot to make starting material unmistakably glazed.
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=.20,location=(-.43,-1.02,.76))
spot=bpy.context.object; spot.scale=(.42,.06,.90); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
spot.data.materials.append(CERAMIC_HI)

# METHOD 2: real geometry layers, not shader interpolation.
# Phase A (frame 1-78): chrome shell physically grows upward from bottom.
chrome_progress=max(0.0,min(1.0,(frame-28)/42.0))
if chrome_progress>0:
    shell=apple_uv('ChromeShell',CHROME,scale=(1.275,.905,1.375),loc=(0,-.205,.30))
    # grow from bottom via scale + shifted center; not final method for production, but actual geometry occlusion proof.
    shell.scale.z=max(.03,chrome_progress)
    shell.location.z=-1.05 + 1.35*chrome_progress
    # bright specular stripe attached to shell
    stripe=cube('ChromeStripe',(-.42,-1.13,-.70+1.45*chrome_progress),(.13,.035,.75*chrome_progress),CHROME_HI,.025,rot=(0,0,math.radians(-10)))

# Once chrome has completed, hide ceramic by placing a complete chrome body slightly forward.
if frame>=72:
    # complete shell guarantees readable middle state
    chrome_full=apple_uv('ChromeFull',CHROME,scale=(1.285,.915,1.385),loc=(0,-.23,.30))
    # two specular ribs
    cube('ChromeRibL',(-.48,-1.16,.40),(.10,.028,.92),CHROME_HI,.02,rot=(0,0,math.radians(-10)))
    cube('ChromeRibR',(.52,-1.15,.20),(.07,.028,.74),CHROME_HI,.02,rot=(0,0,math.radians(12)))

# Phase B (frame 82-132): faceted crystal geometry grows from center outward.
crystal_progress=max(0.0,min(1.0,(frame-86)/36.0))
if crystal_progress>0:
    crystal=apple_ico('CrystalGrowth',CRYSTAL)
    crystal.scale=(max(.05,crystal_progress),)*3
    # luminous facet skeleton grows with it
    for i,ang in enumerate((0,45,90,135)):
        a=math.radians(ang)
        bar=cube(f'CrystalFacet{i}',(0,-1.13,.30),(.035,.022,.95*crystal_progress),CRYSTAL_EDGE,.01)
        bar.rotation_euler.y=a
        bar.rotation_euler.z=a*.20

# Final state fully crystal; hide visual dominance of chrome with a larger opaque-ish faceted shell.
if frame>=120:
    final=apple_ico('CrystalFinal',CRYSTAL,scale=(1.31,.93,1.41),loc=(0,-.25,.30))
    # edge ring / shards for crystal read
    bpy.ops.mesh.primitive_torus_add(major_radius=.82,minor_radius=.028,major_segments=48,minor_segments=10,
                                    location=(0,-1.18,.30),rotation=(math.pi/2,0,0))
    ring=bpy.context.object; ring.data.materials.append(CRYSTAL_EDGE)
    for x,z,rot in [(-.42,.72,-18),(.38,.55,22),(-.18,-.20,35),(.44,-.42,-28)]:
        shard=cube('Shard',(x,-1.15,z),(.035,.02,.46),CRYSTAL_EDGE,.01,rot=(0,math.radians(rot),math.radians(rot*.3)))

# Reflection cards outside hero silhouette, crucial for chrome readability.
cube('CardL',(-3.0,.40,.75),(.18,.04,2.5),WHITE,.02)
cube('CardR',(3.0,.35,.55),(.16,.04,2.3),WHITE,.02)
cube('CardTop',(0,.45,3.0),(1.8,.04,.13),WHITE,.02)

# Lighting.
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

# Camera.
bpy.ops.object.camera_add(location=(2.0,-13.8,1.0))
cam=bpy.context.object; scene.camera=cam; cam.data.lens=64
cam.rotation_euler=(Vector((0,0,.18))-cam.location).to_track_quat('-Z','Y').to_euler()

scene.frame_set(frame)
scene.render.filepath=os.path.join(outdir,f'morphmint_m2_{frame:04d}.png')
bpy.ops.render.render(write_still=True)
