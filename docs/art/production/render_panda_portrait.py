"""在隔离Blender后台从实际游戏GLB渲染透明半身头像，不保存或修改原模型。"""

from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


@dataclass(frozen=True, slots=True)
class PortraitRender:
    source: str
    source_sha256: str
    output: str
    blender_version: str
    engine: str
    samples: int
    frame: int
    resolution: int
    transparent: bool
    camera_location: tuple[float, float, float]
    camera_target: tuple[float, float, float]
    orthographic_scale: float


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "public" / "models" / "panda-rigged-v2.glb"
OUTPUT = ROOT / "docs" / "art" / "production" / "panda-portrait.png"
REPORT = OUTPUT.with_suffix(".json")


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def area_light(location: Vector, target: Vector, energy: float, size: float) -> None:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    assert light is not None and isinstance(light.data, bpy.types.AreaLight)
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, target)


def main() -> None:
    if OUTPUT.exists() or REPORT.exists():
        raise FileExistsError("禁止覆盖已存在的头像渲染产物")
    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    scene = bpy.context.scene
    scene.frame_set(1)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points: list[Vector] = []
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        evaluated_mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in evaluated_mesh.vertices)
        evaluated.to_mesh_clear()
    if not points:
        raise ValueError("源GLB没有可渲染网格")
    low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    height = high.z - low.z
    if height <= 0:
        raise ValueError("角色高度不合法")
    portrait_height = height * 0.42
    target = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, high.z - portrait_height * 0.42))
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = 0.02
    scene.render.resolution_x = scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 20
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0.15
    scene.world = bpy.data.worlds.new("PortraitOnlyWorld")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background is None:
        raise RuntimeError("无法创建环境照明")
    background.inputs["Color"].default_value = (0.8, 0.84, 0.88, 1)
    background.inputs["Strength"].default_value = 0.55
    area_light(target + Vector((-height * 1.5, -height * 2, height * 1.5)),
               target, 450, height * 2)
    area_light(target + Vector((height * 1.6, -height, height * 0.7)),
               target, 200, height * 1.8)
    bpy.ops.object.camera_add(location=target + Vector((height * 0.9, -height * 2.7, height * 0.08)))
    camera = bpy.context.object
    assert camera is not None and isinstance(camera.data, bpy.types.Camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = portrait_height
    look_at(camera, target)
    scene.camera = camera
    scene.render.filepath = str(OUTPUT)
    bpy.ops.render.render(write_still=True)
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != digest:
        raise RuntimeError("源模型在渲染期间发生变化")
    report = PortraitRender(
        SOURCE.relative_to(ROOT).as_posix(), digest, OUTPUT.relative_to(ROOT).as_posix(),
        bpy.app.version_string, scene.render.engine, scene.cycles.samples, scene.frame_current,
        1024, True, tuple(camera.location), tuple(target), camera.data.ortho_scale,
    )
    REPORT.write_text(json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8")
    print("PORTRAIT_RENDERED", str(OUTPUT), flush=True)


if __name__ == "__main__":
    main()
