import bpy, math, pathlib, json
from mathutils import Vector

OUT=pathlib.Path("render_output/morphmint_005_probe")
OUT.mkdir(parents=True, exist_ok=True)

W,H=540,960
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.resolution_x=W
scene.render.resolution_y=H
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.color=(0.008,0.012,0.025)

def principled(name, base, metallic=0.0, rough=0.35, transmission=0.0, ior=1.45):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=base
    bsdf.inputs['Metallic'].default_value=metallic
    bsdf.inputs['Roughness'].default_value=rough
    if 'Transmission Weight' in bsdf.inputs:
        bsdf.inputs['Transmission Weight'].default_value=transmission
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value=ior
    return m

def glass_material(name, color, rough=0.018, ior=1.46, absorption=(0.12,0.42,0.95,1), density=0.045):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    nt=m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out=nt.nodes.new('ShaderNodeOutputMaterial')
    glass=nt.nodes.new('ShaderNodeBsdfGlass')
    glass.inputs['Color'].default_value=color
    glass.inputs['Roughness'].default_value=rough
    glass.inputs['IOR'].default_value=ior
    vol=nt.nodes.new('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value=absorption
    vol.inputs['Density'].default_value=density
    nt.links.new(glass.outputs['BSDF'], out.inputs['Surface'])
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    return m

CERAMIC=principled("MM_Ceramic",(0.66,0.10,0.028,1),0.0,0.44)
CHROME=principled("MM_Chrome",(0.88,0.92,1.0,1),1.0,0.16)
CRYSTAL=glass_material(
    "MM_Crystal",
    (0.86,0.97,1.0,1),
    rough=0.010,
    ior=1.48,
    absorption=(0.06,0.24,0.82,1),
    density=0.024
)

# Main identity geometry
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.55, depth=0.42, location=(0,0,0))
body=bpy.context.object
body.name="MorphMint_Body"
body.rotation_euler=(math.radians(90),0,0)
body.data.materials.append(CERAMIC)
bev=body.modifiers.new("BodyBevel","BEVEL")
bev.width=0.095
bev.segments=6
bpy.ops.object.shade_smooth()

bpy.ops.mesh.primitive_torus_add(
    major_radius=1.20, minor_radius=0.105,
    major_segments=128, minor_segments=28,
    location=(0,-0.245,0),
    rotation=(math.radians(90),0,0)
)
rim=bpy.context.object
rim.name="MorphMint_Rim"
rim.data.materials.append(CERAMIC)

bpy.ops.mesh.primitive_cube_add(location=(0,-0.285,0))
bar=bpy.context.object
bar.name="MorphMint_IdentityBar"
bar.scale=(0.13,0.08,0.70)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bar.data.materials.append(CERAMIC)
bev2=bar.modifiers.new("BarBevel","BEVEL")
bev2.width=0.06
bev2.segments=5
objects=(body,rim,bar)

# Ground
bpy.ops.mesh.primitive_plane_add(size=30, location=(0,2,-2.25))
floor=bpy.context.object
floor.name="MorphMint_Floor"
floor.data.materials.append(principled("FloorMat",(0.015,0.020,0.035,1),0.10,0.30))

# Backdrop material changes slightly for crystal readability.
bpy.ops.mesh.primitive_plane_add(size=18, location=(0,2.8,1.2), rotation=(math.radians(90),0,0))
back=bpy.context.object
back.name="Backdrop"
BACK_DARK=principled("BackdropDark",(0.006,0.012,0.03,1),0.0,0.42)
BACK_CRYSTAL=principled("BackdropCrystal",(0.035,0.10,0.24,1),0.0,0.36)
back.data.materials.append(BACK_DARK)

# Reflection cards stay fully outside camera view.
for x,z,sx,sz,val in [
    (-7.5,1.2,1.20,4.2,0.72),
    ( 7.5,0.5,1.05,3.8,0.52),
    ( 0.0,7.5,3.3,0.9,0.34)
]:
    bpy.ops.mesh.primitive_plane_add(size=2, location=(x,-1.0,z))
    card=bpy.context.object
    card.name=f"ReflectionCard_{x}_{z}"
    card.scale=(sx,sz,1)
    card.rotation_euler=(math.radians(90),0,0)
    em=bpy.data.materials.new(f"CardMat_{x}_{z}")
    em.use_nodes=True
    bs=em.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(val,val,val,1)
    bs.inputs['Roughness'].default_value=0.35
    if 'Emission Color' in bs.inputs:
        bs.inputs['Emission Color'].default_value=(val,val,val,1)
        bs.inputs['Emission Strength'].default_value=1.0
    card.data.materials.append(em)

# Lighting
lights={}
for loc,energy,size,color,name in [
    ((-3.6,-4.5,5.2),1350,4.0,(1.0,0.60,0.38),"Key"),
    (( 4.2,-3.5,1.4), 900,3.2,(0.25,0.52,1.0),"Fill"),
    (( 0.0, 2.0,5.6), 900,2.5,(0.45,0.78,1.0),"Rim"),
    (( 0.0,-1.6,-1.6), 280,2.2,(0.15,0.30,0.75),"Under")
]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object
    l.name=name
    l.data.energy=energy
    l.data.size=size
    l.data.color=color
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
    lights[name]=l

# Internal crystal geometry: larger, brighter, physically translucent.
facet_mat=bpy.data.materials.new("CrystalFacetMat")
facet_mat.use_nodes=True
fbs=facet_mat.node_tree.nodes.get('Principled BSDF')
fbs.inputs['Base Color'].default_value=(0.22,0.66,1.0,1)
fbs.inputs['Metallic'].default_value=0.0
fbs.inputs['Roughness'].default_value=0.04
if 'Transmission Weight' in fbs.inputs:
    fbs.inputs['Transmission Weight'].default_value=0.92
