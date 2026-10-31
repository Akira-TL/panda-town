import type { EvidenceCard } from "../game/profile";

export function TradeEvidence({ evidence }: { evidence: EvidenceCard }) {
  if (!evidence.assetChanges.length) return null;
  return (
    <section className="evidence-result" aria-label="实际资产变化">
      <small>实际资产变化</small>
      {evidence.assetChanges.map((change, index) => {
        switch (change.kind) {
          case "investment-purchase":
            return (
              <div key={index}>
                <strong>购入演示持仓</strong>
                <p>实际投入 {change.amount} 金币</p>
                <p>
                  买入报价 {change.price} · 获得 {change.shares.toFixed(3)} 份
                </p>
                <p>费用 0，按这次实际成交记录展示。</p>
              </div>
            );
          case "investment-sale":
            return (
              <div key={index}>
                <strong>全部退出演示持仓</strong>
                <p>
                  卖出 {change.shares.toFixed(3)} 份，现金到账 {change.amount}。
                </p>
                <p>费用 0，退出后持仓为 0；此处显示实际到账总额。</p>
              </div>
            );
          case "stall-purchase":
            return (
              <div key={index}>
                <strong>接手集市摊位 1 个</strong>
                <p>
                  投入成本 {change.cost}，第 {change.boughtDay} 天接手。
                </p>
                <p>购买当天不产生经营收入。</p>
              </div>
            );
          case "tool-purchase":
            return (
              <div key={index}>
                <strong>
                  {change.quality === "used" ? "二手工具" : "优质工具"}
                  {change.deliveryDay ? "订单已付款" : "已到手"}
                </strong>
                <p>实际支付 {change.cost}。</p>
                {change.deliveryDay && (
                  <p>第 {change.deliveryDay} 天开头交货，当前尚未生效。</p>
                )}
              </div>
            );
          case "story-item":
            return (
              <p key={index}>
                新增 {change.count}{" "}
                项消费纪念或居民经历，不计入金融资产或可用现金。
              </p>
            );
        }
      })}
    </section>
  );
}
