# Panda Town

面向 PandaAI 赛道的三维童话小镇游戏：玩家掷骰子沿弯曲街道自动行走，在岔路、商店与角色事件中选择，经营生活与资产，并查看带行为证据的消费偏好与一般人格特征反馈。

**用户已授权完成24项任务，当前进入资产生产与实现阶段；可运行状态以实际验收证据为准。**

## 本机项目位置与运行入口

Windows 的“文档”目录可能因 OneDrive 设置而迁移。使用系统返回的实际目录定位项目，不固定使用旧 OneDrive 路径。在 PowerShell 中执行：

```powershell
$documentsPath = [Environment]::GetFolderPath('MyDocuments')
Set-Location -LiteralPath (Join-Path $documentsPath 'ChatGPT\大富翁')
```

本次迁移后，“文档”目录为 `%USERPROFILE%\Documents`。源码、Git 历史、模型和未提交修改均已在新位置核实。应用启停仍使用项目 `scripts/` 中的脚本，步骤见[本地运行说明](docs/validation/local-validation.md)；完整进度见[任务验收矩阵](docs/validation/task-status.md)。三维画面与模型仍在制作，不能仅凭八回合可运行就认定全部视觉任务完成。

## 规格与实现范围

- [首版完整规格草案](docs/specs/panda-town.md)
- [24 项任务草案与并行依赖](docs/plans/task-breakdown.md)
- [十二类事件与十六处场景](docs/design/event-catalog.md)
- [视觉生产：效果图 → 元素资产 → 三维实现 → 对照验收](docs/design/visual-production.md)

- [已确认的产品方向](docs/product-brief.md)
- [领域概念](CONTEXT.md)
- [画像研究的候选依据](docs/research/profile-foundations.md)
- [成熟玩法研究](docs/research/gameplay-cases.md)
- [玩法与三维场景方案](docs/gameplay-direction.md)
- [用户画像面板内容方案](docs/profile-panel.md)
- [GitHub 决策与问题](https://github.com/Akira-TL/panda-town/issues)
- [项目技能安装记录](docs/agents/skills-setup.md)

## 已选择的美术方向

![童话小镇：第三人称与全局俯瞰概念图](docs/art/fairytale-town-reference.png)

此图由 OpenAI imagegen 生成，用于美术讨论；不是游戏运行截图，也不是已经完成的三维模型。

## 开源与数据

源码采用 [MIT 许可证](LICENSE)。图像和其他材料的来源见 [素材记录](docs/art/README.md)。
首版使用明确标注的演示数据，Panda Data 权限尚未开通。赛事资料包和账号凭据不纳入公开仓库。