if 'IOR' in fbs.inputs:
    fbs.inputs['IOR'].default_value=1.52
if 'Emission Color' in fbs.inputs:
    fbs.inputs['Emission Color'].default_value=(0.08,0.32,0.95,1)
    fbs.inputs['Emission Strength'].default_value=0.10

facets=[]
facet_specs=[
    (-0.72,-0.04, 0.58,0.32,0.10,0.62, 18,-12, 22),
    ( 0.68,-0.03, 0.46,0.28,0.10,0.55,-14, 10,-18),
    (-0.48,-0.04,-0.62,0.30,0.10,0.50, 12, 22,-14),
    ( 0.52,-0.03,-0.58,0.26,0.10,0.58,-18,-16, 20),
    ( 0.00,-0.05, 0.78,0.22,0.09,0.44, 26,  8, 12),
    ( 0.05,-0.04,-0.78,0.22,0.09,0.42,-24, -8,-16),
]
for i,(x,y,z,sx,sy,sz,rx,ry,rz) in enumerate(facet_specs):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(x,y,z))
    f=bpy.context.object
    f.name=f"CrystalFacet_{i:02d}"
    f.scale=(sx,sy,sz)
    f.rotation_euler=tuple(math.radians(v) for v in (rx,ry,rz))
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    f.data.materials.append(facet_mat)
    f.hide_render=True
    facets.append(f)

bpy.ops.mesh.primitive_torus_add(
    major_radius=0.88, minor_radius=0.045,
    major_segments=96, minor_segments=16,
    location=(0,-0.03,0),
    rotation=(math.radians(90),0,0)
)
inner_crystal=bpy.context.object
inner_crystal.name="CrystalInnerDepthRing"
inner_crystal.data.materials.append(facet_mat)
inner_crystal.hide_render=True

# Refined internal radial shards: thinner, denser, less toylike.
shards=[]
shard_specs = [
    (-70, 0.78, 0.018, 0.028),
    (-48, 0.88, 0.018, 0.026),
    (-28, 0.98, 0.017, 0.025),
    (-12, 1.05, 0.016, 0.024),
    (  8, 1.02, 0.016, 0.024),
    ( 24, 0.94, 0.017, 0.025),
    ( 42, 0.86, 0.018, 0.026),
    ( 62, 0.76, 0.018, 0.028),
]
for i,(ang,length,sx,sy) in enumerate(shard_specs):
    bpy.ops.mesh.primitive_cube_add(location=(0,-0.018,0))
    s=bpy.context.object
    s.name=f"CrystalShard_{i:02d}"
    s.scale=(sx, sy, length)
    s.rotation_euler=(math.radians(90), math.radians(2 if i%2==0 else -2), math.radians(ang))
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    s.data.materials.append(facet_mat)
    s.hide_render=True
    shards.append(s)

# Camera
bpy.ops.object.camera_add(location=(0,-10.2,0.45))
cam=bpy.context.object
cam.name="MorphMint_Camera"
cam.data.lens=65
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.camera=cam

def set_material(mat):
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(mat)

def set_crystal_internals(enabled):
    for f in facets+shards:
        f.hide_render=not enabled
    inner_crystal.hide_render=not enabled

def set_backdrop(mat):
    back.data.materials.clear()
    back.data.materials.append(mat)

rendered=[]

# Ceramic
scene.render.engine='BLENDER_EEVEE'
scene.view_settings.look='AgX - Medium High Contrast'
set_material(CERAMIC)
set_crystal_internals(False)
set_backdrop(BACK_DARK)
scene.render.filepath=str(OUT/"ceramic.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"ceramic.png"))

# Chrome: reduce blown white reflection by lowering reflection-card emission influence.
scene.render.engine='BLENDER_EEVEE'
scene.view_settings.look='AgX - High Contrast'
set_material(CHROME)
set_crystal_internals(False)
set_backdrop(BACK_DARK)
lights['Key'].data.energy=980
lights['Fill'].data.energy=620
lights['Under'].data.energy=180
lights['Rim'].data.energy=760
scene.render.filepath=str(OUT/"chrome.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"chrome.png"))

# Crystal: use Cycles for real transmission/refraction.
scene.render.engine='CYCLES'
scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.cycles.max_bounces=10
scene.cycles.transmission_bounces=10
scene.cycles.glossy_bounces=6
scene.cycles.diffuse_bounces=3
scene.view_settings.look='AgX - Medium High Contrast'
set_material(CRYSTAL)
set_crystal_internals(True)
set_backdrop(BACK_CRYSTAL)
lights['Key'].data.energy=760
lights['Fill'].data.energy=980
lights['Rim'].data.energy=1180
lights['Under'].data.energy=300
scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"crystal.png"))

result={
  "marker":"MORPHMINT_005_PUBLIC_REMOTE_3STATE_V4_PASS",
  "resolution":f"{W}x{H}",
  "renders":rendered,
  "crystal_engine":"CYCLES",
  "crystal_samples":40,
  "changes":[
    "JEONG native public runner",
    "reflection cards remain outside camera view",
    "chrome reflection intensity reduced",
    "crystal switched to Cycles glass + volume absorption",
    "refined thin radial shards and reduced chrome reflection blowout"
  ],
  "note":"Visual QA stills only. Transition remains blocked until all three states pass."
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_PUBLIC_REMOTE_3STATE_V4_PASS")
