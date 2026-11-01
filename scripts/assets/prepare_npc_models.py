"""只读 Downloads 原件，以两个独立 Blender 后台队列加工居民双档模型。"""

from __future__ import annotations

import argparse
from array import array
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
from itertools import islice
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_model import bounds, inspect, look_at, normalize, simplify, used_images


@dataclass(frozen=True)
class Resident:
    number: int
    stem: str
    label: str
    filename: str
    height: float


@dataclass
class TextureRecord:
    name: str
    width: int
    height: int
    channels: int
    color_space: str
    role: str
    file_format: str


@dataclass
class MeshRecord:
    triangles: int
    vertices: int
    mesh_objects: int
    dimensions: tuple[float, float, float]
    minimum: tuple[float, float, float]
    maximum: tuple[float, float, float]
    uv_layers: list[str]
    materials: list[str]
    textures: list[TextureRecord]
    armatures: int
    joints: int
    animations: list[str]


@dataclass
class SourceReceipt:
    path: str
    bytes: int
    sha256: str
    modified_utc: str
    inspected_utc: str
    model: MeshRecord


@dataclass
class LodRecord:
    path: str
    bytes: int
    sha256: str
    triangle_target: int
    texture_limit: int
    normal_texture_limit: int
    model: MeshRecord
    previews: list[str]


@dataclass
class ResidentReport:
    resident: Resident
    blender: str
    source: SourceReceipt
    desktop: LodRecord
    mobile: LodRecord
    coordinate_convention: str
    limitations: list[str]


RESIDENTS = [
    Resident(1, "01_bakery_rabbit", "面包师兔", "bunny chef 3d model.glb", 1.65),
    Resident(2, "02_grocery_beaver", "木材商河狸", "furry beaver 3d model.glb", 1.75),
    Resident(3, "03_market_squirrel", "水果商松鼠", "cartoon squirrel 3d model.glb", 1.6),
    Resident(4, "04_research_fox", "芯片店技术员狐", "anthropomorphic fox 3d model.glb", 1.95),
    Resident(5, "05_bank_owl", "金券银行猫头鹰", "cute owl 3d model.glb", 1.7),
    Resident(6, "06_gifts_sheep", "花店绵羊", "sheep character 3d model.glb", 1.65),
    Resident(7, "07_rival_otter", "咖啡豆商水獭", "otter character 3d model.glb", 1.8),
    Resident(8, "08_cafe_cat", "茶馆猫", "orange tabby cat 3d model.glb", 1.75),
    Resident(9, "09_notice_hedgehog", "公告管理员刺猬", "hedgehog explorer 3d model.glb", 1.5),
    Resident(10, "10_repair_automaton", "机器人修理师", "steampunk robot 3d model.glb", 1.65),
    Resident(11, "11_garden_deer", "园丁鹿", "anthropomorphic deer 3d model.glb", 1.95),
    Resident(12, "12_music_frog", "乐手蛙", "frog character 3d model.glb", 1.65),
    Resident(13, "13_dock_turtle", "码头乌龟", "turtle character 3d model.glb", 1.65),
    Resident(14, "14_riverside_mouse", "河岸灰鼠", "mouse character 3d model.glb", 1.45),
    Resident(15, "15_square_dog", "广场柯基", "adventurer corgi 3d model.glb", 1.5),
]


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest().upper()


def image_role(image: bpy.types.Image, objects: list[bpy.types.Object]) -> str:
    if "normal" in image.name.lower():
        return "normal"
    for obj in objects:
        for slot in obj.material_slots:
            material = slot.material
            if not material or not material.use_nodes:
                continue
            for node in material.node_tree.nodes:
                if node.type != "TEX_IMAGE" or node.image != image:
                    continue
                for socket in node.outputs:
                    for link in socket.links:
                        if link.to_node.type == "NORMAL_MAP":
                            return "normal"
    return "color" if image.colorspace_settings.name == "sRGB" else "material-data"


