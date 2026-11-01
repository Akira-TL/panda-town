import type {
  FinalDecision,
  ResearchIntent,
  StrategyRule,
  ValidationStatus,
} from "../model";

export const ruleNames: Record<StrategyRule, string> = {
  trend: "走势走强时参与",
  reversion: "偏离均价后尝试回归",
  hold: "固定比例持有",
};
export const intentNames: Record<ResearchIntent, string> = {
  return: "争取更多收益",
  risk: "控制中途损失",
  cost: "减少操作与费用",
};
export const validationNames: Record<ValidationStatus, string> = {
  unseen: "尚未查看新数据",
  checked: "已检验这段新数据",
  deferred: "本局暂缓检验",
  "needs-new-data": "修改后还需另一批新数据",
};
export const decisionNames: Record<FinalDecision, string> = {
  simulate: "愿意先做小规模模拟",
  revise: "保留展品，继续修改",
  defer: "展示过程，暂不采用",
};
export function number(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
    : "暂无结果";
}
export function percent(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "暂无结果";
}
