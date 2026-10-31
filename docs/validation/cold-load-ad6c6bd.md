# 关闭缓存后的真实加载预算

2026-10-31，隔离生产快照ad6c6bd。通过浏览器调试协议关闭超文本传输协议（Hypertext Transfer Protocol, HTTP）缓存后，记录浏览器报告的编码响应长度；从欢迎页、十类模型与七名居民全部加载，到真实八天工作路线及画像报告。两项测试通过33.9秒，未失败、跳过或重试。

## 环境与结果

系统Edge 156.0.4314.50，在同一台Windows电脑上分别使用1440×900和390×844视口。390是移动布局模拟，不代表实体手机或移动网络。

| 测量阶段 | 桌面 | 390布局 | 规格目标 |
| --- | ---: | ---: | ---: |
| 欢迎页全部请求结束 | 596,834字节 | 596,834字节 | 首屏不超过15,000,000字节 |
| 十模型与七居民已加载 | 30,411,459字节 | 10,863,212字节 | 包含在首局总量内 |
| 八天工作、结算并打开画像 | 31,704,284字节 | 12,156,037字节 | 首局不超过40,000,000字节 |
| HTTP状态400以上 | 0 | 0 | 资源没有请求失败 |

两种布局的欢迎页与本条完整首局路线均在预算内。该测量按每个请求实际收到的总字节累计，和此前资源计时中的编码正文合计区别记录；字段含义与关闭缓存操作已核对[官方协议定义](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Network.pdl)。它只覆盖该条实际路线，未穷尽所有不同事件与可能的延迟界面资源，也不代表实际网络下载时长或实体手机帧率。

## 复现方式

先按展会指南构建并通过`scripts/start.sh`启动3018生产模式，再运行：

```sh
npm run test:browser -- load-budget.spec.ts
```

`tests/browser/load-budget.spec.ts`在浏览器导航前调用`Network.setCacheDisabled`，按请求标识汇总`Network.loadingFinished.encodedDataLength`；本局通过公开按钮、实际掷骰和工作操作推进，不注入存储或伪造结果。原始逐资源清单分别为[桌面](evidence/cold-load-ad6c6bd-desktop.json)、[移动布局](evidence/cold-load-ad6c6bd-mobile-viewport.json)，两项原始运行结果见[测试报告](evidence/cold-load-ad6c6bd-results.json)。

## 首轮失败及实际修复

90b1bc2首轮桌面虽在预算内，但缺少网站图标元数据，浏览器请求`/favicon.ico`得到404，严格的资源成功断言因此失败；移动例因首错停止而未执行。该次桌面欢迎页582,280字节、完整路径31,689,096字节，不能写成两端预算测试通过。记录保留于`logs/playwright-cold-load-90b1bc2-initial-results.json`。

ad6c6bd在页面元数据中声明现有17KB熊猫WebP图标后重新构建。两布局实际复测均无404，完整路径仍在预算内。修复没有删去错误断言或忽略图标请求。
