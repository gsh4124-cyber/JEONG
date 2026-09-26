import pathlib

src = pathlib.Path('global_shorts_render_lab/github_public_runner/morphmint_reference_r0_stills.py')
code = src.read_text(encoding='utf-8')

# R2: keep approved object/camera; improve shared facet grammar + chrome brightness + crystal gem read.
code = code.replace("render_output/morphmint_reference_r0", "render_output/morphmint_reference_r2")
code = code.replace("scene.render.engine = 'BLENDER_EEVEE_NEXT'", "scene.render.engine = 'CYCLES'\nscene.cycles.samples = 36\nscene.cycles.use_denoising = True\nscene.cycles.max_bounces = 9\nscene.cycles.transmission_bounces = 7\nscene.cycles.glossy_bounces = 5\nscene.cycles.transparent_max_bounces = 7")
code = code.replace("scene.world.color = (0.003, 0.006, 0.014)", "scene.world.color = (0.018, 0.028, 0.060)")

# Ceramic: less plastic, more premium glazed ceramic.
code = code.replace("set_input(bs, 'Roughness', 0.27)", "set_input(bs, 'Roughness', 0.34)")
code = code.replace("set_input(bs, 'Coat Weight', 0.32)", "set_input(bs, 'Coat Weight', 0.20)")
code = code.replace("set_input(bs, 'Coat Roughness', 0.12)", "set_input(bs, 'Coat Roughness', 0.16)")

# Chrome: cleaner, brighter mirror read.
code = code.replace("set_input(bs, 'Base Color', (0.72, 0.77, 0.84, 1.0))", "set_input(bs, 'Base Color', (0.90, 0.94, 1.0, 1.0))")
code = code.replace("set_input(bs, 'Roughness', 0.065)", "set_input(bs, 'Roughness', 0.045)")

# Crystal: clear body, saturated faceted crown.
code = code.replace("set_input(bs, 'Base Color', (0.80, 0.94, 1.0, 1.0))", "set_input(bs, 'Base Color', (0.82, 0.95, 1.0, 1.0))")
code = code.replace("set_input(bs, 'Roughness', 0.025)", "set_input(bs, 'Roughness', 0.020)")
code = code.replace("CRYSTAL = make_crystal('MM_Crystal_Clear', 0.016)", "CRYSTAL = make_crystal('MM_Crystal_Clear', 0.0020)")
code = code.replace("CRYSTAL_EDGE = make_crystal('MM_Crystal_Edge', 0.028)", "CRYSTAL_EDGE = make_crystal('MM_Crystal_Edge', 0.0050)\nCRYSTAL_FACET = make_crystal('MM_Crystal_Facet', 0.0120)\n_cf = CRYSTAL_FACET.node_tree.nodes.get('Principled BSDF')\nset_input(_cf, 'Base Color', (0.20, 0.63, 1.0, 1.0))\nset_input(_cf, 'Transmission Weight', 0.72)\nset_input(_cf, 'Roughness', 0.055)\nset_input(_cf, 'Coat Weight', 0.22)")
code = code.replace("obj.data.materials.append(CRYSTAL_EDGE)\n    for p in obj.data.polygons:", "obj.data.materials.append(CRYSTAL_FACET)\n    for p in obj.data.polygons:")

# Shared faceted face = same object grammar across all materials.
code = code.replace("if state == 'ceramic':\n        assign_all(CERAMIC)", "if state == 'ceramic':\n        assign_all(CERAMIC)\n        facet_crown.hide_render = False\n        facet_crown.data.materials[0] = CERAMIC")
code = code.replace("elif state == 'chrome':\n        assign_all(CHROME)", "elif state == 'chrome':\n        assign_all(CHROME)\n        facet_crown.hide_render = False\n        facet_crown.data.materials[0] = CHROME")
code = code.replace("body.data.materials[0] = CRYSTAL\n        facet_crown.hide_render = False", "body.data.materials[0] = CRYSTAL\n        facet_crown.hide_render = False\n        facet_crown.data.materials[0] = CRYSTAL_FACET")

# Stronger but broader jewelry lighting.
code = code.replace("fill.data.energy = 420", "fill.data.energy = 560")
code = code.replace("rim.data.energy = 560", "rim.data.energy = 720")
code = code.replace("fill.data.energy = 980", "fill.data.energy = 1450")
code = code.replace("rim.data.energy = 1250", "rim.data.energy = 1750")
code = code.replace("fill.data.energy = 1150", "fill.data.energy = 1750")
code = code.replace("rim.data.energy = 1700", "rim.data.energy = 2550")
code = code.replace("under.data.energy = 480", "under.data.energy = 720")

code = code.replace("MORPHMINT_APPROVED_REFERENCE_R0_STILLS_PASS", "MORPHMINT_APPROVED_REFERENCE_R2_STILLS_PASS")
code = code.replace("full_video_gate': 'BLOCKED_UNTIL_3_STILLS_VISUALLY_PASS'", "full_video_gate': 'BLOCKED_UNTIL_R2_3_STILLS_VISUALLY_PASS'")

exec(compile(code, str(src), 'exec'), {'__name__': '__main__', '__file__': str(src)})
