# 本地开发

基础环境使用 Node.js 20.9 以上；本机已核验 Node.js 24.22.2、npm 11.19.1。依赖精确版本由 package-lock.json 锁定，安装使用 `npm ci --cache .cache/npm`。

## 启动与停止

Windows 使用 Git Bash，从项目根目录执行：

```sh
export PATH="/c/nvm4w/nodejs:$PATH"
bash scripts/start.sh
bash scripts/stop.sh
```

默认地址为 http://127.0.0.1:3000，可通过 `PORT=3017 bash scripts/start.sh` 指定端口。仅监听本机。启动脚本在后台运行开发服务，日志位于 logs/dev.log 和 logs/dev-error.log；进程编号保存在 logs/dev.pid。Windows 启动前核验端口是否空闲，并检查进程是否立即退出。停止前核对进程命令包含本项目的 Next.js 路径，防止旧编号误伤其他进程。Windows 后台窗口隐藏。启停也可使用 `npm run dev`、`npm run stop`，二者仍调用同一组脚本。

## 检查

```sh
npm run typecheck
npm test
npm run build
```

测试使用 Node.js 内置测试运行器配合 tsx 直接执行 TypeScript。构建与静态检查无需启动开发服务。公开页面与完整业务流程仍由实施任务接入，基础配置不等于游戏验收完成。

## 版本与兼容性依据

2026-10-31 从 npm 官方注册表实际读取版本及同伴依赖：Next.js 15.4 分支最新修补版为 15.4.11，支持 React `^19.0.0`；采用 React/React DOM 19.3.1。Tailwind CSS 和其 PostCSS 插件均为 4.3.3；Three.js 与 @types/three 均为 0.187.0。TypeScript 使用已核验的 5.9.3，tsx 为 4.23.15。

注册表来源：[Next.js](https://registry.npmjs.org/next)、[React](https://registry.npmjs.org/react)、[Tailwind CSS](https://registry.npmjs.org/tailwindcss)、[Three.js](https://registry.npmjs.org/three)、[TypeScript](https://registry.npmjs.org/typescript)。本机 Node.js 满足 Next.js 声明的运行要求；不升级项目到 Next.js 其他次版本。

三维直接使用 Three.js，避免额外引入 React 渲染适配层。场景模块应在客户端创建和释放渲染器，服务端页面仅承载外壳。全部图片、模型与字体使用本地资源；Next.js 遥测由启停脚本关闭。

## 基础阶段验证

2026-10-31 本机验证：严格类型检查通过，核心与画像合计 20 项测试通过；两份 Bash 脚本在 Git Bash 中语法检查通过。以 3017 端口实际启动 Next.js，日志确认进入 Ready，停止脚本成功结束所属进程树并清空进程记录。该次请求在首页写入前返回 404，不能当作完整页面验收。

首页接入后，本地生产构建通过编译、类型检查及静态页面生成；当次首页首载脚本为 116 kB。此体积只反映当时基础首页，不代表完整三维资产加载预算已达标。Prettier 3.9.10 作为固定开发依赖提供，仅格式化当前任务负责文件。

实际发现本机 3000 端口被其他服务占用后，增加了 Windows 端口预检及进程提前退出检测；未终止该占用者。改用 3017 启动后首页返回 HTTP 200，页面包含本项目标题，日志无启动错误。当前会话的验收地址为 http://127.0.0.1:3017；后续重启仍须通过项目脚本，并核验端口实际归属。
