import { DATASET_VERSION, getDataIssues, getResearchData } from "../data";
import { number } from "./format";

/** 选择检查路径后呈现实际核查输出，不自动增加主动查看证据。 */
export function ResearchDataSummary() {
  const bars = getResearchData();
  return (
    <section className="research-simulation" aria-label="数据核查的实际输出">
      <h3>核查结果已保留</h3>
      <p>
        {bars[0]?.date} — {bars.at(-1)?.date}，共{bars.length}条研究日期。
        来源为真实历史日线的游戏映射；版本{DATASET_VERSION}。
      </p>
      {getDataIssues().map((issue, index) => (
        <p key={`${issue.date}-${index}`}>
          <strong>
            {issue.date} · {issue.asset === "bamboo" ? "竹材" : "松果"}：
          </strong>
          {issue.field === "close" ? "收盘价" : "成交量"}收到
          {issue.received === null ? "缺失值" : number(issue.received)}， 核验为
          {number(issue.restored)}。{issue.explanation}
        </p>
      ))}
      <p>各条路径都使用同一核验副本；研究段之外的数据尚未在这里展示。</p>
    </section>
  );
}
