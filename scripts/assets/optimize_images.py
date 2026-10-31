"""压缩运行图片副本，保留生产PNG与透明通道，不覆盖源文件。"""

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from PIL import Image


@dataclass
class ImageResult:
    source: str
    output: str
    original_bytes: int
    compressed_bytes: int
    width: int
    height: int
    alpha: bool


root = Path(__file__).resolve().parents[2]
directory = root / "public" / "art"
assets: list[tuple[str, int]] = [
    ("texture-wood", 1024),
    ("texture-plaster", 1024),
    ("texture-roof", 1024),
    ("texture-canvas", 1024),
    ("icon-cash", 256),
    ("icon-assets", 256),
    ("icon-information", 256),
    ("panda-tripo-source", 512),
    ("town-overview", 1600),
]
results: list[ImageResult] = []
for name, edge in assets:
    source = directory / f"{name}.png"
    output = directory / f"{name}.webp"
    if output.exists():
        raise FileExistsError(output)
    with Image.open(source) as image:
        alpha = "A" in image.getbands()
        image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        image.save(output, "WEBP", quality=86, method=6, exact=True)
        results.append(
            ImageResult(
                str(source), str(output), source.stat().st_size,
                output.stat().st_size, image.width, image.height, alpha,
            )
        )
report = root / "docs/art/production/runtime-image-report.json"
report.write_text(
    json.dumps([asdict(result) for result in results], ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(sum(result.original_bytes for result in results), sum(result.compressed_bytes for result in results))
