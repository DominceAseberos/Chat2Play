"""Refresh studio previews from the saved editable sources without rebuilding them."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
for character in ['female','male']:
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets/characters/source'/f'{character}.blend'))
    scene=bpy.context.scene;camera=scene.camera
    scene.cycles.samples=16;scene.render.threads_mode='AUTO'
    for view,location in [('front',(0,-8,2.65)),('side',(8,0,2.65)),('three-quarter',(4,-7,3.1)),('back',(0,8,2.65))]:
        output=root/'assets/characters/previews'/f'{character}-{view}.png'
        if output.exists() and output.stat().st_mtime>=(root/'assets/characters/source'/f'{character}.blend').stat().st_mtime:continue
        camera.location=location;camera.rotation_euler=(Vector((0,0,1.60))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(output)
        bpy.ops.render.render(write_still=True)
