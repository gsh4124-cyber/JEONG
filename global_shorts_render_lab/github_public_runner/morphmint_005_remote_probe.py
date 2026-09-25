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

# Crystal-state V22 CUT_GEM_TOPOLOGY: one coherent watertight cut-crystal mesh.
# This replaces the V21 stacked torus/ring assembly. The premium signal must come
# from real crown / girdle / pavilion planes that refract as one object.

def create_cut_gem_medallion(name, segments=32):
    # Camera is on negative Y, so negative Y is the front/table side.
    rings=[
        # radius, y-depth, angular offset
        (0.72, -0.275, 0.0),                         # table edge
        (1.06, -0.205, math.pi/segments),            # star facets
        (1.34, -0.105, 0.0),                         # bezel/crown
        (1.52, -0.020, math.pi/segments),             # front girdle
        (1.52,  0.105, 0.0),                         # rear girdle
        (0.96,  0.300, math.pi/segments),             # pavilion shoulder
    ]

    verts=[]
    ring_ids=[]
    for radius,y,offset in rings:
        ids=[]
        for i in range(segments):
            a=(2.0*math.pi*i/segments)+offset
            ids.append(len(verts))
            verts.append((radius*math.cos(a), y, radius*math.sin(a)))
        ring_ids.append(ids)

    # Rear culet point.
    culet=len(verts)
    verts.append((0.0,0.425,0.0))

    faces=[]
    mat_ids=[]

    # Flat central table as a single optical plane.
    faces.append(tuple(reversed(ring_ids[0])))
    mat_ids.append(0)

    # Triangulated cut bands. Alternating diagonals prevents a repetitive
    # "gear" read and yields long/short facet rhythm like real brilliant cuts.
    for r in range(len(ring_ids)-1):
        a_ring=ring_ids[r]
        b_ring=ring_ids[r+1]
        for i in range(segments):
            j=(i+1)%segments
            a0,a1=a_ring[i],a_ring[j]
            b0,b1=b_ring[i],b_ring[j]
            if (i+r)%2==0:
                faces.extend([(a0,b0,b1),(a0,b1,a1)])
            else:
                faces.extend([(a0,b0,a1),(a1,b0,b1)])
            # Slightly tinted edge material only on alternating crown/girdle facets.
            edge_slot=1 if r>=1 and ((i+r)%4==0) else 0
            mat_ids.extend([edge_slot,edge_slot])

    # Pavilion converges to a single culet, producing coherent rear refraction.
    last=ring_ids[-1]
    for i in range(segments):
        j=(i+1)%segments
        faces.append((last[i],culet,last[j]))
        mat_ids.append(1 if i%3==0 else 0)

    mesh=bpy.data.meshes.new(name+"_Mesh")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(CRYSTAL)
    obj.data.materials.append(CRYSTAL_EDGE)
    for idx,poly in enumerate(obj.data.polygons):
        poly.use_smooth=False
        if idx < len(mat_ids):
            poly.material_index=mat_ids[idx]

    # Microscopic edge softening only to catch highlights; geometry remains faceted.
    bev=obj.modifiers.new("CrystalMicroBevel","BEVEL")
    bev.width=0.008
    bev.segments=1
    bev.limit_method='ANGLE'
    bev.angle_limit=math.radians(24)
    obj.hide_render=True
    return obj

crystal_gem=create_cut_gem_medallion("MorphMint_CutGem",segments=32)

# Brand-identity bar becomes a frosted engraved-looking crystal insert rather
# than a separate shiny torus/ring motif. It sits just above the table plane.
bpy.ops.mesh.primitive_cube_add(location=(0,-0.292,0))
crystal_bar=bpy.context.object
crystal_bar.name="MorphMint_CrystalIdentityBar"
crystal_bar.scale=(0.125,0.018,0.68)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
crystal_bar.data.materials.append(CRYSTAL_SHELL)
crystal_bar.hide_render=True
cbb=crystal_bar.modifiers.new("CrystalBarMicroBevel","BEVEL")
cbb.width=0.035
cbb.segments=2

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
    crystal_gem.hide_render=not enabled
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

# Ceramic/chrome are PASS_LOCKED and are intentionally not re-rendered here.
# The branch inherits their V21 persistent proofs unchanged.

# Crystal V22 CUT_GEM_TOPOLOGY proof.
scene.render.engine='CYCLES'
scene.cycles.samples=128
scene.cycles.use_denoising=True
scene.cycles.max_bounces=12
scene.cycles.transmission_bounces=12
scene.cycles.glossy_bounces=8
scene.cycles.diffuse_bounces=3
scene.view_settings.look='AgX - Medium High Contrast'
set_material(CRYSTAL)
set_crystal_internals(False)
set_crystal_environment(True)
set_crystal_shell(True)
set_chrome_strips(False)
set_light_transmission_visibility(False)
set_backdrop(BACK_CRYSTAL)
set_world_crystal_env(False)
set_backdrop_transmission(False)

# High-contrast product-lighting grammar: dark studio + transmissive optical
# panels behind the watertight gem + restrained edge/rim light.
lights['Key'].data.energy=520
lights['Fill'].data.energy=300
lights['Rim'].data.energy=1450
lights['Under'].data.energy=90
floor.hide_render=False
floor.location.z=-1.78

scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"crystal.png"))

result={
  "marker":"MORPHMINT_005_PUBLIC_REMOTE_3STATE_V22_CUT_GEM_PASS",
  "resolution":f"{W}x{H}",
  "renders":rendered,
  "crystal_engine":"CYCLES",
  "crystal_samples":128,
  "construction_method":"CUT_GEM_WATERTIGHT_TOPOLOGY",
  "changes":[
    "ceramic/chrome PASS_LOCKED and not re-rendered",
    "replaced stacked torus/ring crystal assembly with one watertight cut-gem medallion mesh",
    "real table/star/crown/girdle/pavilion/culet planes with triangulated facet rhythm",
    "frosted identity bar retained as a separate restrained brand cue",
    "crystal optical panels enabled behind the object; noisy procedural world disabled"
  ],
  "note":"Visual QA still only. Transition remains blocked until crystal clears internal 90-point gate."
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_PUBLIC_REMOTE_3STATE_V22_CUT_GEM_PASS")
