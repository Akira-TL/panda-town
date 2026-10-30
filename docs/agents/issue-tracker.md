# GitHub 问题管理

仓库：`Akira-TL/panda-town`。需求、缺陷、决策问题和实施任务使用 GitHub Issues，通过 `gh` 操作。
角色标签映射见 `triage-labels.md`。默认从 `git remote -v` 确认仓库；跨仓操作显式指定 `--repo`。

## 常用操作

- 创建：`gh issue create --title '标题' --body-file '<正文文件>' --label '<标签>'`。
- 读取：`gh issue view <编号> --comments`。
- 列表：`gh issue list --state open --json number,title,body,labels`。
- 更新正文：`gh issue edit <编号> --body-file '<正文文件>'`。
- 评论：`gh issue comment <编号> --body-file '<正文文件>'`。
- 标签：`gh issue edit <编号> --add-label '<标签>'` 或 `--remove-label`。
- 检查标签：`gh label list --limit 1000 --json name,color,description`。
- 创建缺失标签：`gh label create '<标签>' --description '<中文说明>' --color '<颜色>'`；不使用 `--force`。
- 完成：核验验收项，勾选已满足条目，记录证据，移除 `ready-for-agent`，再 `gh issue close <编号>`。

多行正文必须通过 UTF-8 文件与 `--body-file` 传入。先核对已存在的同目的问题，避免重复创建。
仅完成子任务不能关闭父需求；未满足的验收项必须保持未勾选。

## 外部拉取请求

PRs as a request surface: no.

不把外部拉取请求自动当作需求分诊入口。

## 任务依赖和领取

先检查当前 `gh issue create --help`、`gh issue edit --help` 和只读字段探测，不根据版本号猜测能力。
支持原生依赖参数时使用它们，否则用 GitHub REST 接口：

1. `gh api repos/{owner}/{repo}/issues/<阻塞者> --jq .id` 获取数据库编号。
2. `gh api --method POST repos/{owner}/{repo}/issues/<被阻塞者>/dependencies/blocked_by -F issue_id=<编号>`。
3. `gh api --paginate repos/{owner}/{repo}/issues/<被阻塞者>/dependencies/blocked_by` 核对依赖。

只有该接口也不可用时，才在正文使用 `Blocked by: #<编号>` 记录替代关系。
选择无未解决依赖、无有效领取记录的任务；不同 GitHub 账号可用 `--add-assignee @me` 表示领取。
多个 Agent 共用账号时，遵循实际加载的协调协议，不能把同一个受让人字段当作互斥锁。

## 决策探索任务

`wayfinder:map` 表示总览，其余 `wayfinder:*` 表示对应决策子任务。
子任务关系优先使用经探测支持的原生命令，否则用 `sub_issues` 接口和 `sub_issue_id`。
接口不可用时才使用父任务清单及 `Part of #<编号>`。解决时回写决策与证据，不把尚未实现的功能标成完成。

