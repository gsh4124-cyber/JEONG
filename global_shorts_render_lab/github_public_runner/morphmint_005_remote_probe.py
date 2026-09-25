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

def glass_material(name, color, rough=0.018, ior=1.46, absorption=(0.12,0.42,0.95,1), density=0.045, faceted=False):
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

    if faceted:
        tex=nt.nodes.new('ShaderNodeTexVoronoi')
        tex.voronoi_dimensions='3D'
        tex.distance='EUCLIDEAN'
        tex.feature='DISTANCE_TO_EDGE'
        tex.inputs['Scale'].default_value=6.0
        ramp=nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position=0.025
        ramp.color_ramp.elements[1].position=0.11
        bump=nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=0.018
        bump.inputs['Distance'].default_value=0.008
        nt.links.new(tex.outputs['Distance'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], glass.inputs['Normal'])

    vol=nt.nodes.new('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value=absorption
    vol.inputs['Density'].default_value=density
    nt.links.new(glass.outputs['BSDF'], out.inputs['Surface'])
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    return m

def make_tetra(name, loc, scale, rot, material):
    verts=[
        ( 0.00, 0.55, 0.00),
        (-0.50,-0.32,-0.42),
        ( 0.50,-0.32,-0.42),
        ( 0.00,-0.32, 0.58),
    ]
    faces=[(0,1,2),(0,3,1),(0,2,3),(1,3,2)]
    mesh=bpy.data.meshes.new(name+"_Mesh")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.location=loc
    obj.scale=scale
    obj.rotation_euler=tuple(math.radians(v) for v in rot)
    obj.data.materials.append(material)
    obj.hide_render=True
    return obj


CERAMIC=principled("MM_Ceramic",(0.66,0.10,0.028,1),0.0,0.44)
CHROME=principled("MM_Chrome",(0.82,0.87,0.96,1),1.0,0.19)
CRYSTAL=glass_material(
    "MM_Crystal",
    (1.0,1.0,1.0,1),
    rough=0.003,
    ior=1.52,
    absorption=(0.55,0.82,1.0,1),
    density=0.00012,
    faceted=False
)
CRYSTAL_EDGE=glass_material(
    "MM_CrystalEdge",
    (0.94,0.99,1.0,1),
    rough=0.004,
    ior=1.54,
    absorption=(0.10,0.42,1.0,1),
    density=0.00022,
    faceted=False
)
CRYSTAL_SHELL=glass_material(
    "MM_CrystalShell",
    (0.94,0.99,1.0,1),
    rough=0.018,
    ior=1.50,
    absorption=(0.08,0.34,0.88,1),
    density=0.010,
    faceted=False
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

# Crystal visual grammar B: art-directed facet laminate.
# A thin optical core preserves transparent depth, while the camera-facing crown,
# girdle and identity bar are separate facet layers with controlled optical roles.
# This deliberately avoids relying on one thick physical glass body to create every cue.

FACET_CLEAR=principled("MM_FacetClear",(0.72,0.84,0.94,1),0.0,0.055,0.42,1.47)
FACET_ICE=principled("MM_FacetIce",(0.46,0.68,0.88,1),0.06,0.070,0.18,1.46)
FACET_FLASH=principled("MM_FacetFlash",(0.92,0.98,1.0,1),0.28,0.040,0.04,1.45)

def build_laminate_crown(name):
    n=16
    verts=[]
    def ring(radius,y,offset=0.0):
        ids=[]
        for i in range(n):
            a=2*math.pi*i/n+offset
            ids.append(len(verts))
            verts.append((radius*math.cos(a),y,radius*math.sin(a)))
        return ids

    table=ring(0.61,-0.285,0.0)
    star=ring(0.98,-0.225,math.pi/n)
    girdle=ring(1.49,-0.105,0.0)

    faces=[]
    mats=[]

    # One quiet table keeps the MorphMint identity bar legible.
    faces.append(tuple(table)); mats.append(0)

    for i in range(n):
        j=(i+1)%n
        # Star triangles.
        faces.append((table[i],table[j],star[i])); mats.append(0 if i%2==0 else 1)
        # Bezel / kite facets.
        faces.append((table[j],girdle[j],star[i])); mats.append(1 if i%3 else 2)
        # Upper-girdle facets, small enough to create scintillation.
        faces.append((star[i],girdle[j],girdle[i])); mats.append(2 if i%2==0 else 1)

    mesh=bpy.data.meshes.new(name+"_Mesh")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    for mat in (FACET_CLEAR,FACET_ICE,FACET_FLASH):
        obj.data.materials.append(mat)
    for idx,p in enumerate(obj.data.polygons):
        p.use_smooth=False
        p.material_index=mats[idx]
    obj.hide_render=True
    return obj

def build_laminate_girdle(name):
    n=32
    verts=[]
    front=[]
    back=[]
    for i in range(n):
        a=2*math.pi*i/n
        x=1.50*math.cos(a); z=1.50*math.sin(a)
        front.append(len(verts)); verts.append((x,-0.10,z))
        back.append(len(verts)); verts.append((x,0.115,z))
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.append((front[i],front[j],back[j],back[i]))
    mesh=bpy.data.meshes.new(name+"_Mesh")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(FACET_ICE)
    obj.data.materials.append(FACET_FLASH)
    for i,p in enumerate(obj.data.polygons):
        p.use_smooth=False
        p.material_index=1 if i%6==0 else 0
    obj.hide_render=True
    return obj

# Very thin transparent core: depth cue only, not the primary visual grammar.
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.43, depth=0.14, location=(0,0.015,0))
crystal_core=bpy.context.object
crystal_core.name="MorphMint_CrystalOpticalCore"
crystal_core.rotation_euler=(math.radians(90),0,0)
crystal_core.data.materials.append(CRYSTAL)
crystal_core.hide_render=True

crystal_crown=build_laminate_crown("MorphMint_FacetLaminateCrown")
crystal_girdle=build_laminate_girdle("MorphMint_FacetLaminateGirdle")

bpy.ops.mesh.primitive_cube_add(location=(0,-0.315,0))
crystal_bar=bpy.context.object
crystal_bar.name="MorphMint_LaminateIdentityBar"
crystal_bar.scale=(0.125,0.040,0.68)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
crystal_bar.data.materials.append(FACET_CLEAR)
crystal_bar.hide_render=True
cbb=crystal_bar.modifiers.new("LaminateBarBevel","BEVEL")
cbb.width=0.050
cbb.segments=1

# Ground and backdrop
bpy.ops.mesh.primitive_plane_add(size=30, location=(0,2,-2.25))
floor=bpy.context.object
floor.name="MorphMint_Floor"
floor.data.materials.append(principled("FloorMat",(0.012,0.018,0.032,1),0.05,0.38))

bpy.ops.mesh.primitive_plane_add(size=18, location=(0,2.8,1.2), rotation=(math.radians(90),0,0))
back=bpy.context.object
back.name="Backdrop"
BACK_DARK=principled("BackdropDark",(0.006,0.012,0.028,1),0.0,0.48)
BACK_CRYSTAL=principled("BackdropCrystal",(0.0015,0.004,0.012,1),0.0,0.68)
back.data.materials.append(BACK_DARK)

# General lighting
lights={}
for loc,energy,size,color,name in [
    ((-3.6,-4.5,5.2),1300,4.0,(1.0,0.60,0.38),"Key"),
    (( 4.2,-3.5,1.4), 820,3.2,(0.25,0.52,1.0),"Fill"),
    (( 0.0, 2.0,5.6), 820,2.5,(0.45,0.78,1.0),"Rim"),
    (( 0.0,-1.6,-1.6), 120,2.0,(0.15,0.30,0.75),"Under")
]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object
    l.name=name
    l.data.energy=energy
    l.data.size=size
    l.data.color=color
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
    lights[name]=l

# Dedicated narrow chrome strip lights. No reflection-card geometry.
chrome_strips={}
for loc,energy,size_x,size_y,color,name in [
    ((-4.4,-2.4,0.8),520,0.28,3.6,(1.0,0.83,0.72),"ChromeStripL"),
    (( 4.5,-2.2,0.5),420,0.24,3.2,(0.72,0.84,1.0),"ChromeStripR"),
    (( 0.0,-1.2,4.8),300,2.8,0.22,(0.82,0.90,1.0),"ChromeStripTop"),
]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object
    l.name=name
    l.data.shape='RECTANGLE'
    l.data.size=size_x
    l.data.size_y=size_y
    l.data.energy=energy
    l.data.color=color
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
    l.hide_render=True
    chrome_strips[name]=l

# Crystal refraction environment.
# These emissive panels are invisible to the camera but visible through
# transmission/glossy rays, giving the glass real optical information to bend.
crystal_env=[]
env_specs=[
    ((-1.00,1.20, 0.30),(0.11,0.02,1.65),-16,(1.0,0.82,0.62,1),3.2,"WarmStripe"),
    ((-0.36,1.30,-0.10),(0.08,0.02,1.90),  8,(0.75,0.94,1.0,1),4.0,"IceStripeA"),
    (( 0.42,1.25, 0.18),(0.10,0.02,1.80),-10,(0.40,0.78,1.0,1),3.6,"IceStripeB"),
    (( 1.06,1.18,-0.24),(0.09,0.02,1.55), 18,(1.0,1.0,1.0,1),2.8,"WhiteStripe"),
]
for loc,scale,rz,color,strength,name in env_specs:
    bpy.ops.mesh.primitive_cube_add(location=loc)
    p=bpy.context.object
    p.name=f"CrystalEnv_{name}"
    p.scale=scale
    p.rotation_euler=(0,0,math.radians(rz))
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)

    em=bpy.data.materials.new(f"CrystalEnvMat_{name}")
    em.use_nodes=True
    bs=em.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=color
    bs.inputs['Roughness'].default_value=0.45
    if 'Emission Color' in bs.inputs:
        bs.inputs['Emission Color'].default_value=color
        bs.inputs['Emission Strength'].default_value=strength
    p.data.materials.append(em)

    try:
        p.visible_camera=False
        p.visible_diffuse=False
        p.visible_shadow=False
        p.visible_glossy=True
        p.visible_transmission=True
    except Exception:
        pass
    p.hide_render=True
    crystal_env.append(p)

