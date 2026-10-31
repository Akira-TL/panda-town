"""以相同Blender相机、照明和姿势渲染纹理压缩前后模型。"""
from pathlib import Path
import sys
import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_model import previews

root = Path(__file__).resolve().parents[2]
directory = root / "docs/art/production/models/texture-v2"
for stem, height in [("panda-rigged", 2.1), ("bakery", 4.4)]:
    for suffix, label in [("", "before"), ("-v2", "after")]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(root / "public/models" / f"{stem}{suffix}.glb"))
        for obj in bpy.context.scene.objects:
            if obj.animation_data:
                for track in obj.animation_data.nla_tracks:
                    track.mute = track.name != "Walk"
        bpy.context.scene.frame_set(7)
        previews(list(bpy.context.scene.objects), directory, f"compare-{stem}-{label}", height)
