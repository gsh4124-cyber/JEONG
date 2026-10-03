import pathlib

src = pathlib.Path('global_shorts_render_lab/github_public_runner/morphmint_reference_r0_stills.py')
code = src.read_text(encoding='utf-8')

# R1 keeps the approved geometry/camera and changes only the optical/render subsystem.
code = code.replace("render_output/morphmint_reference_r0", "render_output/morphmint_reference_r1")
code = code.replace("scene.render.engine = 'BLENDER_EEVEE_NEXT'", "scene.render.engine = 'CYCLES'\nscene.cycles.samples = 48\nscene.cycles.use_denoising = True\nscene.cycles.max_bounces = 10\nscene.cycles.transmission_bounces = 8\nscene.cycles.glossy_bounces = 5\nscene.cycles.transparent_max_bounces = 8")
code = code.replace("scene.world.color = (0.003, 0.006, 0.014)", "scene.world.color = (0.010, 0.018, 0.040)")

# Clearer premium crystal: very light absorption, nearly neutral transmission.
code = code.replace("set_input(bs, 'Base Color', (0.80, 0.94, 1.0, 1.0))", "set_input(bs, 'Base Color', (0.93, 0.985, 1.0, 1.0))")
code = code.replace("set_input(bs, 'Roughness', 0.025)", "set_input(bs, 'Roughness', 0.012)")
code = code.replace("CRYSTAL = make_crystal('MM_Crystal_Clear', 0.016)", "CRYSTAL = make_crystal('MM_Crystal_Clear', 0.0025)")
code = code.replace("CRYSTAL_EDGE = make_crystal('MM_Crystal_Edge', 0.028)", "CRYSTAL_EDGE = make_crystal('MM_Crystal_Edge', 0.0045)")

# Jewelry-lighting uplift without changing camera or object identity.
code = code.replace("fill.data.energy = 980", "fill.data.energy = 1250")
code = code.replace("rim.data.energy = 1250", "rim.data.energy = 1650")
code = code.replace("fill.data.energy = 1150", "fill.data.energy = 1650")
code = code.replace("rim.data.energy = 1700", "rim.data.energy = 2450")
code = code.replace("under.data.energy = 480", "under.data.energy = 650")

# Keep result identity distinct.
code = code.replace("MORPHMINT_APPROVED_REFERENCE_R0_STILLS_PASS", "MORPHMINT_APPROVED_REFERENCE_R1_STILLS_PASS")
code = code.replace("full_video_gate': 'BLOCKED_UNTIL_3_STILLS_VISUALLY_PASS'", "full_video_gate': 'BLOCKED_UNTIL_R1_3_STILLS_VISUALLY_PASS'")

exec(compile(code, str(src), 'exec'), {'__name__': '__main__', '__file__': str(src)})
