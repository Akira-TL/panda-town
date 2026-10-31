# 对话装饰边框来源

生成日期：2026-10-31。使用内置 imagegen，延续已经选定的童话小镇美术方向；本图用于界面装饰，不承载文字、按钮或数值。

- 原始文件：`C:/Users/Akira/.codex/generated_images/01a18dc3-5013-7e02-8655-f76e7f83338b/exec-1f8a708e-8228-4572-abfd-5c69217a55e0.png`，保留原件。
- 项目文件：`public/art/dialogue-frame.png`。
- 尺寸：1983 × 793 像素，32 位 RGBA。
- 检查：中心与左上角透明通道均为 0，边框抽样透明通道为 253；目视确认为奶油色纸质边沿、金色细线及两个花叶角饰。真实文字与按钮通过界面组件绘制。
- 实际用途：`app/globals.css` 通过 `border-image` 用于真实事件、岔路、选择后果与结算对话的装饰边框；正文、头像、按钮、金额仍是可访问的真实界面元素。
- 缩放方式：四边均以源图 350 像素切分为九宫格，四角使用相同横纵比例缩放；仅中间边沿伸展，不把整幅花叶图拉成长条。桌面绘制宽度 44 像素并向外延伸 8 像素，手机绘制宽度 26 像素并向外延伸 7 像素。透明中心不填充，沿用原有纸张背景，不新增覆盖文字或截获点击的浮层。
- 运行证据：d70a684生产快照已保存真实桌面决策图 `logs/validation-desktop-decision.png`、390像素 `logs/validation-mobile-decision.png` 与360像素 `logs/validation-mobile-360-decision.png`。界面作者已目视桌面和360图，确认压缩目标栏、花叶边框及完整三个选择真实生效，熊猫仍可见，未见横向溢出或边框挡字。截图来自实际三维游戏，不以概念图替代。
- 验收边界：上述证据覆盖该快照的决策界面；全部长文本、最终模型与所有结算/报告状态的逐图对照仍按验收矩阵保留，不能据此宣布整套视觉一致性完成。
- 许可：AI 生成素材单独记录来源，不因源码采用 MIT 而声称所有外部生成资产均已按 MIT 重新授权。

## 完整提示词

> Use case: stylized-concept. Asset type: transparent scalable dialogue-panel decorative frame for Panda Town game UI. Wide landscape frame only, warm ivory parchment rounded rectangular rim with thin antique gold double border, restrained tiny olive leaf and white blossom accents in upper left and lower right corners. Elegant fairytale village game material matching reference; handcrafted premium but simple. Broad large completely transparent central opening for real interface text and buttons, transparent outside the frame; no text, no letters, no icons, no characters, no buttons, no town scene, no opaque center. Frame thickness visually uniform around four edges with plain mid-edge regions suitable for nine-slice border scaling, subtle soft shadow on frame itself only. Output a single isolated UI frame with true alpha transparency.
