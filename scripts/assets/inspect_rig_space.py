"""只读原始游戏模型，核对导入矩阵与更新前后包围盒，不写模型。"""

from pathlib import Path
import sys
import bpy
from mathutils import Matrix

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_model import bounds

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / "public/models/panda.glb"))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for mesh in meshes:
    print(
        "IMPORTED",
        mesh.name,
        tuple(mesh.dimensions),
        tuple(tuple(row) for row in mesh.matrix_world),
    )
for mesh in meshes:
    matrix = mesh.matrix_world.copy()
    mesh.parent = None
    mesh.matrix_world = Matrix.Identity(4)
    mesh.data.transform(matrix)
print("BEFORE_UPDATE", tuple(bounds(meshes)[1] - bounds(meshes)[0]))
for mesh in meshes:
    mesh.data.update()
bpy.context.view_layer.update()
print("AFTER_UPDATE", tuple(bounds(meshes)[1] - bounds(meshes)[0]))
print("EXTREMA", tuple(bounds(meshes)[0]), tuple(bounds(meshes)[1]))
