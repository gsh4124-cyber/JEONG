import pathlib

src = pathlib.Path('global_shorts_render_lab/github_public_runner/morphmint_reference_r0_stills.py')
code = src.read_text(encoding='utf-8')
code = code.replace("scene.render.engine = 'BLENDER_EEVEE_NEXT'", "scene.render.engine = 'BLENDER_EEVEE'")
exec(compile(code, str(src), 'exec'), {'__name__': '__main__', '__file__': str(src)})
