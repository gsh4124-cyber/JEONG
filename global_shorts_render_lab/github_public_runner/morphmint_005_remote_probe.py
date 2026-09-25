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
    absorption=(0.90,0.96,1.0,1),
    density=0.00004,
    faceted=False
)
CRYSTAL_EDGE=glass_material(
    "MM_CrystalEdge",
    (1.0,1.0,1.0,1),
    rough=0.004,
    ior=1.54,
    absorption=(0.86,0.94,1.0,1),
    density=0.00005,
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

# Crystal visual grammar A: single watertight brilliant-cut medallion.
# This replaces stacked torus/ring construction. The crystal is one closed cut-gem
# body with a table, crown, girdle and pavilion, plus a matching baguette-cut
# identity bar. Large planar facets carry the visual grammar; no decorative
# concentric ring geometry is used.

def _recalc_outside_normals(obj):
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)

def build_cut_gem_medallion(name, material, accent_material):
    # BRILLIANT57-inspired topology (visual grammar, not a jewelry grading model):
    # 1 table + 8 star + 8 bezel/kite + 16 upper girdle +
    # 16 lower girdle + 8 pavilion mains. A thin 16-sided girdle connects them.
    crown_n=8
    girdle_n=16

    verts=[]
    def add_ring(count, radius, depth, offset=0.0):
        ids=[]
        for i in range(count):
            ang=(2.0*math.pi*i/count)+offset
            ids.append(len(verts))
            verts.append((radius*math.cos(ang),depth,radius*math.sin(ang)))
        return ids

    # Crown proportions: a readable table with distinct star/bezel families.
    table=add_ring(crown_n,0.82,-0.345,0.0)
    stars=add_ring(crown_n,1.04,-0.245,math.pi/crown_n)
    girdle_front=add_ring(girdle_n,1.52,-0.025,0.0)
    girdle_back=add_ring(girdle_n,1.52,0.085,0.0)

    # Pavilion mirrors the crown grammar: 16 lower-girdle triangles feed
    # eight pavilion mains converging on one culet point.
    lower=add_ring(crown_n,0.72,0.325,math.pi/crown_n)
    culet=len(verts)
    verts.append((0.0,0.535,0.0))

    faces=[]
    mats=[]

    # 1 table.
    faces.append(tuple(table))
    mats.append(0)

    for i in range(crown_n):
        ni=(i+1)%crown_n
        pi=(i-1)%crown_n
        ge=(2*i)%girdle_n
        go=(2*i+1)%girdle_n
        gn=(2*i+2)%girdle_n

        # 8 star facets.
        faces.append((table[i],table[ni],stars[i]))
        mats.append(0)

        # 8 dominant bezel/kite facets.
        faces.append((table[i],stars[i],girdle_front[ge],stars[pi]))
        mats.append(0)

        # 16 upper-girdle facets.
        faces.append((stars[i],girdle_front[ge],girdle_front[go]))
        mats.append(1)
        faces.append((stars[i],girdle_front[go],girdle_front[gn]))
        mats.append(1)

    # Thin crisp girdle.
    for j in range(girdle_n):
        nj=(j+1)%girdle_n
        faces.append((girdle_front[j],girdle_front[nj],girdle_back[nj],girdle_back[j]))
        mats.append(1)

    for i in range(crown_n):
        ni=(i+1)%crown_n
        pi=(i-1)%crown_n
        ge=(2*i)%girdle_n
        go=(2*i+1)%girdle_n
        gn=(2*i+2)%girdle_n

        # 16 lower-girdle facets.
        faces.append((girdle_back[ge],girdle_back[go],lower[i]))
        mats.append(0)
        faces.append((girdle_back[go],girdle_back[gn],lower[i]))
        mats.append(0)

        # 8 pavilion mains.
        faces.append((girdle_back[ge],lower[i],culet,lower[pi]))
        mats.append(0)

    mesh=bpy.data.meshes.new(name+"_Mesh")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.data.materials.append(accent_material)
    for idx,poly in enumerate(obj.data.polygons):
        poly.use_smooth=False
        poly.material_index=mats[idx] if idx < len(mats) else 0
    obj.hide_render=True
    _recalc_outside_normals(obj)
    return obj

def build_baguette_bar(name, material):
    w=0.155
    h=0.70
    c=0.045
    outer=[
        (-w+c,-h),(w-c,-h),(w,-h+c),(w,h-c),
        (w-c,h),(-w+c,h),(-w,h-c),(-w,-h+c),
    ]
    inner=[(x*0.67,z*0.88) for x,z in outer]
    verts=[]
    # x, y(depth), z
    for x,z in inner:
        verts.append((x,-0.385,z))
    for x,z in outer:
        verts.append((x,-0.325,z))
    for x,z in outer:
        verts.append((x,-0.085,z))

    faces=[]
    faces.append(tuple(range(8)))
    for i in range(8):
        j=(i+1)%8
        faces.append((i,j,8+j,8+i))
    for i in range(8):
        j=(i+1)%8
        faces.append((8+i,8+j,16+j,16+i))
    faces.append(tuple(reversed(range(16,24))))

    mesh=bpy.data.meshes.new(name+"_Mesh")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth=False
    obj.hide_render=True
    _recalc_outside_normals(obj)
    return obj

