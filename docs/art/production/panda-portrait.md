# 熊猫透明头像：真实模型渲染衍生

日期：2026-10-31。此头像由现有游戏角色 GLB 经 Blender 渲染，不是本次 imagegen 输出，不修改角色原模型。

## 来源链

1. 原始角色图为 `panda-tripo-source.png`，由内置 imagegen 参考已选童话小镇生成；原提示词见[生产资产来源](README.md#熊猫角色建模输入)。
2. 用户在 Tripo 生成真实熊猫模型；模型原件、任务标识和许可核对边界见[三维模型来源](models/README.md)。
3. 经项目 Blender 脚本规范化、降面、压缩与绑定骨骼后的实际桌面模型为 `public/models/panda-rigged-v2.glb`。本次读取文件的 SHA256 为 `e8d26b401437579af20d498f5e54df8d82aa52c9dc79d0f094070dc98882e23c`，渲染后复核未改变。
4. [render_panda_portrait.py](render_panda_portrait.py) 在独立后台场景渲染[透明 PNG](panda-portrait.png)，[encode_panda_portrait.py](encode_panda_portrait.py) 再编码为 `public/art/panda-portrait.webp`。

头像保留游戏模型的脸型、眼睛、耳朵、赭金围巾与绿色背包带，没有加入商标或文字。它是图像生成来源所衍生的实际三维渲染资产，可以作为对话和报告头像；不能把这个来源写成本轮新生成的独立 imagegen 图。

## 实际参数与检查

- Blender 5.2.3 LTS，Cycles CPU，32 样本并降噪，帧 1，AgX，曝光 0.15。
- 正交半身构图，完整保留双耳与头部，下缘在胸口；没有地面或投影接收面，使用透明渲染背景。
- 原图：1024×1024、RGBA、1,145,379 字节。运行图：512×512、RGBA WebP、36,448 字节。
- 运行图透明度范围 0–255，完全透明像素 85,097，半透明抗锯齿像素 4,871。左上和右上角透明度均为 0；两个下角为肩部，透明度 255，不能错误宣称四角均透明。
- 已实际查看原 PNG，以及运行 WebP 分别合成在暖纸张与深绿底色上的检查图；双耳未裁切、围巾可辨，没有棋盘格背景或明显黑白边缘光圈。检查图仅保存在 `logs/panda-portrait-on-paper.png` 和 `logs/panda-portrait-on-green.png`，不作为运行资产。
- [渲染报告](panda-portrait.json)和[编码报告](panda-portrait-encoding.json)由真实执行产生。WebP 使用 Pillow 13.0.0，先以预乘透明通道模式缩放，再转回 RGBA，参数 `quality=92`、`method=6`、`exact=True`；不覆盖原 PNG。

此处只验证资产本身，页面接入由协调者处理。现有对话 CSS 的 160 像素放大、负向偏移是给完整角色图裁脸用的；新半身头像应按容器重新设置正常尺寸与位置，不能原样套用旧裁切。报告区可完整显示半身图。当前不以源文件存在代替实际界面截图。

## 可复现命令

在项目根目录执行；两个脚本遇到已存在产物会停止，避免覆盖已经选定的资产。

```powershell
& 'D:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python docs/art/production/render_panda_portrait.py
uv run docs/art/production/encode_panda_portrait.py
```

脚本只读游戏模型，在独立 Blender 后台进程创建照明和相机，不连接或保存用户当前打开的 Blender 工程。

## 本轮图像服务尝试的真实状态

此前对原创透明熊猫半身头像做了一次正常 imagegen 请求。服务在输出阶段返回 `moderation_blocked`，类别 `other`，请求标识 `b1625ee7-45b2-474d-bdf2-7ea952e0a622`；该调用没有生成图像，未重复尝试，也没有把失败调用记作本 PNG 的来源。完整请求为：

> Use case: stylized-concept. Asset type: one original friendly panda half-body portrait for a fairytale village game dialogue and end-of-game report. Reference image 1 is the project's original full-body panda design: preserve the round cream-and-black face, gentle brown eyes, ochre neck scarf and moss-green backpack straps. Reference image 2 establishes the warm handcrafted fairytale rendering style only. Create a NEW square portrait, head and shoulders through upper chest only, facing slightly three-quarter toward the viewer with a calm welcoming smile. Keep the entire ears and head inside generous clear margins, face large and readable at small UI size, both eyes visible, softly rounded forms and restrained fur detail. No hands, full body, other characters, scenery, props, frame, text, letters, logo, symbols, watermark, floor or cast shadow. Even neutral studio illumination, no colored rim glow. Output a single isolated character on a genuinely transparent alpha background, with clean soft fur edges and no checkerboard pattern or painted backdrop.

现有三维模型的再利用没有改变其来源与许可边界；项目源码 MIT 许可不自动扩展为对外部生成模型和全部衍生图像的相同许可声明。

