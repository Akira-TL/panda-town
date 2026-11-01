# 检验记录徽章元素

2026-10-31，使用内置imagegen，以 `compact-report-concept.png` 左下检验记录卡为风格参考，单独生成透明盾牌、勾选与小折线纸张元素。原输出 `exec-794276a8-228b-4d32-b88c-0650ab2c0efd.png` 保存在本目录 `verification-badge.png`；运行原样副本为 `/art/research/verification-badge.png`。

```text
Use case: stylized-concept. Asset type: ONE usable transparent verification-record badge icon for Panda Town game result card. Use the attached compact report concept as color/material/style reference, especially its lower-left verification-record card. Generate a single isolated complete golden shield with a simple embossed check mark, with one small cream parchment data sheet slightly behind it showing a tiny forest-green line chart. Warm cream, forest green, soft brushed gold, polished painterly 3D storybook inventory icon, not photoreal metal. Bold clean readable silhouette at 34 to 60 pixels, centered with safe margin, simple composition. A verification RECORD motif only, no certification text or guarantee of future profits. Genuinely transparent background with preserved alpha, not a baked checkerboard. No scene, no shop, no building, no coin piles, no panda, no letters, no numbers, no words, no labels, no watermark, no rectangular card around the object. This isolated icon will be placed beside real state-driven text, which separately says checked/deferred/needs-new-data.
```

已实际查看：主体为金色盾牌与勾选、奶油纸折线和少量绿叶，完整单物体、无文字。PNG直接复制使用，不重绘或裁切，不增加优化等待。只替换 `ResearchReport.tsx` 中“检验记录”卡的图片路径；布局、文案及行为不变。图形表示检验记录，当前“已检验／暂缓／待新数据”仍由真实状态文本决定，不表示认证通过或收益保证。

`validate_badge.py` 使用Pillow只读校验PNG可解码、真实RGBA、透明范围和四角透明度，结果保存为 `verification-badge-validation.json`。本次实际alpha为0–254，四角均为0；254是生成图主体的最大覆盖值，不修改为255，也不虚报完全不透明像素。