def measure(objects: list[bpy.types.Object]) -> MeshRecord:
    bpy.context.view_layer.update()
    info = inspect(objects)
    low, high = bounds(objects)
    textures = [
        TextureRecord(
            image.name, image.size[0], image.size[1], image.channels,
            image.colorspace_settings.name, image_role(image, objects), image.file_format,
        )
        for image in used_images(objects)
    ]
    return MeshRecord(
        info.triangles, info.vertices, info.objects, info.dimensions,
        tuple(round(value, 6) for value in low), tuple(round(value, 6) for value in high),
        info.uv_layers, info.materials, textures, len(bpy.data.armatures),
        sum(len(arm.bones) for arm in bpy.data.armatures), info.animations,
    )


def import_model(path: Path) -> list[bpy.types.Object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = list(bpy.context.scene.objects)
    if not any(obj.type == "MESH" for obj in objects):
        raise ValueError(f"模型没有网格：{path}")
    return objects


def encode_images(
    objects: list[bpy.types.Object], directory: Path, limit: int, normal_limit: int,
) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for index, image in enumerate(used_images(objects)):
        role = image_role(image, objects)
        image_limit = normal_limit if role == "normal" else limit
        width, height = image.size
        if max(width, height) > image_limit:
            scale = image_limit / max(width, height)
            image.scale(max(1, round(width * scale)), max(1, round(height * scale)))
        pixels = array("f", [0]) * len(image.pixels)
        image.pixels.foreach_get(pixels)
        alpha = image.channels == 4 and min(islice(pixels, 3, None, 4), default=1) < 0.999
        jpeg = role != "normal" and not alpha
        target = directory / f"texture-{index:02d}{'.jpg' if jpeg else '.png'}"
        image.file_format = "JPEG" if jpeg else "PNG"
        image.save(filepath=str(target), quality=90)
        if image.packed_file:
            image.unpack(method="REMOVE")
        image.filepath = str(target)
        image.reload()
        image.pack()


def render_preview(
    objects: list[bpy.types.Object], directory: Path, stem: str, height: float, back: bool,
) -> list[str]:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_x = scene.render.resolution_y = 448
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("NPC_Preview_World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.60, 0.66, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.65
    scene.world = world
    for location, energy, size in [
        ((-height * 1.5, -height * 2.0, height * 2.5), 250, height * 2),
        ((height * 1.5, height, height * 1.8), 180, height * 2),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = size
        look_at(light, Vector((0, 0, height * 0.5)))
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    low, high = bounds(objects)
    camera.data.ortho_scale = max(height, high.x - low.x, high.y - low.y) * 1.2
    scene.camera = camera
    paths: list[str] = []
    directions = [("front", -1), ("back", 1)] if back else [("front", -1)]
    for label, direction in directions:
        camera.location = (0, direction * height * 3, height * 0.55)
        look_at(camera, Vector((0, 0, height * 0.5)))
        target = directory / f"{stem}-{label}.png"
        scene.render.filepath = str(target)
        bpy.ops.render.render(write_still=True)
        paths.append(str(target))
    return paths


def export_lod(
    resident: Resident, source: Path, output: Path, production: Path, mobile: bool,
) -> LodRecord:
    target = 8000 if mobile else 24000
    texture_limit = 512 if mobile else 1024
    normal_limit = 256 if mobile else 512
    suffix = "-mobile-v1" if mobile else "-v1"
    stem = resident.stem + suffix
    destination = output / f"{stem}.glb"
    if destination.exists():
        raise FileExistsError(f"不覆盖已有运行模型：{destination}")
    objects = import_model(source)
    normalize(objects, resident.height)
    simplify(objects, target)
    # 减面可能移除足底或耳尖极值，按最终几何重新归一，不能放宽接地检查。
    bpy.context.view_layer.update()
    normalize(objects, resident.height)
    encode_images(objects, production / "encoded" / stem, texture_limit, normal_limit)
    expected = measure(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(destination), export_format="GLB", use_selection=True,
        export_yup=True, export_materials="EXPORT", export_image_format="AUTO",
        export_animations=True, export_animation_mode="NLA_TRACKS",
        export_draco_mesh_compression_enable=False,
    )
    # 实际重新导入最终文件检查，而不把导出前内存状态充当最终文件报告。
    objects = import_model(destination)
    actual = measure(objects)
    if (actual.joints, actual.animations) != (expected.joints, expected.animations):
        raise ValueError(f"骨骼或动作导出不一致：{stem}")
    if actual.uv_layers != expected.uv_layers or len(actual.materials) != len(expected.materials):
        raise ValueError(f"材质或UV导出不一致：{stem}")
    if len(actual.textures) < len(expected.textures):
        raise ValueError(f"导出遗失贴图：{stem}")
    if not math.isclose(actual.dimensions[2], resident.height, abs_tol=0.01):
        raise ValueError(f"归一化高度错误：{stem}")
    if abs(actual.minimum[2]) > 0.005:
        raise ValueError(f"脚底未接地：{stem}")
    previews = render_preview(objects, production, stem, resident.height, back=not mobile)
    record = LodRecord(
        str(destination), destination.stat().st_size, digest(destination), target,
        texture_limit, normal_limit, actual, previews,
    )
    print("NPC_LOD_DONE", resident.stem, "mobile" if mobile else "desktop", record.bytes, flush=True)
    return record


def process(resident: Resident, root: Path) -> None:
    downloads = (Path.home() / "Downloads").resolve(strict=True)
    source = (downloads / resident.filename).resolve(strict=True)
    if source.parent != downloads:
        raise ValueError("源模型必须是明确指定的 Downloads 文件")
    production = root / "docs/art/production/npc-models-v1"
    output = root / "public/models/npc"
    production.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    report_path = production / f"{resident.stem}-report.json"
    if report_path.exists():
        print("NPC_ALREADY_DONE", resident.stem, flush=True)
        return
    original_digest = digest(source)
    source_model = measure(import_model(source))
    stat = source.stat()
    receipt = SourceReceipt(
        str(source), stat.st_size, original_digest,
        datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
        datetime.now(timezone.utc).isoformat(), source_model,
    )
    (production / f"{resident.stem}-receipt.json").write_text(
        json.dumps(asdict(receipt), ensure_ascii=False, indent=2), encoding="utf-8",
    )
    desktop = export_lod(resident, source, output, production, mobile=False)
    mobile = export_lod(resident, source, output, production, mobile=True)
    if digest(source) != original_digest:
        raise ValueError("Downloads 源文件在加工期间发生变化")
    report = ResidentReport(
        resident, bpy.app.version_string, receipt, desktop, mobile,
        "glTF导出Y向上，Blender的-Y作为正面对应glTF的+Z；高度按全角色包围盒归一、脚底为0。",
        [
            "用户在Tripo生成并提供的模型；当前账号计划及再分发许可仍需协调者核实，不声明MIT。",
            "未新增骨骼或伪造动画；源没有动作时成品也没有动作。",
            "桌面与手机分别从原GLB独立简化；未使用需额外解码器的网格压缩。",
            "单体预览用于确认朝向、轮廓与材质，最终游戏内遮挡与比例由接入阶段检查。",
        ],
    )
    report_path.write_text(json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8")
    print("NPC_FINISHED", resident.stem, report_path, flush=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ids", type=int, nargs="+", required=True)
    args = parser.parse_args(argv)
    if any(number not in range(1, 16) for number in args.ids):
        raise ValueError("角色编号必须在1至15之间")
    root = Path(__file__).resolve().parents[2]
    for number in args.ids:
        process(next(row for row in RESIDENTS if row.number == number), root)


if __name__ == "__main__":
    main()
