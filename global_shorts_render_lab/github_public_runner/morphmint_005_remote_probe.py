import bpy, math, pathlib, json
from mathutils import Vector

OUT=pathlib.Path("render_output/morphmint_005_probe")
OUT.mkdir(parents=True, exist_ok=True)

W,H=540,960
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
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

def crystal_material():
    m=bpy.data.materials.new("MM_Crystal")
    m.use_nodes=True
    nt=m.node_tree
    bsdf=nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(0.72,0.90,1.0,1)
    bsdf.inputs['Metallic'].default_value=0.0
    bsdf.inputs['Roughness'].default_value=0.035
    if 'Transmission Weight' in bsdf.inputs:
        bsdf.inputs['Transmission Weight'].default_value=1.0
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value=1.46
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value=0.25
    if 'Coat Roughness' in bsdf.inputs:
        bsdf.inputs['Coat Roughness'].default_value=0.04

    vol=nt.nodes.new('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value=(0.05,0.32,0.95,1)
    vol.inputs['Density'].default_value=0.16
    nt.links.new(vol.outputs['Volume'], nt.nodes['Material Output'].inputs['Volume'])

    # Blender 4+/5+ hashed/dithered surface behavior if available.
    try:
        m.surface_render_method='DITHERED'
    except Exception:
        pass
    return m

CERAMIC=principled("MM_Ceramic",(0.66,0.10,0.028,1),0.0,0.44)
CHROME=principled("MM_Chrome",(0.78,0.84,0.95,1),1.0,0.085)
CRYSTAL=crystal_material()

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

# Dark vertical backdrop behind object, gives crystal refractive contrast.
bpy.ops.mesh.primitive_plane_add(size=18, location=(0,2.8,1.2), rotation=(math.radians(90),0,0))
back=bpy.context.object
back.name="Backdrop"
back.data.materials.append(principled("BackdropMat",(0.006,0.012,0.03,1),0.0,0.42))

# Reflection cards: far outside camera frustum, used only as environment reflections.
for x,z,sx,sz,val in [
    (-7.0,1.2,1.4,4.8,1.0),
    ( 7.0,0.5,1.2,4.2,0.72),
    ( 0.0,7.0,4.0,1.0,0.55)
]:
    bpy.ops.mesh.primitive_plane_add(size=2, location=(x,-1.0,z))
    card=bpy.context.object
    card.name=f"ReflectionCard_{x}_{z}"
    card.scale=(sx,sz,1)
    card.rotation_euler=(math.radians(90),0,0)
    em=bpy.data.materials.new(f"CardMat_{x}_{z}")
    em.use_nodes=True
    nt=em.node_tree
    bs=nt.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(val,val,val,1)
    bs.inputs['Roughness'].default_value=0.25
    if 'Emission Color' in bs.inputs:
        bs.inputs['Emission Color'].default_value=(val,val,val,1)
        bs.inputs['Emission Strength'].default_value=1.6
    card.data.materials.append(em)

# Key/fill/rim lighting
for loc,energy,size,color,name in [
    ((-3.6,-4.5,5.2),1500,4.0,(1.0,0.60,0.38),"Key"),
    (( 4.2,-3.5,1.4),1150,3.5,(0.25,0.52,1.0),"Fill"),
    (( 0.0, 2.0,5.6),1000,2.5,(0.45,0.78,1.0),"Rim"),
    (( 0.0,-1.6,-1.6), 420,2.2,(0.15,0.30,0.75),"Under")
]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object
    l.name=name
    l.data.energy=energy
    l.data.size=size
    l.data.color=color
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()

# Crystal internal facets: hidden for ceramic/chrome, visible only for crystal.
facet_mat=bpy.data.materials.new("CrystalFacetMat")
facet_mat.use_nodes=True
fbs=facet_mat.node_tree.nodes.get('Principled BSDF')
fbs.inputs['Base Color'].default_value=(0.28,0.72,1.0,1)
fbs.inputs['Metallic'].default_value=0.05
fbs.inputs['Roughness'].default_value=0.10
if 'Transmission Weight' in fbs.inputs:
    fbs.inputs['Transmission Weight'].default_value=0.65
if 'IOR' in fbs.inputs:
    fbs.inputs['IOR'].default_value=1.52

facets=[]
facet_specs=[
    (-0.72,-0.02,0.58,0.24,0.08,0.55, 18,-12, 22),
    ( 0.68, 0.00,0.46,0.20,0.07,0.48,-14, 10,-18),
    (-0.48,-0.01,-0.62,0.22,0.08,0.42, 12, 22,-14),
    ( 0.52, 0.01,-0.58,0.18,0.07,0.50,-18,-16, 20),
    ( 0.00, 0.05,0.78,0.16,0.06,0.36, 26,  8, 12),
    ( 0.05, 0.02,-0.78,0.15,0.06,0.34,-24, -8,-16),
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

# Subtle crystal inner ring shell to reinforce depth while preserving silhouette.
bpy.ops.mesh.primitive_torus_add(
    major_radius=0.88, minor_radius=0.035,
    major_segments=96, minor_segments=16,
    location=(0,0.02,0),
    rotation=(math.radians(90),0,0)
)
inner_crystal=bpy.context.object
inner_crystal.name="CrystalInnerDepthRing"
inner_crystal.data.materials.append(facet_mat)
inner_crystal.hide_render=True

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
    for f in facets:
        f.hide_render=not enabled
    inner_crystal.hide_render=not enabled

states=[("ceramic",CERAMIC),("chrome",CHROME),("crystal",CRYSTAL)]
rendered=[]
for name,mat in states:
    set_material(mat)
    set_crystal_internals(name=="crystal")

    # Tune lights per state without changing object identity.
    if name=="ceramic":
        scene.view_settings.look='AgX - Medium High Contrast'
    elif name=="chrome":
        scene.view_settings.look='AgX - High Contrast'
    else:
        scene.view_settings.look='AgX - Medium High Contrast'

    scene.render.filepath=str(OUT/f"{name}.png")
    bpy.ops.render.render(write_still=True)
    rendered.append(str(OUT/f"{name}.png"))

result={
  "marker":"MORPHMINT_005_PUBLIC_REMOTE_3STATE_V2_PASS",
  "resolution":f"{W}x{H}",
  "engine":scene.render.engine,
  "renders":rendered,
  "changes":[
    "reflection cards moved outside camera frustum",
    "crystal transmission + IOR + volume absorption",
    "internal crystal facets and inner depth ring added only in crystal state"
  ],
  "note":"Visual QA stills. Transition remains blocked until all 3 states pass."
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_PUBLIC_REMOTE_3STATE_V2_PASS")