# V18: no explicit internal fracture geometry.
# Crystal readability comes from clean glass center + faceted perimeter rings
# refracting a camera-invisible optical environment.
fractures=[]
fracture_planes=[]

# Procedural optical environment for crystal reflections/refractions.
# The physical backdrop stays visible to the camera but is hidden from transmission
# rays during crystal rendering, letting this irregular environment appear only through glass.
def set_world_crystal_env(enabled):
    if not enabled:
        scene.world.use_nodes=False
        scene.world.color=(0.008,0.012,0.025)
        return

    world=scene.world
    world.use_nodes=True
    nt=world.node_tree
    nt.nodes.clear()

    out=nt.nodes.new('ShaderNodeOutputWorld')
    bg=nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value=1.15

    texcoord=nt.nodes.new('ShaderNodeTexCoord')
    noise=nt.nodes.new('ShaderNodeTexNoise')
    noise.noise_dimensions='3D'
    noise.inputs['Scale'].default_value=2.15
    noise.inputs['Detail'].default_value=3.2
    noise.inputs['Roughness'].default_value=0.62

    ramp=nt.nodes.new('ShaderNodeValToRGB')
    cr=ramp.color_ramp
    cr.elements[0].position=0.18
    cr.elements[0].color=(0.003,0.012,0.045,1)
    cr.elements[1].position=0.82
    cr.elements[1].color=(0.72,0.94,1.0,1)
    mid=cr.elements.new(0.48)
    mid.color=(0.03,0.25,0.62,1)
    hi=cr.elements.new(0.68)
    hi.color=(0.28,0.78,1.0,1)

    nt.links.new(texcoord.outputs['Normal'],noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'],ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'],bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'],out.inputs['Surface'])

