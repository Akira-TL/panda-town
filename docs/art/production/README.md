# 生产资产来源

## 第一批效果图及模型输入

均于 2026-10-31 使用内置 imagegen、以既有童话小镇图作为风格参考生成。所有文件为概念或输入图，尚非游戏运行截图。

| 文件 | 用途 | 检查与尚存差异 |
| --- | --- | --- |
| town-overview.png | 整镇布局及光照参考 | 弯路、溪流、错落建筑明确；准确十六节点连接须以规格构建，不能照图自动认定路线正确 |
| street-dialogue.png | 第三人称与店前对话参考 | 背景地点和角色仍可见；正式对话使用真实可操作组件 |
| cafe-opening.png | 咖啡馆开张演出参考 | 露台、桥、暖光与角色呼应同一美术方向 |
| profile-desktop.png | 桌面报告层次与装饰参考 | 生成文本虚构了超出八回合的行为次数及未设计题目；仅作视觉参考，实际内容严格按证据生成 |
| profile-mobile.png | 竖屏报告风格参考 | 文案含未经证据支持的人格描述；正式界面替换为规格中的有限线索与不足说明 |
| panda-tripo-source.png | 熊猫图转模型输入 | 已完成 Tripo 网格、桌面/手机降面及骨骼动作，见 models/README.md 和 models/panda-rig.md |
| bakery-tripo-source.png | 面包店图转模型输入 | 单体完整、附属物连接；需检查重建后窗户、屋背和细部面数 |

四类基础纹理与现金、资产、资料独立图标已生成。纹理提示词见 `texture-prompts.md`，图标提示词与检查见 `icon-prompts.md`。T01 仍缺独立熊猫头像及完整视觉对照，不因效果图已生成而关闭任务。

## 模型接收与运行状态

旧 Edge 上传流程已停止。后续 Tripo 生成由用户接管，Agent 不再提交生成任务；用户交付的 Downloads 原件由 Agent 校验、加工并接入。当前已完成熊猫、八处主要建筑与树共十类真实模型，均有桌面及手机档；熊猫包含项目自建骨骼及待机、行走动作。模糊原件名通过低成本预览和可见特征映射，接收哈希及证据见 `models/incoming-models.md`、`models/incoming-receipt-*.json`。

实际运行文件均为 `public/models/` 的 `*-v2.glb`：熊猫为 `panda-rigged-v2.glb`／`panda-mobile-rigged-v2.glb`；其余 `bakery`、`grocery`、`market`、`research`、`bank`、`gifts`、`rival`、`cafe`、`tree` 使用对应 `<名称>-v2.glb`／`<名称>-mobile-v2.glb`。中间 PNG 材质版本、原始 GLB 和高模源在本机保留，不成为额外运行请求。

生产快照 `12ed86b` 已在桌面及 390 像素窗口实际等待十类模型装入后保存跟随、俯瞰及手机截图，页面错误为空；固定证据在 `logs/scene-12ed86b/`。该快照仍有镜头朝空外围、灰色背景和层次不足等差距，不能据加载成功宣称达到参考图。后续居民／道具状态及新的街景、远山、广场、临水码头在各自目的中实现，待对应生产版本核对，不用旧截图替代。

来源账号计划及许可仍待核实，不将外部模型自动改标 MIT。二维概念图、独立输入图、单体预览与实际运行截图分别保留用途，不相互冒充。

## 熊猫角色建模输入

文件：`panda-tripo-source.png`。2026-10-31 使用内置 imagegen 生成，参考 `docs/art/fairytale-town-reference.png` 的风格。用途：Tripo 图像转三维输入；现已完成模型及项目自建骨骼，原图仍保留作来源追踪。实际来源任务、哈希、面数、UV、纹理及动作检查见 `models/README.md`、`models/panda-rig.md`。

提示词：

> Use case: stylized-concept. Asset type: Panda Town image-to-3D source for Tripo. Input image: reference image for art style only, not edit target. Generate a single isolated full-body panda adventurer character matching this warm fairy tale town style. Cute rounded stylized 3D panda, cream fur and black limbs, moss-green small backpack, ochre neck scarf, friendly black eye patches. Neutral A-pose arms slightly spread, feet separated, front three-quarter view, symmetrical clear forms suitable for single-image 3D reconstruction. Entire character visible from ears to soles with generous margin. Plain pale warm gray background, neutral even studio illumination, no cast shadow, no scenery, no ground pedestal, no other characters, no text, no watermark, no multiple views. Soft carved/painted game-character materials, readable silhouette, subtle fur surface rather than individual fine hairs. Keep accessories attached simply, no tiny dangling straps.

原始生成文件保留在本机 imagegen 生成目录，项目内副本才是后续上传和游戏生产的来源。图像已目视检查：主体完整、四肢分离、背景干净；细毛细节的重建表现需在模型生成后检查。
