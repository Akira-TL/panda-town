"""只读用户交付的八个GLB，以256像素低样本预览辨认用途，不凭文件名映射。"""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_model import bounds, normalize


@dataclass
class IncomingPreview:
    index: int
    source: str
    source_bytes: int
    preview: str


files = [
    "stylized tree 3d model.glb", "stone cottage cafe 3d model.glb",
    "fantasy cottage 3d model.glb", "market stall 3d model.glb",
    "storybook cottage 3d model.glb", "fruit market stall 3d model.glb",
    "cute cottage shop 3d model.glb", "storybook cottage 3d model (1).glb",
]
root = Path(__file__).resolve().parents[2]
directory = root / "docs/art/production/models/incoming"
directory.mkdir(parents=True, exist_ok=True)
batch = int(sys.argv[sys.argv.index("--") + 1])
results: list[IncomingPreview] = []
for index in range(batch * 4, batch * 4 + 4):
    source = Path.home() / "Downloads" / files[index]
    preview = directory / f"incoming-{index:02d}.png"
    if preview.exists():
        raise FileExistsError(preview)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = list(bpy.context.scene.objects)
    normalize(objects, 4.4)
    low, high = bounds(objects)
    size = high - low
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.7, .75, .8, 1)
    background.inputs["Strength"].default_value = .8
    bpy.ops.object.light_add(type="AREA", location=(-7, -8, 12))
    light = bpy.context.object
    light.data.energy, light.data.size = 1500, 8
    target = Vector((0, 0, 2.2))
    light.rotation_euler = (target-light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=(7, -11, 7))
    camera = bpy.context.object
    camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(size.x + size.y * .55, size.z) * 1.25
    scene.camera = camera
    scene.render.filepath = str(preview)
    bpy.ops.render.render(write_still=True)
    results.append(IncomingPreview(index, str(source), source.stat().st_size, str(preview)))
    print("INCOMING_PREVIEW", index, str(preview), flush=True)
report = directory / f"preview-batch-{batch}.json"
report.write_text(json.dumps([asdict(row) for row in results], ensure_ascii=False, indent=2), encoding="utf-8")
