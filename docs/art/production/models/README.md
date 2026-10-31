# 三维模型加工

熊猫由用户在 Tripo 现场生成，页面设置为 H3.1、Geometry & Texture。主 Agent 从用户 Downloads 中已有的原件接收，校验 GLB 2 文件头及声明长度后复制为 `panda-source.glb`；浏览器导出动作没有成功回执，不能将接收原件写成已成功自动下载。

来源页面：[Tripo 模型生成工作区](https://studio.tripo3d.ai/workspace/generate)，任务标识 `9c2181af-b0a1-4829-80da-de46d8d352ec`；尚未取得该任务专属链接，不拼接未核实的参数。原件 SHA256：`8FFF0276791F4B750B944790288C4093BE2F20BA42189C45C38EC527A407D80C`。

许可依据 [Tripo 条款第 5.2 节](https://www.tripo3d.ai/terms)，仍需核对生成时账号计划与导出许可；不将模型自动改标为 MIT。

## 后台加工

使用 `scripts/assets/prepare_model.py`，另起 Blender 后台进程，不连接或修改用户当前未保存的 Blender 窗口。示例在项目根目录执行：

```powershell
& 'D:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python 'scripts/assets/prepare_model.py' -- --source 'docs/art/production/models/panda-source.glb'
```

默认输出：

- `panda-normalized.blend`：保留高精度网格、材质、纹理及已有动画，统一至 2.1 米高度并接地，压缩保存。
- `public/models/panda.glb`：桌面档，目标约 12 万三角面，纹理最长边 2048 像素。
- `public/models/panda-mobile.glb`：手机档，目标约 3 万三角面，纹理最长边 1024 像素。
- `panda-report.json`：原始与两档文件的顶点、三角面、材质、纹理、UV 层、动画名称、大小和尺寸。
- `panda-front.png`、`panda-back.png`：桌面档独立预览。预览失败会在报告中保留说明，不冒充已经检查。

目标面数是制作起点，须依实际轮廓和眼睛、耳朵、背包、纹理接缝检查调整。手机档从高精度规范化源单独处理，避免在桌面降面结果上继续简化。脚本不生成骨骼或动画，也不自动宣称许可完成。

面包店可用 `--name bakery --height 4.4`，目标面数与纹理限制均可显式指定。脚本拒绝覆盖已有产物；需要新一轮试制时使用新名称，选定版本后再明确替换游戏路径。

## 实际加工结果

主 Agent 已使用 Blender 5.2.3 LTS 执行脚本，报告见 `panda-report.json`，前后预览为 `panda-front.png`、`panda-back.png`。

| 文件 | 三角面 | 纹理最长边 | 文件大小 |
| --- | --- | --- | --- |
| 原始 GLB | 1,979,761 | 4096 | 65,427,740 字节 |
| 桌面 GLB | 119,999 | 2048 | 15,152,172 字节 |
| 手机 GLB | 29,999 | 1024 | 4,260,332 字节 |

规范化高模 Blender 源约 82.13 MB，与原始 GLB 均在本机保留。源模型有一套 UV 和颜色、粗糙度／金属度、法线三类纹理，没有骨骼动画。两档保留 UV 与上述材质贴图；目视预览中的眼耳、背包和轮廓基本完整，毛发存在简化后的锐片，仍需在游戏镜头中检查。此阶段交付静态模型，不宣称已有行走动作或视觉最终达标。
