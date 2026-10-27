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
wood = material("Pale wood throat", (0.79, 0.59, 0.38), 0.76)
grip = material("Light wood handle", (0.84, 0.70, 0.53), 0.82)
inlay = material("Navy handle inlay", (0.018, 0.10, 0.27), 0.72)
ivory = material("Small ivory badge", (0.87, 0.83, 0.69), 0.65)

N = 48
# A representative Butterfly blade is 157 x 150 x 5.7 mm with a 100 x 25 mm
# flared handle. The model's 1.33-unit head length maps to 157 mm, making
# 0.048 units of wood 5.7 mm and the 0.082-unit covered blade about 9.7 mm.


def outline(scale=1.0):
    points = []
    for i in range(N):
        t = 2 * math.pi * i / N
        # A slightly broad crown and a subtly narrowed throat distinguish the
        # head from a generic sphere or perfect ellipse.
        x = 0.665 * math.cos(t) * scale
        z = 0.635 * math.sin(t) * (1 - 0.035 * math.cos(t)) * scale
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
ring_mesh("Laminated blade core", [(-0.024, 0.975), (-0.022, 1),
                                  (0.022, 1), (0.024, 0.975)], rim)
ring_mesh("Dark perimeter binding", [(-0.021, 1.009), (0.021, 1.009)], dark_edge)
ring_mesh("Black rubber bevel", [(-0.041, 0.925), (-0.037, 0.965)], black)
ring_mesh("Red rubber bevel", [(0.037, 0.965), (0.041, 0.925)], red)
ring_mesh("Front wood shoulder", [(-0.037, 0.965), (-0.024, 0.975)], rim)
ring_mesh("Rear wood shoulder", [(0.024, 0.975), (0.037, 0.965)], rim)
face_disc("Black playing face", -0.041, 0.925, black)
face_disc("Red playing face", 0.041, 0.925, red)


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


handle_section("Wood throat", [(.50, .064, .072), (.58, .078, .086),
                                (.74, .089, .097), (.86, .095, .103)], wood)
handle_section("Flared wood handle", [(.79, .091, .098), (.88, .098, .105),
                                      (1.22, .101, .106), (1.43, .102, .106),
                                      (1.48, .088, .094)], grip)
handle_section("Wood butt cap", [(1.475, .090, .095), (1.50, .090, .095),
                                 (1.515, .065, .072)], wood)

# A thin navy inset follows the handle's front. The light wood cheeks remain
# visible on both sides, like a real flared shakehand handle.
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.165, -.106, 0))
stripe = bpy.context.object
stripe.name = "Navy front handle inlay"
stripe.dimensions = (.59, .008, .054)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
stripe.data.materials.append(inlay)
stripe_bevel = stripe.modifiers.new("Rounded inlay edges", "BEVEL")
stripe_bevel.width = .008
stripe_bevel.segments = 2
stripe.modifiers.new("Weighted inlay normals", "WEIGHTED_NORMAL")

# A small badge on the visible throat provides a recognisable detail at game
# scale without adding a texture download or excessive geometry.
bpy.ops.mesh.primitive_cube_add(size=1, location=(.715, -.106, 0))
badge = bpy.context.object
badge.name = "Ivory throat badge"
badge.dimensions = (.075, .008, .06)
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
