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


def make_cut_disc(name, material, segments=40):
    # V16 rerun: closed cut-gem medallion with a clean central face.
    # Facets exist only between concentric rings so no radial spoke pattern appears.
    radii=[0.46,0.86,1.18,1.42,1.55]
    base_front=[-0.265,-0.252,-0.272,-0.220,-0.158]
    base_back =[ 0.265, 0.252, 0.272, 0.220, 0.158]
    verts=[]
    faces=[]

    front_rings=[]
    for k,(r,base_y) in enumerate(zip(radii,base_front)):
        ring=[]
        for i in range(segments):
            a=2*math.pi*i/segments
            wave=(0.008*math.sin(3*a+0.55*k) +
                  0.006*math.cos(5*a-0.35*k) +
                  (0.004 if (i+k)%2==0 else -0.004))
            ring.append(len(verts))
            verts.append((r*math.cos(a),base_y+wave,r*math.sin(a)))
        front_rings.append(ring)

    back_rings=[]
    for k,(r,base_y) in enumerate(zip(radii,base_back)):
        ring=[]
        for i in range(segments):
            a=2*math.pi*i/segments
            wave=(0.007*math.sin(4*a-0.45*k) +
                  0.005*math.cos(6*a+0.25*k) +
                  (-0.003 if (i+k)%2==0 else 0.003))
            ring.append(len(verts))
            verts.append((r*math.cos(a),base_y+wave,r*math.sin(a)))
        back_rings.append(ring)

    # Clean center faces: n-gons, no radial fan triangles.
    faces.append(tuple(reversed(front_rings[0])))
    faces.append(tuple(back_rings[0]))

    # Front annular facets. Mostly quads, occasional diagonal split in outer rings only.
    for k in range(len(front_rings)-1):
        ra,rb=front_rings[k],front_rings[k+1]
        for i in range(segments):
            j=(i+1)%segments
            if k >= 2 and (i+k)%3==0:
                faces.append((ra[i],rb[i],rb[j]))
                faces.append((ra[i],rb[j],ra[j]))
            else:
                faces.append((ra[i],rb[i],rb[j],ra[j]))

    # Back annular surfaces.
    for k in range(len(back_rings)-1):
        ra,rb=back_rings[k],back_rings[k+1]
        for i in range(segments):
            j=(i+1)%segments
            faces.append((ra[j],rb[j],rb[i],ra[i]))

    # Outer wall.
    rf=front_rings[-1]
    rb=back_rings[-1]
    for i in range(segments):
        j=(i+1)%segments
        faces.append((rf[i],rb[i],rb[j],rf[j]))

    mesh=bpy.data.meshes.new(name+"_Mesh")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.hide_render=True
    for poly in obj.data.polygons:
        poly.use_smooth=False
    return obj

CERAMIC=principled("MM_Ceramic",(0.66,0.10,0.028,1),0.0,0.44)
CHROME=principled("MM_Chrome",(0.82,0.87,0.96,1),1.0,0.19)
CRYSTAL=glass_material(
    "MM_Crystal",
    (0.985,1.0,1.0,1),
    rough=0.012,
    ior=1.48,
    absorption=(0.22,0.62,1.0,1),
    density=0.0009,
    faceted=True
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

# Crystal-state V14 cut-gem shell. Same medallion identity and round silhouette.
crystal_body=make_cut_disc("MorphMint_CrystalBody", CRYSTAL, segments=40)

bpy.ops.mesh.primitive_torus_add(
    major_radius=1.20, minor_radius=0.105,
    major_segments=40, minor_segments=10,
    location=(0,-0.245,0),
    rotation=(math.radians(90),0,0)
)
crystal_rim=bpy.context.object
crystal_rim.name="MorphMint_CrystalRim"
crystal_rim.data.materials.append(CRYSTAL)
crystal_rim.hide_render=True
for poly in crystal_rim.data.polygons:
    poly.use_smooth=False

# Separate crystal bar so ceramic/chrome geometry stays locked.
bpy.ops.mesh.primitive_cube_add(location=(0,-0.285,0))
crystal_bar=bpy.context.object
crystal_bar.name="MorphMint_CrystalIdentityBar"
crystal_bar.scale=(0.13,0.08,0.70)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
crystal_bar.data.materials.append(CRYSTAL)
crystal_bar.hide_render=True
crystal_bar_bevel=crystal_bar.modifiers.new("CrystalBarBevel","BEVEL")
crystal_bar_bevel.width=0.055
crystal_bar_bevel.segments=1

# Ground and backdrop
bpy.ops.mesh.primitive_plane_add(size=30, location=(0,2,-2.25))
floor=bpy.context.object
floor.name="MorphMint_Floor"
floor.data.materials.append(principled("FloorMat",(0.012,0.018,0.032,1),0.05,0.38))

bpy.ops.mesh.primitive_plane_add(size=18, location=(0,2.8,1.2), rotation=(math.radians(90),0,0))
back=bpy.context.object
back.name="Backdrop"
BACK_DARK=principled("BackdropDark",(0.006,0.012,0.028,1),0.0,0.48)
BACK_CRYSTAL=principled("BackdropCrystal",(0.010,0.028,0.075,1),0.0,0.58)
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

# V13: no explicit internal fracture geometry.
# Crystal readability comes from angular shell geometry + stronger facet normals.
fractures=[]
fracture_planes=[]

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
    for obj in fractures+fracture_planes:
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
    crystal_body.hide_render=not enabled
    crystal_rim.hide_render=not enabled
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
set_crystal_shell(False)
set_chrome_strips(False)
set_light_transmission_visibility(True)
set_backdrop(BACK_DARK)
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
set_crystal_shell(False)
set_chrome_strips(True)
set_light_transmission_visibility(True)
set_backdrop(BACK_DARK)
lights['Key'].data.energy=520
lights['Fill'].data.energy=360
lights['Rim'].data.energy=420
lights['Under'].data.energy=0
scene.render.filepath=str(OUT/"chrome.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"chrome.png"))

# Crystal: physical refraction without internal prop geometry.
scene.render.engine='CYCLES'
scene.cycles.samples=56
scene.cycles.use_denoising=True
scene.cycles.max_bounces=10
scene.cycles.transmission_bounces=10
scene.cycles.glossy_bounces=6
scene.cycles.diffuse_bounces=3
scene.view_settings.look='AgX - Medium High Contrast'
scene.world.color=(0.006,0.016,0.045)
set_material(CRYSTAL)
set_crystal_internals(False)
set_crystal_shell(True)
set_chrome_strips(False)
set_light_transmission_visibility(False)
set_backdrop(BACK_CRYSTAL)
# Crystal state: remove the floor from the render entirely so no large
# refracted polygon fragments can appear inside the transparent medallion.
floor.hide_render=True
lights['Key'].data.energy=540
lights['Fill'].data.energy=620
lights['Rim'].data.energy=1180
lights['Under'].data.energy=0
scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)
rendered.append(str(OUT/"crystal.png"))

result={
  "marker":"MORPHMINT_005_PUBLIC_REMOTE_3STATE_V16_PASS",
  "resolution":f"{W}x{H}",
  "renders":rendered,
  "crystal_engine":"CYCLES",
  "crystal_samples":56,
  "changes":[
    "removed all reflection-card geometry",
    "chrome uses three narrow area-strip highlights only",
    "removed radial shard and inner crystal ring structure",
    "crystal uses clean-center concentric cut-disc geometry with ring-only irregular facets, avoiding radial spoke artifacts"
  ],
  "note":"Visual QA stills only. Transition remains blocked until all three states pass."
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_PUBLIC_REMOTE_3STATE_V16_PASS")
