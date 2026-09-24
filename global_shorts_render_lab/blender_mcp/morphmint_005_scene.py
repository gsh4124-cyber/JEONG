import bpy, math, os
from mathutils import Vector

W,H,FPS=1080,1920,30

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=W
scene.render.resolution_y=H
scene.render.resolution_percentage=100
scene.render.fps=FPS
scene.frame_start=1
scene.frame_end=240
scene.world.color=(0.004,0.006,0.012)

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

CERAMIC=principled("MM_Ceramic",(0.65,0.09,0.025,1),0.0,0.46)
CHROME=principled("MM_Chrome",(0.65,0.72,0.82,1),1.0,0.12)
CRYSTAL=principled("MM_Crystal",(0.05,0.32,0.95,1),0.0,0.08,1.0,1.46)

bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.55, depth=0.34, location=(0,0,0))
body=bpy.context.object
body.name="MorphMint_Body"
body.rotation_euler=(math.radians(90),0,0)
body.data.materials.append(CERAMIC)

bevel=body.modifiers.new("BodyBevel","BEVEL")
bevel.width=0.08
bevel.segments=5
bpy.ops.object.shade_smooth()

bpy.ops.mesh.primitive_torus_add(major_radius=1.20,minor_radius=0.10,major_segments=128,minor_segments=24,location=(0,-0.20,0),rotation=(math.radians(90),0,0))
rim=bpy.context.object
rim.name="MorphMint_Rim"
rim.data.materials.append(CERAMIC)

bpy.ops.mesh.primitive_cube_add(location=(0,-0.24,0))
bar=bpy.context.object
bar.name="MorphMint_IdentityBar"
bar.scale=(0.12,0.07,0.70)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bar.data.materials.append(CERAMIC)
bev=bar.modifiers.new("BarBevel","BEVEL")
bev.width=0.05
bev.segments=4

# floor
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,2,-2.25))
floor=bpy.context.object
floor.name="MorphMint_Floor"
floor_mat=principled("FloorMat",(0.012,0.016,0.028,1),0.15,0.28)
floor.data.materials.append(floor_mat)

# lights
for loc,energy,size,color,name in [
    ((-3.5,-4.0,5.0),1700,4.5,(1.0,0.56,0.35),"Key"),
    ((3.8,-3.0,1.5),1300,4.0,(0.28,0.52,1.0),"Fill"),
    ((0,2.0,5.2),1100,3.0,(0.55,0.85,1.0),"Rim")
]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object
    l.name=name
    l.data.energy=energy
    l.data.size=size
    l.data.color=color
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()

# camera vertical hero framing
bpy.ops.object.camera_add(location=(0,-10.5,0.5))
cam=bpy.context.object
cam.name="MorphMint_Camera"
cam.data.lens=62
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.camera=cam

# subtle camera push payoff
cam.location.y=-10.5
cam.keyframe_insert(data_path="location",frame=1)
cam.location.y=-9.5
cam.keyframe_insert(data_path="location",frame=240)

# basic material state keys as placeholders for MCP refinement
# 1-70 ceramic, 71-150 chrome takeover, 151-240 crystal growth
for obj in (body,rim,bar):
    obj["morphmint_states"]="ceramic->chrome->crystal"

out=os.environ.get("GS_BLEND_OUT", os.path.join(os.path.expanduser("~"),"GlobalShorts","blender"))
os.makedirs(out,exist_ok=True)
path=os.path.join(out,"MorphMint_005_base.blend")
bpy.ops.wm.save_as_mainfile(filepath=path)
print("MORPHMINT_005_BASE_SCENE_READY")
print(path)
