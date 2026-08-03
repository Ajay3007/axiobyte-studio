"""Runs INSIDE Blender. Builds a parametric asset and bakes it to an RGBA plate.

This file is a *script*, not a module — it is executed by ``blender --python`` and
imports ``bpy``, which only exists in that interpreter. Nothing in the Studio
imports it.

Assets are **parametric**: built from primitives by code rather than loaded from a
``.blend``. That keeps the whole 3D tier in version control as text, diffable and
reproducible, with no binary dependency and nothing to license. A board's dimensions
are numbers in this file, so re-baking at a new resolution or a new palette is a
re-run rather than a modelling session.

Invoked as::

    blender --background --python bake_plate.py -- --spec <json>
"""

from __future__ import annotations

import json
import math
import sys
from typing import Any

import bpy


def argv() -> dict[str, Any]:
    """The bake spec, passed after Blender's own ``--`` separator."""
    raw = sys.argv[sys.argv.index("--") + 1 :]
    return json.loads(raw[raw.index("--spec") + 1])


def clear() -> None:
    """Empty the default scene."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def material(name: str, colour: str, roughness: float, metallic: float = 0.0) -> Any:
    """A principled material in a role's colour.

    Lighting and materials both come from the design tokens, so a baked plate sits
    in the same palette as everything drawn around it. A plate lit to its own taste
    is a plate that always looks pasted on.
    """
    rgb = [int(colour[i : i + 2], 16) / 255.0 for i in (1, 3, 5)]
    # sRGB to linear: Blender works in linear, tokens are authored display-referred.
    linear = [((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in rgb]

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*linear, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def slab(name: str, size: tuple[float, float, float], at: tuple[float, float, float], mat: Any):
    """One box, scaled and placed."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=at)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth() if False else None
    return obj


def build_nic_board(palette: dict[str, str]) -> None:
    """A network card: PCB, controller die, heatsink fins, edge connector, ports.

    Proportions are a real low-profile NIC's, roughly 167 x 69 mm, which is what
    makes it read as a card rather than a generic slab.
    """
    pcb = material("pcb", palette["nic"], roughness=0.62)
    chip = material("chip", palette["cpu"], roughness=0.40, metallic=0.10)
    # Highly metallic surfaces render black without an environment to reflect,
    # which is what made the fins and ports read as holes in the first bake.
    metal = material("metal", palette["idle"], roughness=0.42, metallic=0.35)
    gold = material("gold", palette["pointer"], roughness=0.34, metallic=0.45)

    slab("pcb", (3.34, 1.38, 0.05), (0.0, 0.0, 0.0), pcb)
    slab("die", (0.62, 0.62, 0.12), (0.35, 0.05, 0.08), chip)
    for index in range(7):
        slab("fin", (0.52, 0.05, 0.22), (0.35, -0.30 + index * 0.10, 0.20), metal)
    slab("edge", (1.30, 0.16, 0.06), (-0.55, -0.75, -0.02), gold)
    for index in range(2):
        slab("port", (0.30, 0.34, 0.30), (1.30, -0.35 + index * 0.62, 0.14), metal)


#: Parametric assets, by id. Adding one is a function, not a modelling session.
ASSETS = {"nic_board": build_nic_board}


def _aim(obj: Any, distance: float, elevation: float, azimuth: float) -> None:
    """Place something on a sphere around the origin, pointing inward.

    Cameras and lights use the SAME formula. They did not at first, and the lights
    ended up aimed at nothing — which is why the first bake looked flat with
    near-black metal. One placement helper, used by both, is the fix.
    """
    e, a = math.radians(elevation), math.radians(azimuth)
    obj.location = (
        distance * math.cos(e) * math.sin(a),
        -distance * math.cos(e) * math.cos(a),
        distance * math.sin(e),
    )
    obj.rotation_euler = (math.pi / 2 - e, 0.0, a)


def light_rig(lighting: dict[str, str]) -> None:
    """Key, fill and rim — keyed from the upper left, matching the isometric tier.

    Tier 1 lights from the upper left because a catalogue whose light direction
    wanders looks assembled by several people. Tier 2 has to agree, or a baked
    plate reads as belonging to a different film.

    Fill and rim take their colour from the palette, so a plate is lit by the same
    system that draws everything around it.
    """
    for name, distance, elevation, azimuth, energy in (
        # Energies are for an area light 9 m out. They were raised eightfold at one
        # point to compensate for lights that were aimed at nothing; once _aim was
        # shared with the camera the same numbers blew the plate out completely.
        ("key", 9.0, 52.0, -42.0, 700.0),
        ("fill", 9.0, 16.0, 58.0, 180.0),
        ("rim", 9.0, 34.0, 170.0, 380.0),
    ):
        colour = lighting[name]
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.size = 7.0
        data.color = [int(colour[i : i + 2], 16) / 255.0 for i in (1, 3, 5)]
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
        _aim(obj, distance, elevation, azimuth)


def camera(distance: float, elevation: float, azimuth: float) -> Any:
    """An orbiting camera, always aimed at the origin."""
    data = bpy.data.cameras.new("camera")
    data.lens = 62.0
    obj = bpy.data.objects.new("camera", data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj

    _aim(obj, distance, elevation, azimuth)
    return obj


def main() -> None:
    """Build, light, and bake every frame of the requested camera move."""
    spec = argv()
    palette = spec["palette"]

    clear()
    ASSETS[spec["asset"]](palette)
    light_rig(spec["lighting"])

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = spec["width"]
    scene.render.resolution_y = spec["height"]
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    # A faint world: metals reflect it rather than reflecting nothing. It does not
    # light the scene — film_transparent keeps it out of the alpha.
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    ambient = spec["lighting"]["ambient"]
    rgb = [int(ambient[i : i + 2], 16) / 255.0 for i in (1, 3, 5)]
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*rgb, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    scene.world = world

    frames = int(spec["frames"])
    move = spec["move"]
    for index in range(frames):
        t = index / max(frames - 1, 1)
        if move == "turntable":
            cam = camera(spec["distance"], spec["elevation"], 360.0 * t)
        elif move == "push_in":
            cam = camera(spec["distance"] * (1.0 - 0.35 * t), spec["elevation"], spec["azimuth"])
        else:  # still
            cam = camera(spec["distance"], spec["elevation"], spec["azimuth"])

        scene.render.filepath = f"{spec['out']}/frame_{index:04d}"
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam, do_unlink=True)

    print(f"BAKED {frames}")


main()
