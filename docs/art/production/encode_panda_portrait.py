# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==13.0.0"]
# ///
"""编码三维渲染衍生头像，保留透明边缘；纸张/深绿合成图仅作检查。"""

from dataclasses import asdict, dataclass
import json
from pathlib import Path

from PIL import Image


@dataclass(frozen=True, slots=True)
class PortraitEncoding:
    source_width: int
    source_height: int
    source_bytes: int
    runtime_width: int
    runtime_height: int
    runtime_bytes: int
    alpha_min: int
    alpha_max: int
    transparent_pixels: int
    partially_transparent_pixels: int
    corner_alpha: tuple[int, int, int, int]


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "docs" / "art" / "production" / "panda-portrait.png"
OUTPUT = ROOT / "public" / "art" / "panda-portrait.webp"
REPORT = SOURCE.with_name("panda-portrait-encoding.json")


def main() -> None:
    if OUTPUT.exists() or REPORT.exists():
        raise FileExistsError("禁止覆盖已存在的头像运行文件或编码报告")
    with Image.open(SOURCE) as original:
        if original.mode != "RGBA" or original.size != (1024, 1024):
            raise ValueError("源渲染必须为1024像素RGBA")
        runtime = original.convert("RGBa").resize((512, 512), Image.Resampling.LANCZOS).convert("RGBA")
        runtime.save(OUTPUT, "WEBP", quality=92, method=6, exact=True)
    with Image.open(OUTPUT) as decoded:
        alpha = decoded.getchannel("A")
        alpha_min, alpha_max = alpha.getextrema()
        histogram = alpha.histogram()
        corners = tuple(alpha.getpixel(point) for point in ((0, 0), (511, 0), (0, 511), (511, 511)))
        if alpha_min != 0 or alpha_max != 255 or any(corners[:2]):
            raise ValueError("背景或头部上缘透明通道不符合要求")
        for name, color in (("paper", "#f7eed8"), ("green", "#243f2b")):
            preview = Image.new("RGBA", decoded.size, color)
            preview.alpha_composite(decoded)
            preview.convert("RGB").save(ROOT / "logs" / f"panda-portrait-on-{name}.png")
        report = PortraitEncoding(
            1024, 1024, SOURCE.stat().st_size, decoded.width, decoded.height,
            OUTPUT.stat().st_size, alpha_min, alpha_max, histogram[0], sum(histogram[1:255]), corners,
        )
        REPORT.write_text(json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(asdict(report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