crystal_gem=build_cut_gem_medallion("MorphMint_CutGem",CRYSTAL,CRYSTAL_EDGE)
crystal_bar=build_baguette_bar("MorphMint_BaguetteIdentityBar",CRYSTAL_EDGE)

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
    cr.elements[0].color=(0.002,0.003,0.007,1)
    cr.elements[1].position=0.82
    cr.elements[1].color=(0.98,0.995,1.0,1)
    mid=cr.elements.new(0.48)
    mid.color=(0.025,0.035,0.055,1)
    hi=cr.elements.new(0.68)
    hi.color=(0.45,0.62,0.82,1)

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

rendered=[]

# Ceramic
scene.render.engine='BLENDER_EEVEE'
scene.view_settings.look='AgX - Medium High Contrast'
set_material(CERAMIC)
set_crystal_internals(False)
set_crystal_environment(False)
set_crystal_shell(False)
set_chrome_strips(False)
set_light_transmission_visibility(True)
set_backdrop(BACK_DARK)
set_world_crystal_env(False)
set_backdrop_transmission(True)
lights['Key'].data.energy=1300
lights['Fill'].data.energy=760
lights['Rim'].data.energy=820
lights['Under'].data.energy=80
scene.render.filepath=str(OUT/"ceramic.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"ceramic.png"))

# Chrome: no reflection cards; controlled strip highlights only.
scene.render.engine='BLENDER_EEVEE'
scene.view_settings.look='AgX - High Contrast'
set_material(CHROME)
set_crystal_internals(False)
set_crystal_environment(False)
set_crystal_shell(False)
set_chrome_strips(True)
set_light_transmission_visibility(True)
set_backdrop(BACK_DARK)
set_world_crystal_env(False)
set_backdrop_transmission(True)
lights['Key'].data.energy=520
lights['Fill'].data.energy=360
lights['Rim'].data.energy=420
lights['Under'].data.energy=0
scene.render.filepath=str(OUT/"chrome.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"chrome.png"))

# Crystal grammar A4: BRILLIANT57-inspired facet topology + neutral facet-lighting studio.
scene.render.engine='CYCLES'
scene.cycles.samples=96
scene.cycles.use_denoising=True
scene.cycles.max_bounces=10
scene.cycles.transmission_bounces=10
scene.cycles.glossy_bounces=6
scene.cycles.diffuse_bounces=3
scene.view_settings.look='AgX - Medium High Contrast'
scene.world.color=(0.0015,0.004,0.012)
set_material(CRYSTAL)
set_crystal_internals(False)
set_crystal_environment(False)
set_crystal_shell(True)
set_chrome_strips(True)
set_light_transmission_visibility(True)
set_backdrop(BACK_CRYSTAL)
set_world_crystal_env(True)
set_backdrop_transmission(False)
chrome_strips['ChromeStripL'].data.energy=85
chrome_strips['ChromeStripR'].data.energy=72
chrome_strips['ChromeStripTop'].data.energy=65
chrome_strips['ChromeStripL'].data.color=(1.0,0.96,0.92)
chrome_strips['ChromeStripR'].data.color=(0.86,0.93,1.0)
chrome_strips['ChromeStripTop'].data.color=(1.0,1.0,1.0)
# Crystal state: remove the floor from the render entirely so no large
# refracted polygon fragments can appear inside the transparent medallion.
floor.hide_render=True
lights['Key'].data.energy=560
lights['Fill'].data.energy=380
lights['Rim'].data.energy=980
lights['Under'].data.energy=0
lights['Key'].data.color=(1.0,0.96,0.92)
lights['Fill'].data.color=(0.90,0.95,1.0)
lights['Rim'].data.color=(1.0,1.0,1.0)
scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"crystal.png"))

result={
  "marker":"MORPHMINT_005_CRYSTAL_BRILLIANT57_A4_PASS",
  "resolution":f"{W}x{H}",
  "renders":rendered,
  "crystal_engine":"CYCLES",
  "crystal_samples":96,
  "changes":[
    "removed all reflection-card geometry",
    "chrome uses three narrow area-strip highlights only",
    "replaced stacked crystal rings with one watertight brilliant-cut medallion mesh",
    "BRILLIANT57-inspired topology: 1 table, 8 star, 8 bezel/kite, 16 upper girdle, 16 lower girdle and 8 pavilion-main facets",
    "matching baguette-cut identity bar preserves MorphMint identity",
    "removed transmission-visible emissive cards that caused torn white streaks",
    "facet readability now comes from the cut topology, procedural world refraction and real area-light highlights"
  ],
  "note":"Visual QA stills only. Transition remains blocked until all three states pass."
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_CRYSTAL_BRILLIANT57_A4_PASS")