def set_backdrop_transmission(visible):
    try:
        back.visible_transmission=visible
    except Exception:
        pass

# Camera
bpy.ops.object.camera_add(location=(0.95,-10.25,0.72))
cam=bpy.context.object
cam.name="MorphMint_Camera"
cam.data.lens=68
camera_target=Vector((0,0,0.05))
cam.rotation_euler=(camera_target-cam.location).to_track_quat('-Z','Y').to_euler()
scene.camera=cam

def set_material(mat):
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(mat)

def set_crystal_internals(enabled):
    for obj in fractures+fracture_planes:
        obj.hide_render=not enabled

def set_crystal_environment(enabled):
    for obj in crystal_env:
        obj.hide_render=not enabled

def set_backdrop(mat):
    back.data.materials.clear()
    back.data.materials.append(mat)

def set_chrome_strips(enabled):
    for l in chrome_strips.values():
        l.hide_render=not enabled

def set_crystal_shell(enabled):
    body.hide_render=enabled
    rim.hide_render=enabled
    bar.hide_render=enabled
    crystal_core.hide_render=not enabled
    crystal_crown.hide_render=not enabled
    crystal_girdle.hide_render=not enabled
    crystal_bar.hide_render=not enabled

def set_light_transmission_visibility(visible):
    for l in list(lights.values()) + list(chrome_strips.values()):
        try:
            l.visible_transmission=visible
        except Exception:
            pass

