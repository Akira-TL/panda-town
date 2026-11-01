# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==13.0.0"]
# ///
"""保留八个生成原图；校验透明通道并缩放编码为运行WebP。"""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
from PIL import Image


@dataclass
class AssetInfo:
    product: str
    source_size: tuple[int, int]
    source_alpha: tuple[int, int]
    runtime_size: tuple[int, int]
    runtime_alpha: tuple[int, int]
    bytes: int


directory = Path(__file__).resolve().parent
root = directory.parents[3]
rows: list[AssetInfo] = []
for product in ["bread", "timber", "fruit", "chips", "gold", "flowers", "coffee", "tea"]:
    destination = root / f"public/art/products/{product}.webp"
    if destination.exists():
        raise FileExistsError(destination)
    with Image.open(directory / f"{product}.png") as image:
        image.load()
        if image.mode != "RGBA":
            raise ValueError(f"{product}缺少真实RGBA")
        alpha = image.getchannel("A").getextrema()
        if alpha[0] != 0 or alpha[1] < 240:
            raise ValueError(f"{product}透明范围异常：{alpha}")
        size = image.size
        runtime = image.copy()
        runtime.thumbnail((192, 192), Image.Resampling.LANCZOS)
        runtime.save(destination, "WEBP", quality=90, method=6, exact=True)
    with Image.open(destination) as decoded:
        decoded.load()
        rows.append(AssetInfo(product, size, alpha, decoded.size,
                              decoded.getchannel("A").getextrema(), destination.stat().st_size))
report = json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2)
(directory / "encoding-report.json").write_text(report, encoding="utf-8")
print(report)
