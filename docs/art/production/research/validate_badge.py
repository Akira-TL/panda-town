# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==13.0.0"]
# ///
"""只读核验生成徽章的运行PNG，不修改图像。"""
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
from PIL import Image


@dataclass
class BadgeInfo:
    path: str
    width: int
    height: int
    mode: str
    alpha: tuple[int, int]
    corner_alpha: list[int]
    bytes: int
    sha256: str


root = Path(__file__).resolve().parents[4]
path = root / "public/art/research/verification-badge.png"
with Image.open(path) as image:
    image.verify()
with Image.open(path) as image:
    image.load()
    if image.mode != "RGBA":
        raise ValueError(f"缺少真实RGBA透明通道：{image.mode}")
    alpha = image.getchannel("A")
    extrema = alpha.getextrema()
    corners = [alpha.getpixel(point) for point in [
        (0, 0), (image.width - 1, 0),
        (0, image.height - 1), (image.width - 1, image.height - 1),
    ]]
    if extrema[0] != 0 or extrema[1] < 250 or any(corners):
        raise ValueError(f"透明范围或四角异常：{extrema}, {corners}")
    info = BadgeInfo(
        "public/art/research/verification-badge.png", image.width, image.height,
        image.mode, extrema, corners, path.stat().st_size,
        hashlib.sha256(path.read_bytes()).hexdigest(),
    )
report = Path(__file__).with_name("verification-badge-validation.json")
report.write_text(json.dumps(asdict(info), ensure_ascii=False, indent=2), encoding="utf-8")
print(report.read_text(encoding="utf-8"))
