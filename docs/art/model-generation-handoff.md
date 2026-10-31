# Tripo 模型生成交接

2026-10-31：用户接管后续 Tripo 模型生成。Agent 准备 imagegen 输入图并打包到下载目录；用户生成、导出模型后，Agent 继续使用 Blender 加工、接入真实三维场景和检查画面。无需共享账号或重复登录。

## 当前素材包

包含八张已经生成的单独物件图。源文件保存在项目 `docs/art/production/`，完整建筑提示词见 `building-inputs.md`，树木提示词见本文末尾；图像尺寸与校验值见素材包清单。熊猫与面包店模型已提供，不重复生成。

| 包内图像 | 对应地点或用途 | 建议导出文件名 |
| --- | --- | --- |
| `01_tree.png` | 可在街区复用的树木 | `tree.glb` |
| `02_cafe.png` | 玩家的咖啡馆 | `cafe.glb` |
| `03_research.png` | PandaAI 研究站，正式文字由游戏叠加 | `research.glb` |
| `04_market.png` | 集市摊位 | `market.glb` |
| `05_grocery.png` | 杂货铺 | `grocery.glb` |
| `06_bank.png` | 银行 | `bank.glb` |
| `07_gifts.png` | 礼品店 | `gifts.glb` |
| `08_rival.png` | 电脑对手的小店 | `rival.glb` |

编号只是方便逐个处理；任何一个先完成都可以先交付，不必等整包完成。

## 生成与导出

1. 每次上传一张图，各生成一个独立模型。不要把八图拼成一个模型。
2. 可沿用已成功的 `H3.1 – Best Quality` 和 `Geometry & Texture`，保留颜色、法线及粗糙度等贴图。不必开启 8K 或为此购买附加服务。
3. 导出包含材质和贴图的 GLB，保留原始精度；后续面数、尺寸、朝向、原点和贴图大小由 Agent 在 Blender 中统一处理。
4. 保存到原先的下载目录，能按上表命名更便于识别；站点自动文件名也可，告知实际路径即可。
5. 建筑、树木无需绑定骨骼或生成行走动作。玩家及居民复用已加工的熊猫骨骼模型，居民服饰与动作响应由游戏继续制作。

包内 `素材清单.csv` 记录每图对应的项目原件、像素尺寸、字节数和 SHA256，便于核对。输入图是建模参考；模型背面、细节与游戏内光照仍须在导出后检查。

## 已收到的模型

- 熊猫：`panda character 3d model.glb`，已加工静态与骨骼两档。
- 面包店：`bakery shop 3d model.glb`，已确认 GLB 2 文件头与声明长度一致，65,694,884 字节；SHA256 为 `A7816DDB52D1A7B882BC72D011A3EC2E91E98690360A5457A823CCF68CE6649F`。正在安排独立加工与场景集成。

源码采用 MIT；外部生成模型及图像的来源与使用条件分别记录，不自动改标为 MIT。

## 树木输入图的生成记录

`tree-tripo-source.png` 于 2026-10-31 通过内置 imagegen 生成，以已选童话小镇图作为风格参考。原件保留在 `C:/Users/Akira/.codex/generated_images/01a18dc3-5013-7e02-8655-f76e7f83338b/exec-10d519cc-752d-4451-aa4f-8ee78c3e6852.png`。这是建模输入，尚未生成对应三维模型。

完整提示词：

> Use case: stylized-concept. Asset type: Panda Town Tripo image-to-3D source. Reference image defines the warm storybook village art style. Generate one single complete small leafy village tree with a gently curved brown trunk, clearly branching structure, irregular layered masses of green leaves, several readable individual broad leaves around silhouette, warm moss and restrained golden green tips. Handcrafted stylized game asset, sophisticated natural tree rather than spherical balls, soft painterly physically plausible surfaces. Full tree from root flare to highest leaves, generous margin, front three-quarter product view, plain pale warm gray background, even neutral studio lighting. No terrain disk, no rocks, no pots, no scene, no other plants, no characters, no text, no multi-view sheet. Strong connected topology suitable for Tripo reconstruction, not thousands of detached hairs or detached leaves. Single tree only.
