# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==13.0.0"]
# ///
"""保留生成原件，将透明研究卷轴缩到运行尺寸。"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[4]
source = Path(__file__).with_name("research-scroll.png")
target = root / "public/art/research/research-scroll.webp"
if target.exists():
    raise FileExistsError(target)
with Image.open(source) as image:
    rgba = image.convert("RGBA")
    rgba.thumbnail((256, 256), Image.Resampling.LANCZOS)
    alpha = rgba.getchannel("A").getextrema()
    if alpha[0] != 0 or alpha[1] != 255:
        raise ValueError(f"原图透明范围异常：{alpha}")
    rgba.save(target, "WEBP", quality=92, method=6, exact=True)
    print(f"{target}: {rgba.size}, alpha={alpha}, {target.stat().st_size} bytes")
