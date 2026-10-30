# 项目技能安装记录

安装日期：2026-10-31。使用 Skiloom 0.8.15 的公开命令，作用域为当前项目。

| 直接依赖 | 来源 | 已接受的精确提交 |
| --- | --- | --- |
| `akira-tl/skiloom/skiloom` | Git `main` | `f17f585817d4289da96dd2f777bd5102ff8bb9f3` |
| `akira-tl/matt-skills/ask-akira` | Git `main` | `93673d94c6b08f0df1933dc5d102862e8e079697` |

`ask-akira` 入口与其 26 个依赖已安装；另有 Skiloom 入口和 4 个管理依赖，共 32 个受管投影。
实际安装事实由 `skiloom status --scope workspace --json` 返回，本文件仅保留项目初始化记录。
上游尚无正式发行版，初始化使用文档规定的 Git 来源，不使用默认发行版解析。

## 其他机器安装

准备 Skiloom 0.8.15 或更高版本，在仓库根目录运行公开命令。先核对计划，再执行安装：

```sh
skiloom install akira-tl/skiloom/skiloom --git main --scope workspace --plan --json
skiloom install akira-tl/skiloom/skiloom --git main --scope workspace --yes --json
skiloom install akira-tl/matt-skills/ask-akira --git main --scope workspace --plan --json
skiloom install akira-tl/matt-skills/ask-akira --git main --scope workspace --yes --json
```

`main` 将随上游更新；严格复现时以表中提交替代 `main`。不要复制本机受管目录到其他机器。
