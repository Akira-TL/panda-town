"""用Blender图片API生成模型纹理压缩版本，保留法线PNG、UV与骨骼动作。"""
from __future__ import annotations

from array import array
from dataclasses import asdict, dataclass
from itertools import islice
import json
from pathlib import Path
import sys

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_model import inspect, used_images


@dataclass
class CompressionResult:
    source: str
    output: str
    source_bytes: int
    output_bytes: int
    converted_images: list[str]
    preserved_normal_images: list[str]
    joints: int
    animations: list[str]
    uv_layers: list[str]


root = Path(__file__).resolve().parents[2]
production = root / "docs/art/production/models/texture-v2"
production.mkdir(parents=True, exist_ok=True)
results: list[CompressionResult] = []
new_models = "--new-models" in sys.argv
stems = (
    [f"{name}{suffix}" for name in ["tree","cafe","research","grocery","bank","market","gifts","rival"]
     for suffix in ["", "-mobile"]]
    if new_models else ["panda-rigged", "panda-mobile-rigged", "bakery", "bakery-mobile"]
)
report = production / ("new-models-report.json" if new_models else "compression-report.json")
if report.exists():
    raise FileExistsError(report)
for stem in stems:
    source = root / "public/models" / f"{stem}.glb"
    output = source.with_name(f"{stem}-v2.glb")
    if output.exists():
        raise FileExistsError(output)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = list(bpy.context.scene.objects)
    converted: list[str] = []
    preserved: list[str] = []
    for image in used_images(objects):
        if "normal" in image.name.lower():
            preserved.append(image.name)
            continue
        pixels = array("f", [0]) * len(image.pixels)
        image.pixels.foreach_get(pixels)
        if image.channels == 4 and min(islice(pixels, 3, None, 4), default=1) < 0.999:
            continue
        path = production / f"{stem}-{Path(image.name).stem}.jpg"
        if path.exists():
            raise FileExistsError(path)
        image.file_format = "JPEG"
        image.save(filepath=str(path), quality=94)
        if image.packed_file:
            image.unpack(method="REMOVE")
        image.filepath = str(path)
        image.reload()
        image.pack()
        converted.append(image.name)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", export_image_format="AUTO",
        export_animations=True, export_animation_mode="NLA_TRACKS",
    )
    # 检查最终文件重新导入后仍有相同蒙皮、动作与UV。
    original_joints = sum(len(arm.bones) for arm in bpy.data.armatures)
    original_actions = sorted(action.name for action in bpy.data.actions)
    original_uv = inspect(objects).uv_layers
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(output))
    joints = sum(len(arm.bones) for arm in bpy.data.armatures)
    actions = sorted(action.name for action in bpy.data.actions)
    uv = inspect(list(bpy.context.scene.objects)).uv_layers
    if (joints, actions, uv) != (original_joints, original_actions, original_uv):
        raise ValueError(f"导出破坏骨骼、动作或UV：{stem}")
    results.append(CompressionResult(
        str(source), str(output), source.stat().st_size, output.stat().st_size,
        converted, preserved, joints, actions, uv,
    ))
report.write_text(
    json.dumps([asdict(result) for result in results], ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print("MODEL_TEXTURE_REPORT", report)
