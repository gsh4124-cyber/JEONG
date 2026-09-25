import bpy, math, pathlib, json, base64, bmesh
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[2]
ASSET=ROOT/"global_shorts_render_lab"/"assets"/"third_party"/"raysect_diamond.obj"
OUT=pathlib.Path("render_output/morphmint_005_crystal_authored_c2")
OUT.mkdir(parents=True,exist_ok=True)
W,H=540,960

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.resolution_x=W
scene.render.resolution_y=H
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.render.engine="CYCLES"
scene.cycles.samples=144
scene.cycles.use_denoising=True
scene.cycles.max_bounces=12
scene.cycles.transmission_bounces=12
scene.cycles.glossy_bounces=8
scene.cycles.diffuse_bounces=3
scene.view_settings.look="AgX - Medium High Contrast"

# C2: preserve the donor's authored face connectivity, but remap its footprint
# into MorphMint's canonical round disc. This is not a whole-gem squash and not
# a procedural facet overlay: authored topology stays, envelope becomes canonical.
src_v=[]
src_f=[]
for raw in ASSET.read_text(encoding="utf-8").splitlines():
    line=raw.strip()
    if line.startswith("v "):
        p=line.split()
        src_v.append((float(p[1]),float(p[2]),float(p[3])))
    elif line.startswith("f "):
        ids=[]
        for tok in line.split()[1:]:
            ids.append(int(tok.split("/")[0])-1)
        if len(ids)>=3:
            src_f.append(ids)
if not src_v or not src_f:
    raise RuntimeError("Raysect donor parse failed")

xs=[v[0] for v in src_v]
ys=[v[1] for v in src_v]
zs=[v[2] for v in src_v]
cx=(min(xs)+max(xs))*0.5
cy=(min(ys)+max(ys))*0.5
cz=(min(zs)+max(zs))*0.5
rmax=max(math.hypot(x-cx,y-cy) for x,y,_ in src_v)
zhalf=max((max(zs)-min(zs))*0.5,1e-6)
R=1.52
HALF_T=0.29

dst_v=[]
for x,y,z in src_v:
    dx=x-cx
    dy=y-cy
    rho=min(1.0,max(0.0,math.hypot(dx,dy)/rmax))
    theta=math.atan2(dy,dx)
    # Preserve authored radial hierarchy while pulling the outer zone toward
    # a common circular envelope so the same-object MorphMint silhouette holds.
    if rho>0.62:
        rho2=0.62+(rho-0.62)*(0.38/(1.0-0.62))
        rho2=0.78+0.22*((rho2-0.62)/0.38)
    else:
        rho2=(rho/0.62)*0.78
    rr=R*min(1.0,max(0.0,rho2))
    zn=max(-1.0,min(1.0,(z-cz)/zhalf))
    taper=0.28+0.72*(1.0-rho**1.55)
    depth=HALF_T*zn*taper
    dst_v.append((rr*math.cos(theta),depth,rr*math.sin(theta)))

mesh=bpy.data.meshes.new("MM_C2_AuthoredFacetDiscMesh")
mesh.from_pydata(dst_v,[],src_f)
mesh.update()
gem=bpy.data.objects.new("MorphMint_C2_AuthoredFacetDisc",mesh)
bpy.context.collection.objects.link(gem)

bm=bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
for p in mesh.polygons:
    p.use_smooth=False

def crystal_mat():
    m=bpy.data.materials.new("MM_C2_ClearCrystal")
    m.use_nodes=True
    nt=m.node_tree
    nt.nodes.clear()
    out=nt.nodes.new("ShaderNodeOutputMaterial")
    glass=nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["Color"].default_value=(0.995,0.998,1.0,1)
    glass.inputs["Roughness"].default_value=0.012
    glass.inputs["IOR"].default_value=1.545
    nt.links.new(glass.outputs["BSDF"],out.inputs["Surface"])
    return m
gem.data.materials.append(crystal_mat())

# MorphMint identity stays integrated in the canonical object face.
m=bpy.data.materials.new("MM_C2_IdentityFrost")
m.use_nodes=True
bs=m.node_tree.nodes.get("Principled BSDF")
bs.inputs["Base Color"].default_value=(0.68,0.90,1.0,1)
bs.inputs["Roughness"].default_value=0.16
if "Transmission Weight" in bs.inputs:
    bs.inputs["Transmission Weight"].default_value=0.58
if "IOR" in bs.inputs:
    bs.inputs["IOR"].default_value=1.46

