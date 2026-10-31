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
| panda-tripo-source.png | 熊猫图转模型输入 | 完整角色与干净背景，尚待 Tripo 生成及检查 |
| bakery-tripo-source.png | 面包店图转模型输入 | 单体完整、附属物连接；需检查重建后窗户、屋背和细部面数 |

四类基础纹理与现金、资产、资料独立图标已生成。纹理提示词见 `texture-prompts.md`，图标提示词与检查见 `icon-prompts.md`。T01 仍缺独立熊猫头像及完整视觉对照，不因效果图已生成而关闭任务。

## 上传通道状态

旧 Edge 上传流程未成功且已停止操作。用户随后授权独立内置浏览器或项目专用 Chrome；内置浏览器在子线程显示不可用，跨线程标签不可见，默认创建亦超时。正在按授权核验专用 Chrome 路径。尚无已下载 Tripo 模型，不宣称积分、许可或模型检查已完成。

## 熊猫角色建模输入

文件：`panda-tripo-source.png`。2026-10-31 使用内置 imagegen 生成，参考 `docs/art/fairytale-town-reference.png` 的风格。用途：Tripo 图像转三维输入；尚未生成三维模型，不宣称可绑定骨骼或已优化。

提示词：

> Use case: stylized-concept. Asset type: Panda Town image-to-3D source for Tripo. Input image: reference image for art style only, not edit target. Generate a single isolated full-body panda adventurer character matching this warm fairy tale town style. Cute rounded stylized 3D panda, cream fur and black limbs, moss-green small backpack, ochre neck scarf, friendly black eye patches. Neutral A-pose arms slightly spread, feet separated, front three-quarter view, symmetrical clear forms suitable for single-image 3D reconstruction. Entire character visible from ears to soles with generous margin. Plain pale warm gray background, neutral even studio illumination, no cast shadow, no scenery, no ground pedestal, no other characters, no text, no watermark, no multiple views. Soft carved/painted game-character materials, readable silhouette, subtle fur surface rather than individual fine hairs. Keep accessories attached simply, no tiny dangling straps.

原始生成文件保留在本机 imagegen 生成目录，项目内副本才是后续上传和游戏生产的来源。图像已目视检查：主体完整、四肢分离、背景干净；细毛细节的重建表现需在模型生成后检查。
