# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==13.0.0"]
# ///
"""保留生成PNG，编码1024纹理并制作仅用于目视检查的平铺图。"""

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from statistics import fmean

from PIL import Image, ImageChops, ImageStat


@dataclass(frozen=True, slots=True)
class MaterialSpec:
    name: str
    footprint_metres: float


@dataclass(frozen=True, slots=True)
class TextureResult:
    name: str
    source_width: int
    source_height: int
    source_mode: str
    source_bytes: int
    runtime_width: int
    runtime_height: int
    runtime_bytes: int
    footprint_metres: float
    left_right_difference: float
    top_bottom_difference: float
    adjacent_x_difference: float
    adjacent_y_difference: float


ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / "docs" / "art" / "production" / "materials"
RUNTIME = ROOT / "public" / "art" / "materials"
SPECS = (
    MaterialSpec("stone-wall", 2.0),
    MaterialSpec("cobblestone-path", 1.5),
    MaterialSpec("grass-earth", 2.0),
)


def mean_difference(first: Image.Image, second: Image.Image) -> float:
    return round(fmean(ImageStat.Stat(ImageChops.difference(first, second)).mean), 3)


def inspection_images(image: Image.Image, name: str) -> None:
    """不修改资产内容；拼接实际WebP解码图检查接缝和图案重复。"""
    preview = Image.new("RGB", (1024, 1024))
    small = image.resize((512, 512), Image.Resampling.LANCZOS)
    for x in (0, 512):
        for y in (0, 512):
            preview.paste(small, (x, y))
    preview.save(SOURCE / f"{name}-tiling-check.jpg", quality=92, subsampling=0)
    crossing = Image.new("RGB", (512, 512))
    crossing.paste(image.crop((768, 768, 1024, 1024)), (0, 0))
    crossing.paste(image.crop((0, 768, 256, 1024)), (256, 0))
    crossing.paste(image.crop((768, 0, 1024, 256)), (0, 256))
    crossing.paste(image.crop((0, 0, 256, 256)), (256, 256))
    crossing.save(SOURCE / f"{name}-seams-check.png")


def encode(spec: MaterialSpec) -> TextureResult:
    source = SOURCE / f"{spec.name}.png"
    output = RUNTIME / f"{spec.name}.webp"
    with Image.open(source) as original:
        if original.width != original.height:
            raise ValueError(f"{source.name}不是正方形，不能拉伸冒充可平铺纹理")
        source_size = original.size
        source_mode = original.mode
        if "A" in original.getbands() and original.getchannel("A").getextrema() != (255, 255):
            raise ValueError(f"{source.name}包含非不透明像素")
        runtime = original.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
        runtime.save(output, "WEBP", quality=90, method=6, exact=True)
    with Image.open(output) as decoded:
        inspection_images(decoded, spec.name)
        return TextureResult(
            spec.name,
            source_size[0], source_size[1], source_mode, source.stat().st_size,
            decoded.width, decoded.height, output.stat().st_size, spec.footprint_metres,
            mean_difference(decoded.crop((0, 0, 1, 1024)), decoded.crop((1023, 0, 1024, 1024))),
            mean_difference(decoded.crop((0, 0, 1024, 1)), decoded.crop((0, 1023, 1024, 1024))),
            mean_difference(decoded.crop((0, 0, 1023, 1024)), decoded.crop((1, 0, 1024, 1024))),
            mean_difference(decoded.crop((0, 0, 1024, 1023)), decoded.crop((0, 1, 1024, 1024))),
        )


def main() -> None:
    for spec in SPECS:
        if (RUNTIME / f"{spec.name}.webp").exists():
            raise FileExistsError(f"禁止覆盖已存在运行纹理：{spec.name}")
    results = [encode(spec) for spec in SPECS]
    (SOURCE / "encoding-report.json").write_text(
        json.dumps([asdict(result) for result in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps([asdict(result) for result in results], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