bpy.ops.mesh.primitive_cube_add(location=(0,-0.305,0))
bar=bpy.context.object
bar.name="MorphMint_C2_IdentityBar"
bar.scale=(0.115,0.018,0.64)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bar.data.materials.append(m)
bev=bar.modifiers.new("IdentityBarBevel","BEVEL")
bev.width=0.032
bev.segments=3

def principled(name,color,rough):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    b=mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=color
    b.inputs["Roughness"].default_value=rough
    return mat

bpy.ops.mesh.primitive_plane_add(size=30,location=(0,2,-2.18))
floor=bpy.context.object
floor.data.materials.append(principled("C2_Floor",(0.012,0.018,0.032,1),0.32))
bpy.ops.mesh.primitive_plane_add(size=18,location=(0,3.0,1.0),rotation=(math.radians(90),0,0))
back=bpy.context.object
back.data.materials.append(principled("C2_Backdrop",(0.018,0.028,0.048,1),0.46))

world=scene.world
world.use_nodes=True
nt=world.node_tree
nt.nodes.clear()
wo=nt.nodes.new("ShaderNodeOutputWorld")
bg=nt.nodes.new("ShaderNodeBackground")
bg.inputs["Color"].default_value=(0.10,0.14,0.21,1)
bg.inputs["Strength"].default_value=0.60
nt.links.new(bg.outputs["Background"],wo.inputs["Surface"])

def area(name,loc,energy,size,color,rect=None):
    bpy.ops.object.light_add(type="AREA",location=loc)
    l=bpy.context.object
    l.name=name
    l.data.energy=energy
    l.data.color=color
    if rect:
        l.data.shape="RECTANGLE"
        l.data.size=rect[0]
        l.data.size_y=rect[1]
    else:
        l.data.size=size
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat("-Z","Y").to_euler()
    return l

area("C2_Key",(-3.8,-4.8,4.5),1200,4.8,(1.0,0.96,0.90))
area("C2_Fill",(4.4,-3.7,1.4),820,4.0,(0.72,0.88,1.0))
area("C2_Top",(0.0,-0.5,5.6),1050,2.8,(0.86,0.95,1.0))
area("C2_StripL",(-4.6,-1.5,0.0),520,1.0,(0.74,0.90,1.0),rect=(0.28,3.8))
area("C2_StripR",(4.6,-1.3,0.6),440,1.0,(1.0,0.90,0.76),rect=(0.24,3.5))

bpy.ops.object.camera_add(location=(0.38,-10.6,0.30))
cam=bpy.context.object
cam.name="MorphMint_C2_Camera"
cam.data.lens=72
target=Vector((0,0,0.02))
cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
scene.camera=cam

scene.render.filepath=str(OUT/"crystal.png")
bpy.ops.render.render(write_still=True)

img=bpy.data.images.load(str(OUT/"crystal.png"),check_existing=False)
img.scale(270,480)
img.filepath_raw=str(OUT/"crystal_preview.png")
img.file_format="PNG"
img.save()
(OUT/"crystal_preview.b64").write_text(base64.b64encode((OUT/"crystal_preview.png").read_bytes()).decode("ascii"),encoding="ascii")

result={
    "marker":"MORPHMINT_005_CRYSTAL_AUTHORED_C2_RENDER_PASS",
    "asset":"morphmint_material_shift_005",
    "stage":"CRYSTAL_STILL_GRAMMAR_QA",
    "construction_method":"AUTHORED_FACET_TOPOLOGY_POLAR_DISC_REMAP",
    "donor":{"repository":"raysect/source","path":"demos/resources/diamond.obj","blob_sha":"1d36d81a2f2b89949f342a69a535ce82ae736cfa","license":"BSD-3-Clause"},
    "preserved":"donor face connectivity / facet adjacency",
    "canonicalized":"MorphMint round footprint and lens depth envelope",
    "resolution":f"{W}x{H}",
    "engine":"CYCLES",
    "samples":144,
    "ceramic":"PASS_LOCKED_UNTOUCHED",
    "chrome":"PASS_LOCKED_UNTOUCHED",
    "quality_gate_90":"PENDING_AI_VISUAL_QA",
    "transition_gate":"BLOCKED_UNTIL_CRYSTAL_QUALITY_90"
}
(OUT/"result.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print("MORPHMINT_005_CRYSTAL_AUTHORED_C2_RENDER_PASS")
