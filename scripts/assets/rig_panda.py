"""为已检查朝向的熊猫两档网格创建骨骼、规则权重及真实关节动作。"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_model import bounds, inspect, previews


@dataclass
class RigReport:
    source: str
    output: str
    blend: str
    dimensions: tuple[float, float, float]
    bones: list[str]
    actions: list[str]
    vertices: int
    unweighted: int
    uv_layers: list[str]
    preview_paths: list[str]
    limitations: list[str]


def smooth(value: float, low: float, high: float) -> float:
    t = min(1.0, max(0.0, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def make_bones() -> bpy.types.Object:
    bpy.ops.object.armature_add(enter_editmode=True)
    rig = bpy.context.object
    rig.name = "PandaTownRig"
    bones = rig.data.edit_bones
    bones.remove(bones[0])

    def bone(
        name: str,
        start: tuple[float, float, float],
        end: tuple[float, float, float],
        parent: str = "",
    ):
        item = bones.new(name)
        item.head, item.tail = start, end
        if parent:
            item.parent = bones[parent]

    bone("Body", (0, 0, 0.55), (0, 0, 1.25))
    bone("Head", (0, 0, 1.25), (0, 0, 1.95), "Body")
    for side, sign in [("L", 1), ("R", -1)]:
        bone(f"UpperArm.{side}", (sign * 0.43, 0, 1.2), (sign * 0.66, -0.02, 0.93), "Body")
        bone(
            f"Forearm.{side}",
            (sign * 0.66, -0.02, 0.93),
            (sign * 0.87, -0.08, 0.7),
            f"UpperArm.{side}",
        )
        bone(f"Thigh.{side}", (sign * 0.24, 0, 0.59), (sign * 0.25, -0.01, 0.3), "Body")
        bone(f"Shin.{side}", (sign * 0.25, -0.01, 0.3), (sign * 0.25, -0.12, 0.06), f"Thigh.{side}")
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def weights(mesh: bpy.types.Object, rig: bpy.types.Object) -> int:
    for name in [bone.name for bone in rig.data.bones]:
        mesh.vertex_groups.new(name=name)
    unweighted = 0
    for vertex in mesh.data.vertices:
        x, y, z = vertex.co
        head = smooth(z, 1.24, 1.48)
        leg = 1 - smooth(z, 0.48, 0.68)
        arm = smooth(abs(x), 0.4, 0.59) * smooth(z, 0.6, 0.83) * (1 - head)
        arm *= 1 - smooth(y, 0.18, 0.48)
        side = "L" if x >= 0 else "R"
        forearm = 1 - smooth(z, 0.86, 1.04)
        shin = 1 - smooth(z, 0.25, 0.42)
        body = max(0.0, 1 - head - leg - arm)
        entries = [
            ("Head", head),
            ("Body", body),
            (f"Thigh.{side}", leg * (1 - shin)),
            (f"Shin.{side}", leg * shin),
            (f"UpperArm.{side}", arm * (1 - forearm)),
            (f"Forearm.{side}", arm * forearm),
        ]
        total = sum(weight for _, weight in entries)
        if total <= 0:
            unweighted += 1
            continue
        for name, weight in entries:
            if weight > 0:
                mesh.vertex_groups[name].add([vertex.index], weight / total, "REPLACE")
    modifier = mesh.modifiers.new("PandaTownSkin", "ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    return unweighted


def animations(rig: bpy.types.Object) -> None:
    rig.animation_data_create()
    for name, end in [("Idle", 49), ("Walk", 25)]:
        action = bpy.data.actions.new(name)
        rig.animation_data.action = action
        for frame in range(1, end + 1, 2):
            phase = (frame - 1) / (end - 1) * math.tau
            for bone in rig.pose.bones:
                bone.rotation_mode = "XYZ"
                bone.rotation_euler = (0, 0, 0)
                swing = math.sin(phase) * (1 if bone.name.endswith(".L") else -1)
                if name == "Walk":
                    if bone.name.startswith("Thigh"):
                        bone.rotation_euler.x = swing * 0.32
                    elif bone.name.startswith("Shin"):
                        bone.rotation_euler.x = max(0, -swing) * 0.24
                    elif bone.name.startswith("UpperArm"):
                        bone.rotation_euler.x = -swing * 0.18
                    elif bone.name == "Body":
                        bone.rotation_euler.y = math.sin(phase * 2) * 0.018
                elif bone.name == "Head":
                    bone.rotation_euler.z = math.sin(phase) * 0.035
                    bone.rotation_euler.x = math.sin(phase) * 0.015
                elif bone.name == "Body":
                    bone.rotation_euler.x = math.sin(phase) * 0.012
                bone.keyframe_insert(data_path="rotation_euler", frame=frame)
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, action)
        rig.animation_data.action = None
    for track in rig.animation_data.nla_tracks:
        track.mute = True


def process(root: Path, mobile: bool) -> RigReport:
    suffix = "-mobile" if mobile else ""
    source = root / "public" / "models" / f"panda{suffix}.glb"
    output = source.with_name(f"panda{suffix}-rigged.glb")
    directory = root / "docs" / "art" / "production" / "models"
    blend = directory / f"panda{suffix}-rigged.blend"
    if output.exists() or blend.exists():
        raise FileExistsError("不覆盖已有骨骼模型")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    # 导入后应用完整世界矩阵，骨骼和规则权重均以米、Z向上、正Y为背包侧计算。
    for mesh in meshes:
        matrix = mesh.matrix_world.copy()
        mesh.parent = None
        mesh.matrix_world = Matrix.Identity(4)
        mesh.data.transform(matrix)
        mesh.data.update()
    bpy.context.view_layer.update()
    low, high = bounds(meshes)
    if not 2.0 < high.z - low.z < 2.2 or high.x - low.x < 1.5:
        raise ValueError("源尺寸/轴向与已检查熊猫不一致，停止自动权重")
    rig = make_bones()
    unweighted = sum(weights(mesh, rig) for mesh in meshes)
    if unweighted:
        raise ValueError(f"存在未绑定顶点：{unweighted}")
    animations(rig)
    for track in rig.animation_data.nla_tracks:
        track.mute = False
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 49
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [*meshes, rig]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
    )
    info = inspect(meshes)
    paths: list[str] = []
    if not mobile:
        for track in rig.animation_data.nla_tracks:
            track.mute = track.name != "Walk"
        bpy.context.scene.frame_set(7)
        paths = previews(meshes, directory, "panda-rigged-walk", 2.1)
    return RigReport(
        str(source),
        str(output),
        str(blend),
        info.dimensions,
        [bone.name for bone in rig.data.bones],
        ["Idle", "Walk"],
        info.vertices,
        unweighted,
        info.uv_layers,
        paths,
        [
            "规则权重依据已检查的熊猫轮廓；需检查腋下、裤腿、背包与肩部形变。",
            "关节动作真实存在，不用整模型跳动代替；尚需运行镜头和连续周期检查。",
        ],
    )


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    reports = [process(root, False), process(root, True)]
    path = root / "docs" / "art" / "production" / "models" / "panda-rig-report.json"
    if path.exists():
        raise FileExistsError(path)
    path.write_text(
        json.dumps([asdict(report) for report in reports], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
