"""通过独立 Blender 后台进程保留源模型，并导出游戏用两档细节模型。"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import bpy
from mathutils import Vector


@dataclass
class TextureInfo:
    name: str
    width: int
    height: int


@dataclass
class ModelInfo:
    objects: int
    triangles: int
    vertices: int
    materials: list[str]
    uv_layers: list[str]
    animations: list[str]
    textures: list[TextureInfo]
    dimensions: tuple[float, float, float]


@dataclass
class OutputInfo:
    path: str
    bytes: int
    target_triangles: int
    texture_limit: int
    model: ModelInfo


@dataclass
class ProductionReport:
    source: str
    blender_version: str
    normalized_blend: str
    height_metres: float
    source_model: ModelInfo
    desktop: OutputInfo
    mobile: OutputInfo
    previews: list[str]
    limitations: list[str]


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--name", default="panda")
    parser.add_argument("--height", type=float, default=2.1)
    parser.add_argument("--desktop-triangles", type=int, default=120000)
    parser.add_argument("--mobile-triangles", type=int, default=30000)
    parser.add_argument("--desktop-texture", type=int, default=2048)
    parser.add_argument("--mobile-texture", type=int, default=1024)
    parser.add_argument("--skip-previews", action="store_true")
    return parser.parse_args(argv)


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    if not corners:
        raise ValueError("源文件没有可导出的网格")
    return Vector(tuple(min(point[axis] for point in corners) for axis in range(3))), Vector(
        tuple(max(point[axis] for point in corners) for axis in range(3))
    )


def used_images(objects: list[bpy.types.Object]) -> list[bpy.types.Image]:
    images: list[bpy.types.Image] = []
    for obj in objects:
        for slot in obj.material_slots:
            material = slot.material
            if material and material.use_nodes:
                for node in material.node_tree.nodes:
                    if node.type == "TEX_IMAGE" and node.image and node.image not in images:
                        images.append(node.image)
    return images


def inspect(objects: list[bpy.types.Object]) -> ModelInfo:
    meshes = [obj for obj in objects if obj.type == "MESH"]
    low, high = bounds(objects)
    materials = sorted(
        {slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}
    )
    return ModelInfo(
        objects=len(meshes),
        triangles=sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes),
        vertices=sum(len(obj.data.vertices) for obj in meshes),
        materials=materials,
        uv_layers=sorted({layer.name for obj in meshes for layer in obj.data.uv_layers}),
        animations=sorted(action.name for action in bpy.data.actions),
        textures=[
            TextureInfo(image.name, image.size[0], image.size[1]) for image in used_images(meshes)
        ],
        dimensions=tuple(round(value, 5) for value in high - low),
    )


def normalize(objects: list[bpy.types.Object], height: float) -> None:
    low, high = bounds(objects)
    if not math.isfinite(high.z - low.z) or high.z <= low.z:
        raise ValueError("源模型高度无效")
    root = bpy.data.objects.new("PandaTown_Normalization", None)
    bpy.context.scene.collection.objects.link(root)
    for obj in [obj for obj in objects if obj.parent not in objects]:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world
    scale = height / (high.z - low.z)
    root.scale = (scale, scale, scale)
    root.location = (
        -(low.x + high.x) * 0.5 * scale,
        -(low.y + high.y) * 0.5 * scale,
        -low.z * scale,
    )
    objects.append(root)
    bpy.context.view_layer.update()


def simplify(objects: list[bpy.types.Object], target: int) -> None:
    total = inspect(objects).triangles
    ratio = min(1.0, target / max(total, 1))
    if ratio >= 1:
        return
    for obj in objects:
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new("PandaTown_LOD", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def resize_textures(objects: list[bpy.types.Object], limit: int) -> None:
    for image in used_images(objects):
        width, height = image.size
        if max(width, height) > limit:
            factor = limit / max(width, height)
            image.scale(max(1, round(width * factor)), max(1, round(height * factor)))
        image.pack()


def export(
    objects: list[bpy.types.Object], path: Path, target: int, texture_limit: int
) -> OutputInfo:
    simplify(objects, target)
    resize_textures(objects, texture_limit)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=True,
    )
    return OutputInfo(str(path), path.stat().st_size, target, texture_limit, inspect(objects))


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def previews(
    objects: list[bpy.types.Object], directory: Path, name: str, height: float
) -> list[str]:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Preview_Only_World")
    scene.world.color = (0.3, 0.34, 0.3)
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor = bpy.context.object
    floor.name = "Preview_Only_Floor"
    floor_material = bpy.data.materials.new("Preview_Only_Cream")
    floor_material.diffuse_color = (0.55, 0.58, 0.49, 1)
    floor.data.materials.append(floor_material)
    bpy.ops.object.light_add(type="AREA", location=(-height * 1.5, -height * 2, height * 3))
    key = bpy.context.object
    key.data.energy = 500
    key.data.shape = "DISK"
    key.data.size = height * 2
    look_at(key, Vector((0, 0, height * 0.6)))
    bpy.ops.object.light_add(type="AREA", location=(height * 2, height, height * 2))
    fill = bpy.context.object
    fill.data.energy = 220
    fill.data.size = height * 2
    look_at(fill, Vector((0, 0, height * 0.5)))
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = height * 1.5
    scene.camera = camera
    paths: list[str] = []
    for label, direction in [("front", -1), ("back", 1)]:
        camera.location = (height * 1.3, direction * height * 2.4, height * 1.25)
        look_at(camera, Vector((0, 0, height * 0.5)))
        path = directory / f"{name}-{label}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(str(path))
    return paths


def main() -> None:
    args = arguments()
    root = Path(__file__).resolve().parents[2]
    source = args.source.resolve(strict=True)
    if not source.is_relative_to(root):
        raise ValueError("源模型必须保存在当前项目内")
    if not args.name.replace("-", "").isalnum() or args.height <= 0:
        raise ValueError("模型名或高度无效")
    production = root / "docs" / "art" / "production" / "models"
    output = root / "public" / "models"
    production.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    blend = production / f"{args.name}-normalized.blend"
    report_path = production / f"{args.name}-report.json"
    desktop_path = output / f"{args.name}.glb"
    mobile_path = output / f"{args.name}-mobile.glb"
    for target in [blend, report_path, desktop_path, mobile_path]:
        if target.exists():
            raise FileExistsError(f"不覆盖现有产物：{target}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = list(bpy.context.scene.objects)
    source_info = inspect(objects)
    normalize(objects, args.height)
    for image in used_images(objects):
        image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    desktop = export(objects, desktop_path, args.desktop_triangles, args.desktop_texture)
    # 手机档从未经降面的规范化源重新生成，避免累积几何简化误差。
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    objects = list(bpy.context.scene.objects)
    mobile = export(objects, mobile_path, args.mobile_triangles, args.mobile_texture)
    preview_paths: list[str] = []
    limitations = [
        "自动降面和纹理缩放不等于视觉验收，需检查眼睛、耳朵、背包、接缝与轮廓。",
        "不自动生成骨骼或动画；源文件没有动画时需另行制作。",
        "许可依据来源账号计划与Tripo页面记录，不自动改为MIT。",
    ]
    if not args.skip_previews:
        try:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(desktop_path))
            preview_paths = previews(
                list(bpy.context.scene.objects), production, args.name, args.height
            )
        except RuntimeError as error:
            limitations.append(f"预览渲染未完成：{error}")
    report = ProductionReport(
        str(source),
        bpy.app.version_string,
        str(blend),
        args.height,
        source_info,
        desktop,
        mobile,
        preview_paths,
        limitations,
    )
    report_path.write_text(
        json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"PANDA_MODEL_REPORT={report_path}", flush=True)


if __name__ == "__main__":
    main()
