"""依据已目视预览确认的映射，最多由两个独立CLI分批加工模型。"""
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import shutil
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_model


@dataclass
class ModelMapping:
    name: str
    filename: str
    height: float
    evidence: str


@dataclass
class ModelReceipt:
    mapping: ModelMapping
    original: str
    source: str
    bytes: int
    sha256: str


models = [
    ModelMapping("tree", "stylized tree 3d model.glb", 4.5, "不规则树干和分簇叶片，预览00"),
    ModelMapping("cafe", "stone cottage cafe 3d model.glb", 4.4, "侧面露台与杯形招牌，预览01"),
    ModelMapping("research", "fantasy cottage 3d model.glb", 6.2, "绿色玻璃穹顶和望远镜，预览02"),
    ModelMapping("grocery", "market stall 3d model.glb", 4.6, "整栋绿白布篷杂货店，预览03"),
    ModelMapping("bank", "storybook cottage 3d model.glb", 5.2, "门上金币圆形浮雕与圆塔，预览04"),
    ModelMapping("market", "fruit market stall 3d model.glb", 2.9, "独立四柱布篷水果摊，预览05"),
    ModelMapping("gifts", "cute cottage shop 3d model.glb", 4.4, "粉色条纹布篷和礼物招牌，预览06"),
    ModelMapping("rival", "storybook cottage 3d model (1).glb", 4.8, "二楼阳台和叶片招牌，预览07"),
]
root = Path(__file__).resolve().parents[2]
directory = root / "docs/art/production/models"
batch = int(sys.argv[sys.argv.index("--") + 1])
receipts: list[ModelReceipt] = []
for mapping in models[batch * 4:batch * 4 + 4]:
    original = Path.home() / "Downloads" / mapping.filename
    source = directory / f"{mapping.name}-source.glb"
    if source.exists():
        raise FileExistsError(source)
    digest = hashlib.file_digest(original.open("rb"), "sha256").hexdigest().upper()
    shutil.copy2(original, source)
    receipt = ModelReceipt(mapping, str(original), str(source), source.stat().st_size, digest)
    receipts.append(receipt)
    (directory / f"incoming-receipt-{batch}.json").write_text(
        json.dumps([asdict(row) for row in receipts], ensure_ascii=False, indent=2), encoding="utf-8",
    )
    tree = mapping.name == "tree"
    sys.argv = ["prepare_model.py", "--", "--source", str(source), "--name", mapping.name,
                "--height", str(mapping.height), "--desktop-triangles", "6000" if tree else "30000",
                "--mobile-triangles", "2000" if tree else "10000",
                "--desktop-texture", "1024", "--mobile-texture", "512"]
    prepare_model.main()
    print("INCOMING_MODEL_FINISHED", mapping.name, flush=True)
