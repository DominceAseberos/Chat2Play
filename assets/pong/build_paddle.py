"""Build the low-poly Chat2Play table-tennis paddle in Blender.

Blender uses Z up. The paddle lies in Blender's XZ plane so the exported GLB
faces the near-end camera after glTF's coordinate conversion.
"""
import bpy
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "pong" / "paddle.blend"
EXPORT = ROOT / "public" / "models" / "pong" / "paddle.glb"
EXPORT.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=0.75, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    mat.diffuse_color = (*color, 1)
    return mat


black = material("Matte charcoal rubber", (0.045, 0.065, 0.082), 0.92)
red = material("Crimson rubber", (0.68, 0.035, 0.057), 0.91)
rim = material("Warm laminated edge", (0.61, 0.38, 0.19), 0.73)
dark_edge = material("Dark edge binding", (0.105, 0.075, 0.063), 0.77)
wood = material("Pale wood throat", (0.78, 0.53, 0.28), 0.76)
grip = material("Teal grip", (0.012, 0.30, 0.27), 0.88)
grip_band = material("Grip seam", (0.007, 0.19, 0.18), 0.96)
ivory = material("Small ivory badge", (0.87, 0.83, 0.69), 0.65)

N = 48


def outline(scale=1.0):
    points = []
    for i in range(N):
        t = 2 * math.pi * i / N
        # A slightly broad crown and a subtly narrowed throat distinguish the
        # head from a generic sphere or perfect ellipse.
        x = 0.665 * math.cos(t) * scale
        z = 0.555 * math.sin(t) * (1 - 0.055 * math.cos(t)) * scale
        points.append((x, z))
    return points


def ring_mesh(name, rings, mat):
    verts = [(x, depth, z) for depth, scale in rings for x, z in outline(scale)]
    faces = []
    for row in range(len(rings) - 1):
        for i in range(N):
            nxt = (i + 1) % N
            a = row * N + i
            b = row * N + nxt
            c = (row + 1) * N + nxt
            d = (row + 1) * N + i
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def face_disc(name, depth, scale, mat):
    points = outline(scale)
    verts = [(0, depth, 0)] + [(x, depth, z) for x, z in points]
    front = depth < 0
    faces = []
    for i in range(N):
        a, b = i + 1, (i + 1) % N + 1
        faces.append((0, a, b) if front else (0, b, a))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


# Wood core, dark binding, and inset rubber sheets. Every face is geometry,
# including the colored edge visible when the bat turns during a swing.
ring_mesh("Laminated blade core", [(-0.066, 0.96), (-0.048, 1),
                                  (0.048, 1), (0.066, 0.96)], rim)
ring_mesh("Dark perimeter binding", [(-0.054, 1.012), (0.054, 1.012)], dark_edge)
ring_mesh("Black rubber bevel", [(-0.088, 0.925), (-0.075, 0.965)], black)
ring_mesh("Red rubber bevel", [(0.075, 0.965), (0.088, 0.925)], red)
face_disc("Black playing face", -0.089, 0.925, black)
face_disc("Red playing face", 0.089, 0.925, red)


def handle_section(name, stations, mat, sides=16):
    verts = []
    for x, radius_y, radius_z in stations:
        for i in range(sides):
            a = 2 * math.pi * i / sides
            verts.append((x, radius_y * math.cos(a), radius_z * math.sin(a)))
    faces = []
    faces.append(tuple(reversed(range(sides))))
    for row in range(len(stations) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((row * sides + i, row * sides + j,
                          (row + 1) * sides + j, (row + 1) * sides + i))
    faces.append(tuple((len(stations) - 1) * sides + i for i in range(sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


handle_section("Wood throat", [(.50, .085, .09), (.58, .10, .115),
                                (.74, .115, .14), (.88, .12, .145)], wood)
handle_section("Shaped teal handle", [(.79, .118, .143), (.86, .135, .15),
                                      (1.17, .14, .155), (1.37, .125, .14),
                                      (1.42, .10, .12)], grip)
for at in (.93, 1.05, 1.17, 1.29):
    handle_section(f"Grip band {at:.2f}", [(at, .142, .158),
                                           (at + .014, .142, .158)], grip_band)
handle_section("Wood butt cap", [(1.40, .105, .12), (1.44, .105, .12),
                                 (1.47, .075, .09)], wood)

# A small badge on the visible throat provides a recognisable detail at game
# scale without adding a texture download or excessive geometry.
bpy.ops.mesh.primitive_cube_add(size=1, location=(.715, -.143, 0))
badge = bpy.context.object
badge.name = "Ivory throat badge"
badge.dimensions = (.095, .012, .072)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
badge.data.materials.append(ivory)
bevel = badge.modifiers.new("Soft badge corners", "BEVEL")
bevel.width = .012
bevel.segments = 2
badge.modifiers.new("Weighted badge normals", "WEIGHTED_NORMAL")

# Neutral world setup makes the .blend convenient to inspect and refine.
world = bpy.data.worlds.new("Paddle preview world")
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (.15, .17, .20, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = .8

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(EXPORT), export_format="GLB",
                          export_apply=True)
print(f"Saved Blender source: {SOURCE}")
print(f"Exported game model: {EXPORT}")
