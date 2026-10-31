"use client";
import { useEffect, useRef, useState } from "react";
import { visibleGame, type GameState } from "../game/engine";
import { SessionActions } from "./SessionActions";

const items: Record<string, { name: string; text: string }> = {
  bread: { name: "普通面包", text: "面包店为你包好的熟悉口味。" },
  "bread-gift": { name: "新口味礼盒", text: "面包店主期待下次听听你的感想。" },
  "practical-gift": { name: "实用礼物", text: "朋友托礼品店主向你道谢。" },
  "novel-gift": { name: "新奇礼物", text: "这份惊喜留在你与居民的故事里。" },
  "repair-service": {
    name: "修理摊的感谢",
    text: "你安排师傅修好了摊位。这是一段经历，不是可出售物件。",
  },
};
export function FinalAssetNote({ game }: { game: GameState }) {
  const visible = visibleGame(game);
  return (
    <aside className="retained-assets-note">
      <img src="/art/icon-assets.webp" alt="" />
      <div>
        <strong>结算后保留的资产</strong>
        {!game.assets.stall && !game.assets.investment ? (
          <p>没有保留可出售的摊位或演示持仓。</p>
        ) : (
          <p>
            {game.assets.stall ? "摊位 1 个，终局退出报价 480。" : ""}
            {game.assets.investment
              ? `演示持仓 ${game.assets.investment.shares.toFixed(3)} 份，当前退出价值 ${visible.investmentValue}。`
              : ""}
          </p>
        )}
        <small>保留资产没有计入开店现金；工具与消费纪念物不能单独变现。</small>
      </div>
    </aside>
  );
}
export function InventoryPanel({
  game,
  onRestart,
  onClear,
}: {
  game: GameState;
  onRestart: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const visible = visibleGame(game);
  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  const toolPurchase = [...game.evidence]
    .reverse()
    .find(
      (e) =>
        e.action === "choose" &&
        e.options.some(
          (o) =>
            o.id === e.choice &&
            (o.effect.kind === "buy-tool" || o.effect.kind === "cooperate"),
        ),
    );
  const toolCost = toolPurchase?.options.find(
    (o) => o.id === toolPurchase.choice,
  )?.cost;
  return (
    <>
      <button
        className="inventory-trigger"
        aria-label="资产与旅程手记"
        ref={trigger}
        onClick={() => setOpen(true)}
      >
        <img src="/art/icon-assets.webp" alt="" />
        <span className="inventory-label-full">资产与旅程手记</span>
        <span className="inventory-label-short">手记</span>
        <b>↗</b>
      </button>
      {open && (
        <div className="evidence-backdrop" onClick={close}>
          <section
            className="evidence-sheet inventory-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-heading"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Tab") {
                const controls = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                );
                const first = controls[0],
                  last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <header>
              <span className="eyebrow">第 {game.day} 天 · 筹备手记</span>
              <button
                className="sheet-close"
                ref={closeButton}
                aria-label="关闭资产手记"
                onClick={close}
              >
                ×
              </button>
              <h2 id="inventory-heading">钱、资产，还有小镇的心意。</h2>
              <p>开店只看可用现金，保留资产不会自动变现。</p>
            </header>
            <SessionActions onRestart={onRestart} onClear={onClear} />
            <div className="inventory-cash">
              <img src="/art/icon-cash.webp" alt="" />
              <span>
                当前现金<strong>{game.cash.toLocaleString("zh-CN")}</strong>
              </span>
            </div>
            <details className="opponent-journal">
              <summary>隔壁店长的进度</summary>
              <p>
                当前现金 {game.opponent.cash.toLocaleString("zh-CN")}，
                {game.opponent.stallBoughtDay
                  ? `第 ${game.opponent.stallBoughtDay} 天起接手摊位。`
                  : "尚未接手摊位。"}
              </p>
              <p>他会按自己的节奏经营，先筹齐资金也不会结束你的八天旅程。</p>
            </details>
            <h3 className="inventory-category">经营与投资</h3>
            {!game.assets.stall && !game.assets.investment && (
              <p className="inventory-empty">
                还没有经营或投资资产。通过临时工作筹备，同样可以开店。
              </p>
            )}
            {game.assets.stall && (
              <article className="inventory-item">
                <span className="inventory-symbol">⌂</span>
                <div>
                  <h3>
                    集市摊位 <small>1 个</small>
                  </h3>
                  <p>投入成本 600 · 第 {game.assets.stall.boughtDay} 天接手</p>
                  <p>
                    {game.assets.stall.boughtDay < game.day
                      ? "已经开始经营，收入在每回合末到账。"
                      : "购买当天不产生收入，下一回合开始经营。"}
                  </p>
                  <strong>终局退出价 480</strong>
                  <small>第八天自主选择出售或保留。</small>
                </div>
              </article>
            )}
            {game.assets.investment && (
              <article className="inventory-item">
                <span className="inventory-symbol">↗</span>
                <div>
                  <h3>
                    演示投资 <small>一笔持仓</small>
                  </h3>
                  <p>
                    投入 {game.assets.investment.cost} · 买入报价{" "}
                    {game.assets.investment.purchasePrice}
                  </p>
                  <p>
                    份额 {game.assets.investment.shares.toFixed(3)} · 当前报价{" "}
                    {visible.price}
                  </p>
                  <strong>当前全部退出可得 {visible.investmentValue}</strong>
                  <small>费用为 0，卖出金额四舍五入；报价还可能变化。</small>
                </div>
              </article>
            )}
            <h3 className="inventory-category">开店工具</h3>
            {game.assets.tool.status === "none" ? (
              <p className="inventory-empty">
                尚未采购工具。工具只有配合经营摊位才增加收入。
              </p>
            ) : (
              <article className="inventory-item">
                <span className="inventory-symbol">⚒</span>
                <div>
                  <h3>
                    {game.assets.tool.status === "pending"
                      ? "合购优质工具"
                      : game.assets.tool.quality === "used"
                        ? "二手工具"
                        : "优质工具"}
                  </h3>
                  <p>实际采购成本 {toolCost ?? "已记录"}</p>
                  {game.assets.tool.status === "pending" ? (
                    <strong>
                      第 {game.assets.tool.deliveryDay} 天开头交货，尚未生效
                    </strong>
                  ) : (
                    <strong>
                      每次摊位经营收入额外 +
                      {game.assets.tool.quality === "used" ? 20 : 40}
                    </strong>
                  )}
                  <small>不能重复采购或单独变现，没有摊位时不产生收益。</small>
                </div>
              </article>
            )}
            <h3 className="inventory-category">居民与旅程回顾</h3>
            {game.assets.items.length ? (
              game.assets.items.map((id) => (
                <article className="journey-item" key={id}>
                  <span>❧</span>
                  <div>
                    <strong>{items[id]?.name ?? "小镇纪念"}</strong>
                    <p>{items[id]?.text ?? "本局留下的一段经历。"}</p>
                    <small>不计入金融资产 · 无变现价值</small>
                  </div>
                </article>
              ))
            ) : (
              <p className="inventory-empty">
                这次还没有消费纪念物。没有购买不会自动解释为不感兴趣。
              </p>
            )}
            <button className="secondary inventory-return" onClick={close}>
              收好手记，回到小镇 ↗
            </button>
          </section>
        </div>
      )}
    </>
  );
}
