# 独立图标生成记录

2026-10-31 使用内置 imagegen，每个文件对应一次独立生成；参考 `town-overview.png` 的童话小镇美术方向。负责人：资产与设计 Agent。生成图为栅格资产，不是三维模型。游戏用副本位于 `public/art/`，同名生产原图保留在本目录。未宣称获得第三方品牌授权；项目源码的 MIT 声明不自动改变图像来源和服务条款。

| 稳定标识／文件 | 尺寸 | 文件字节数 | 透明检查 | 用途与接入 |
| --- | --- | --- | --- | --- |
| cash／icon-cash.png | 1536×1024 | 1318296 | 32 位 ARGB，角点透明度 0 | 现金界面图标；交付界面负责人接入 |
| assets／icon-assets.png | 1368×1150 | 1532585 | 32 位 ARGB，角点透明度 0 | 持有摊位资产图标；交付界面负责人接入 |
| information／icon-information.png | 1536×1024 | 1528974 | 32 位 ARGB，角点透明度 0 | 资料记录图标；交付界面负责人接入 |

目视检查：三图单一主体、没有拼版边框及文字，边缘存在真实透明通道；现金与资料图有柔光外缘，较小尺寸可读性仍需运行界面检查。摊位含藤蔓、灯笼，32 像素显示会损失细节，不据此声称手机画面已验收。

## 现金提示词

Use case: stylized-concept. Asset type: single transparent cash UI icon for Panda Town. Reference image is art style only: warm fairy tale town, handcrafted softly rounded game props, muted warm colors. Generate ONE isolated small stack of three golden coins with simple embossed circular rims, no letters or currency symbols. Three-quarter view, centered, large readable silhouette, warm neutral studio illumination, no floor, no cast shadow, no frame, no text, no watermark, no other objects. True transparent alpha background, generous transparent margin. Must remain readable at 32 pixels. This icon represents cash, not investment growth.

## 资产提示词

Use case: stylized-concept. Asset type: single transparent assets UI icon for Panda Town. Reference image is art style only: warm fairy tale town, handcrafted softly rounded game props, muted warm colors. Generate ONE isolated miniature wooden market stall with cream canvas canopy and empty counter, no coins, no produce. Simple strong silhouette three-quarter front view, centered, warm neutral studio illumination, no floor, no cast shadow, no frame, no letters or text, no watermark, no other objects. True transparent alpha background and generous transparent margin. Must remain readable at 32 pixels. This icon represents an owned market stall asset, not a home.

## 资料提示词

Use case: stylized-concept. Asset type: single transparent information evidence UI icon for Panda Town. Reference image is art style only: warm fairy tale town, handcrafted softly rounded game props, muted warm colors. Generate ONE isolated open cream-paper notebook with warm brown cloth binding, a few simple green horizontal lines on its pages to imply records. No readable text, no numbers, no chart, no magnifying glass or surrounding objects. Simple strong silhouette three-quarter front view, centered, warm neutral studio illumination, no floor, no cast shadow, no frame, no watermark. True transparent alpha background and generous transparent margin. Must remain readable at 32 pixels. Icon represents information records and sources, no psychological scoring.

## 未生成的头像

熊猫头像的独立 imagegen 调用在输出阶段被服务安全系统拒绝（`moderation_blocked`），没有生成文件，未尝试规避。现有 `panda-tripo-source.png` 是不透明完整角色建模参考，不能冒称独立透明头像。T01 对应条件仍未满足。
