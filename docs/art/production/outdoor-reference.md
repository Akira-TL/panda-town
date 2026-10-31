# 户外地点局部效果参考

生成日期：2026-10-31。使用内置 imagegen，以 `docs/art/fairytale-town-reference.png` 为画风参考。

- 项目文件：`docs/art/production/outdoor-reference.png`，1983×793 像素，3,022,764 字节。
- 原始输出：`C:/Users/Akira/.codex/generated_images/01a18fad-5f32-7150-b34c-8217eed16f2e/exec-36a41355-bbba-489f-92b9-4efc61f91540.png`，保留原件。
- 类型与用途：户外地点的概念效果图，用于制作 `src/scene/outdoors.ts` 中真实几何的轮廓、比例和材质关系；不是运行截图、不是三维模型，也不是新的 Tripo 建模输入。
- 目视检查：修理台及工具、花架长椅、音乐小台与乐器、木框告示、观景栏杆和栈板码头均可辨认，沿弯路摆放并留出人物位置。没有棋盘格、界面文字或重新设计整镇布局。
- 实际元素：制作时继续复用现有 imagegen 木材、灰泥和布篷纹理的 WebP 运行副本；地名使用界面生成的清晰中文文字，不把概念图中的图形当作正式文字。
- 与已有场景的关系：`scenery.ts` 已有中央铺石广场与小喷泉，户外模块不重复创建喷泉；广场停靠点只补迎宾物件。所有停靠点坐标沿用 `LOCATION_POSITIONS`，道具离开道路中心并保留人物站立空间。
- 验收边界：本图先于户外几何实现保存；实际场景仍须接入后分别核对跟随与全局镜头、四个支路事件的可玩链及手机遮挡，不能用本图代替运行证明。
- 许可：AI 生成素材单独记录来源，不把源码 MIT 许可自动扩展为对所有生成素材的再授权声明。

## 完整提示词

> Use case: stylized-concept. Asset type: local outdoor district reference render for the existing Panda Town 3D game, not a whole-town replacement and not a model input. Input image: reference only for established warm fairytale art direction, rounded panda scale, cream timber surfaces, green foliage and soft sunlight. Generate a new single coherent landscape three-quarter view of a curved pedestrian side street descending to a small riverside timber dock. Show clearly four modest, recognizable outdoor activity places along the same street: an open oak repair workbench with vice and a few visible hand tools under a small cream-green cloth shade; a garden seating nook with slatted wooden bench, climbing-flower arch and terracotta planters; a tiny round timber music platform with a cello/guitar, music stand and small drum; a riverside dock with real separate planks, two tied crates, mooring posts and a coiled rope. Include a modest framed notice board and short timber viewing rail near the river, no new central fountain. Match the reference with refined tactile wood, aged brass, pale stone, lush but restrained flowers, warm neutral daylight and soft contact shadows. Keep every activity area outside the walking path, with clear empty standing space for a panda beside each. Composition: readable separated silhouettes, each small location visible without one hiding the others; no grid tiles, no straight road, no modern screens, no interface overlays, no printed labels or letters, no watermark. All important props have solid three-dimensional geometry. Use fewer carefully composed objects rather than clutter. Existing overall layout and lighting will be preserved in code; this image establishes the local props, proportions and materials.
