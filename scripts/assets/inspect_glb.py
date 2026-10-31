"""只读检查GLB实际容器、蒙皮、动作及嵌入图片大小，不导出或覆盖资产。"""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import struct
import sys
from typing import NotRequired, TypedDict, cast


class GltfImage(TypedDict):
    name: NotRequired[str]
    bufferView: NotRequired[int]
    mimeType: NotRequired[str]


class GltfBufferView(TypedDict):
    byteLength: int


class GltfAnimation(TypedDict):
    name: NotRequired[str]


class GltfSkin(TypedDict):
    joints: list[int]


class GltfDocument(TypedDict):
    images: NotRequired[list[GltfImage]]
    bufferViews: NotRequired[list[GltfBufferView]]
    animations: NotRequired[list[GltfAnimation]]
    skins: NotRequired[list[GltfSkin]]
    extensionsUsed: NotRequired[list[str]]


@dataclass
class ImageInfo:
    name: str
    mime: str
    bytes: int


@dataclass
class GlbInfo:
    path: str
    bytes: int
    joints: list[int]
    animations: list[str]
    extensions: list[str]
    images: list[ImageInfo]


def inspect(path: Path) -> GlbInfo:
    with path.open("rb") as stream:
        magic, version, length = struct.unpack("<III", stream.read(12))
        if magic != 0x46546C67 or version != 2 or length != path.stat().st_size:
            raise ValueError(f"GLB文件头或长度不符：{path}")
        chunk_length, chunk_type = struct.unpack("<II", stream.read(8))
        if chunk_type != 0x4E4F534A:
            raise ValueError("GLB首块不是JSON")
        document = cast(GltfDocument, json.loads(stream.read(chunk_length)))
    views = document.get("bufferViews", [])
    images = [
        ImageInfo(
            image.get("name", ""), image.get("mimeType", ""),
            views[image["bufferView"]]["byteLength"] if "bufferView" in image else 0,
        )
        for image in document.get("images", [])
    ]
    return GlbInfo(
        str(path), length, [len(skin["joints"]) for skin in document.get("skins", [])],
        [action.get("name", "") for action in document.get("animations", [])],
        document.get("extensionsUsed", []), images,
    )


for argument in sys.argv[1:]:
    print(json.dumps(asdict(inspect(Path(argument).resolve(strict=True))), ensure_ascii=False))