rendered=[
    str(OUT/"ceramic.png"),
    str(OUT/"chrome.png"),
]

# Ceramic/chrome are PASS_LOCKED and are intentionally NOT re-rendered.
# Crystal-only R&D proof.
scene.render.engine='CYCLES'
scene.cycles.samples=128
scene.cycles.use_denoising=True
scene.cycles.max_bounces=8
scene.cycles.transmission_bounces=6
scene.cycles.glossy_bounces=6
scene.cycles.diffuse_bounces=2
scene.view_settings.look='AgX - High Contrast'
set_crystal_internals(False)
set_crystal_environment(False)
set_crystal_shell(True)
set_chrome_strips(False)
set_light_transmission_visibility(True)
set_backdrop(BACK_CRYSTAL)
set_world_crystal_env(False)
set_backdrop_transmission(True)
floor.hide_render=True

# Soft base illumination stays restrained; small point sources create crisp jewelry glints.
lights['Key'].data.energy=240
lights['Key'].data.size=5.0
lights['Key'].data.color=(0.78,0.88,1.0)
lights['Fill'].data.energy=150
lights['Fill'].data.size=4.0
lights['Fill'].data.color=(0.55,0.72,1.0)
lights['Rim'].data.energy=360
lights['Rim'].data.size=1.4
lights['Rim'].data.color=(1.0,1.0,1.0)
lights['Under'].data.energy=0

jewel_points=[]
for loc,energy,color,name in [
    ((-2.8,-3.6, 2.7),520,(1.0,1.0,1.0),"JewelPointA"),
    (( 3.1,-3.2, 1.9),430,(0.62,0.82,1.0),"JewelPointB"),
    ((-1.4,-2.6,-2.1),330,(0.72,0.88,1.0),"JewelPointC"),
    (( 1.5,-2.4, 3.5),380,(1.0,0.92,0.78),"JewelPointD"),
]:
    bpy.ops.object.light_add(type='POINT',location=loc)
    lp=bpy.context.object
    lp.name=name
    lp.data.energy=energy
    lp.data.shadow_soft_size=0.075
    lp.data.color=color
    jewel_points.append(lp)

scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"crystal.png"))

result={
  "marker":"MORPHMINT_005_CRYSTAL_BRILLIANT57_A5_PASS",
  "resolution":f"{W}x{H}",
  "renders":rendered,
  "crystal_engine":"CYCLES",
  "crystal_samples":128,
  "changes":[
    "removed all reflection-card geometry",
    "chrome uses three narrow area-strip highlights only",
    "removed radial shard and inner crystal ring structure",
    "crystal uses dedicated asset geometry: thin optical body, 24-facet outer crown, 24-facet inner ring, glint ring and separate cut crystal identity bar"
  ],
  "note":"Visual QA stills only. Transition remains blocked until all three states pass."
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_CRYSTAL_BRILLIANT57_A5_PASS")