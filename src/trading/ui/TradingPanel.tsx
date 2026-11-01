"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getAccountSnapshot, previewTrade } from "../engine";
import { getQuote, LAST_MARKET_INDEX } from "../market";
import {
  evaluateRule,
  getKnowledgePrompt,
  type KnowledgePrompt,
} from "../learning";
import type { useLearningSession } from "../useLearningSession";
import {
  PRODUCT_IDS,
  type ProductId,
  type TradingAction,
  type TradingGame,
} from "../model";
import { getLocationProduct, getProduct } from "../products";
import { LOCATIONS } from "../../game/content";
import { TradingPriceChart } from "./TradingPriceChart";
import { TradingDetails, type DetailSection } from "./TradingDetails";
import { RuleEditor } from "./RuleEditor";
import { KnowledgeCard } from "./KnowledgeCard";
import {
  getShopFact,
  SHOP_LESSONS,
  SHORT_ENTRY_LABELS,
  SHORT_EXIT_LABELS,
} from "./shop-lessons";
import { money, signed, units } from "./format";
import "./trading.css";

export function TradingPanel({
  game,
  onAction,
  quantity,
  onQuantityChange,
  reducedMotion,
  onNext,
  learning,
}: {
  game: TradingGame;
  onAction: (action: TradingAction) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  reducedMotion: boolean;
  onNext?: () => void;
  learning: ReturnType<typeof useLearningSession>;
}) {
  const [dialog, setDialog] = useState<"details" | "rule" | "knowledge" | null>(
    null,
  );
  const [detailSection, setDetailSection] = useState<DetailSection>("overview");
  const [question, setQuestion] = useState<KnowledgePrompt | null>(null);
  const shopProduct = getLocationProduct(game.location);
  const [selectedProduct, setSelectedProduct] = useState<ProductId>(
    shopProduct.id,
  );
  const heading = useRef<HTMLHeadingElement>(null),
    lock = useRef(false);
  const titleId = useId();
  // 反馈始终锁定实际成交商品，不能被背包切换或到达时的默认值覆盖。
  const product = getProduct(
    game.phase === "feedback" && game.feedback
      ? game.feedback.product
      : selectedProduct,
  );
  const lesson = SHOP_LESSONS[product.id];
  const hasHoldings = PRODUCT_IDS.some((id) => game.holdings[id].quantity > 0);
  const atShop = product.id === shopProduct.id;
  const shopName = LOCATIONS.find(
    (location) => location.id === product.shop,
  )!.name;
  const holding = game.holdings[product.id];
  const account = getAccountSnapshot(game);
  const quote = getQuote(product.id, game.marketIndex);
  const prior =
    game.marketIndex > 0 ? getQuote(product.id, game.marketIndex - 1) : null;
  const averageCost =
    holding.quantity > 0 ? holding.costBasis / holding.quantity : null;
  const unrealized = quote.close * holding.quantity - holding.costBasis;
  const selectedArrival = prior
    ? (quote.close - prior.close) * holding.quantity
    : 0;
  const buy = previewTrade(game, "buy", quantity);
  const sell = previewTrade(game, "sell", quantity, product.id);
  const feedback = game.feedback;
  const predictedAssets = account.totalAssets - buy.fee;
  const predictedValue = account.holdingsValue + buy.gross;
  const predictedRatio =
    predictedAssets > 0 ? predictedValue / predictedAssets : 0;
  const rule = learning.state?.rule ?? null;
  const evaluation = rule ? evaluateRule(game, rule, product.id) : null;
  const conditionState = (manual: boolean, value: boolean | null) =>
    manual ? "手动" : value === null ? "预热不足" : value ? "满足" : "未满足";
  const entryState =
    rule && evaluation
      ? conditionState(rule.entry === "manual", evaluation.entry)
      : "手动";
  const exitState =
    rule && evaluation
      ? conditionState(rule.exit === "manual", evaluation.exit)
      : "手动";
  const comparison = product.id === "coffee" && learning.summary;
  const fact = comparison
    ? `我 ${money(account.totalAssets)} · 规则商人 ${money(comparison.opponent.snapshot.totalAssets)}`
    : getShopFact(game, product.id);
  useEffect(() => {
    lock.current = false;
    setDialog(null);
    heading.current?.focus();
  }, [game.phase, game.round]);
  useEffect(() => {
    setSelectedProduct(getLocationProduct(game.location).id);
  }, [game.location, game.round]);
  if (game.phase === "travel" || game.phase === "report") return null;

  function openDetails(section: DetailSection = "overview") {
    setDetailSection(section);
    setDialog("details");
  }
  function openKnowledge() {
    const prompt = learning.state
      ? getKnowledgePrompt(game, learning.state, product.id)
      : null;
    if (!prompt) {
      openDetails("knowledge");
      return;
    }
    setQuestion(prompt);
    setDialog("knowledge");
  }
  function openLesson() {
    if (product.id === "timber") setDialog("rule");
    else if (product.id === "bread" || product.id === "tea") openKnowledge();
    else
      openDetails(
        product.id === "gold"
          ? "allocation"
          : product.id === "coffee"
            ? "comparison"
            : product.id === "flowers"
              ? "cost"
              : product.id === "chips"
                ? "risk"
                : "price",
      );
  }
  function trade(type: "buy" | "sell" | "hold") {
    if (lock.current || game.phase !== "decision") return;
    if (
      (type === "buy" && (!buy.enabled || !atShop)) ||
      (type === "sell" && !sell.enabled)
    )
      return;
    lock.current = true;
    if (type === "hold") setSelectedProduct(shopProduct.id);
    onAction(
      type === "hold"
        ? { type, id: crypto.randomUUID() }
        : type === "sell"
          ? { type, id: crypto.randomUUID(), quantity, product: product.id }
          : { type, id: crypto.randomUUID(), quantity },
    );
  }
  return (
    <section
      className="shop-panel"
      aria-labelledby={titleId}
      data-trading-panel="true"
      data-trading-phase={game.phase}
      data-product={product.id}
      data-reduced-motion={reducedMotion}
      data-has-holdings={hasHoldings}
      data-has-rule={!!rule}
    >
      <header className="shop-heading">
        <img src={product.icon} width={48} height={48} alt="" />
        <div className="shop-heading-copy">
          <h2 ref={heading} tabIndex={-1} id={titleId}>
            {product.name}
          </h2>
          <p>{lesson.title}</p>
        </div>
        <button
          type="button"
          className="shop-info shop-lesson-trigger"
          onClick={openLesson}
        >
          {lesson.action}
        </button>
        <button
          type="button"
          className="shop-info"
          onClick={() => openDetails()}
        >
          资料
        </button>
      </header>
      {((game.phase === "decision" && hasHoldings) || rule) && (
        <div className="shop-position-tools">
          {game.phase === "decision" && hasHoldings && (
            <div
              className="shop-bag"
              role="group"
              aria-label="已有持仓，选择后可跨店卖出"
            >
              {PRODUCT_IDS.filter((id) => game.holdings[id].quantity > 0).map(
                (id) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={id === selectedProduct}
                    aria-label={`查看${getProduct(id).name}持仓${units(game.holdings[id].quantity)}份`}
                    onClick={() => setSelectedProduct(id)}
                  >
                    <img
                      src={getProduct(id).icon}
                      alt=""
                      width={25}
                      height={25}
                    />
                    <span>{units(game.holdings[id].quantity)}</span>
                  </button>
                ),
              )}
              {!atShop && (
                <button
                  type="button"
                  onClick={() => setSelectedProduct(shopProduct.id)}
                >
                  ↩ {shopProduct.name}
                </button>
              )}
            </div>
          )}
          {rule && evaluation && (
            <button
              type="button"
              className="shop-rule-summary"
              data-rule-entry-state={entryState}
              data-rule-exit-state={exitState}
              title={`${evaluation.label}；${evaluation.reason}。仅作条件提示，仍手动交易。`}
              aria-label={`已选规则：${evaluation.label}；入场${entryState}；退出${exitState}。编辑规则`}
              onClick={() => setDialog("rule")}
            >
              <span className="shop-rule-capsules">
                <span>{SHORT_ENTRY_LABELS[rule.entry]}</span>
                <span>≤{rule.allocation * 100}%</span>
                <span>{SHORT_EXIT_LABELS[rule.exit]}</span>
              </span>
              <small>
                入场 {entryState} · 退出 {exitState}
              </small>
            </button>
          )}
        </div>
      )}
      <div className="shop-visuals">
        <div className="shop-chart-area">
          <TradingPriceChart game={game} product={product.id} />
          <p
            className="shop-context-fact"
            data-account-comparison={!!comparison}
          >
            {fact}
          </p>
        </div>
        <div className="shop-trade-desk">
          <dl className="shop-account">
            <div>
              <dt>当前持有</dt>
              <dd>
                {units(holding.quantity)}
                <small>份</small>
              </dd>
            </div>
          </dl>
          {averageCost !== null && (
            <div className="shop-holding-cost">
              <span>含费均价 {money(averageCost)}</span>
              <strong data-profit={unrealized >= 0 ? "up" : "down"}>
                浮盈亏 {signed(unrealized)}
              </strong>
            </div>
          )}
          {game.phase === "decision" && (
            <>
              <div className="shop-quantity">
                <button
                  type="button"
                  aria-label="减少1份"
                  disabled={quantity <= 0.000001}
                  onClick={() =>
                    onQuantityChange(Math.max(0.000001, quantity - 1))
                  }
                >
                  −
                </button>
                <label>
                  <span className="shop-sr-only">交易数量</span>
                  <input
                    aria-label="交易数量"
                    type="number"
                    inputMode="decimal"
                    min="0.000001"
                    step="any"
                    value={Number.isFinite(quantity) ? quantity : ""}
                    onChange={(event) =>
                      onQuantityChange(Number(event.target.value))
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label="增加1份"
                  onClick={() =>
                    onQuantityChange(
                      (Number.isFinite(quantity) ? quantity : 0) + 1,
                    )
                  }
                >
                  +
                </button>
              </div>
              <small className="shop-available">
                可售 {units(holding.quantity)}份
              </small>
              {atShop && buy.enabled && (
                <div className="shop-buy-preview" data-buy-preview="true">
                  <small>买后预览</small>
                  <span>
                    余 {money(buy.cashAfter)} · {units(buy.quantityAfter)}份
                  </span>
                  {product.id === "gold" && (
                    <>
                      <div
                        className="shop-allocation-bar"
                        role="img"
                        aria-label={`买后全部持仓占总资产${(predictedRatio * 100).toFixed(1)}%，其余为现金`}
                      >
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(100, predictedRatio * 100))}%`,
                          }}
                        />
                      </div>
                      <small>
                        买后仓位 {(predictedRatio * 100).toFixed(1)}%
                      </small>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {game.phase === "decision" && holding.quantity > 0 && (
            <p
              className="shop-arrival"
              title="到达本期后、交易前，该商品原有持仓随收盘价变化"
            >
              本品随价 {signed(selectedArrival)}
              <small>全持仓 {signed(game.arrivalDelta)}</small>
            </p>
          )}
        </div>
      </div>
      {game.phase === "decision" ? (
        <div className="shop-actions">
          <button
            type="button"
            disabled={!buy.enabled || !atShop}
            title={atShop ? buy.reason : `到${shopName}买`}
            onClick={() => trade("buy")}
          >
            <strong>{holding.quantity > 0 ? "加仓" : "买入"}</strong>
            <small>
              {!atShop
                ? `到${shopName}买`
                : buy.enabled
                  ? `${units(buy.quantity)}份 · 含费${money(-buy.cashDelta)}`
                  : buy.reason}
            </small>
          </button>
          <button type="button" onClick={() => trade("hold")}>
            <strong>{holding.quantity > 0 ? "持有" : "先看看"}</strong>
            <small>不交易</small>
          </button>
          <button
            type="button"
            disabled={!sell.enabled}
            title={sell.reason}
            onClick={() => trade("sell")}
          >
            <strong>卖出</strong>
            <small>
              {sell.enabled
                ? `${units(sell.quantity)}份 · 净得${money(sell.cashDelta)}`
                : sell.reason}
            </small>
          </button>
        </div>
      ) : (
        <div className="shop-feedback-row">
          <div className="shop-feedback" role="status">
            {feedback?.kind === "hold" ? (
              <strong>
                {holding.quantity > 0 ? "继续持有" : "这轮先看看"}
              </strong>
            ) : (
              feedback && (
                <>
                  <span>
                    现金 {money(game.cash - feedback.cashDelta)} →{" "}
                    <strong>{money(game.cash)}</strong>
                  </span>
                  <span>
                    <img
                      src={product.icon}
                      alt={product.name}
                      width={24}
                      height={24}
                    />
                    <strong>
                      {feedback.holdingDelta > 0 ? "+" : ""}
                      {units(feedback.holdingDelta)}份
                    </strong>
                  </span>
                  <small>费 {money(feedback.fee)}</small>
                </>
              )
            )}
          </div>
          {game.marketIndex >= LAST_MARKET_INDEX ? (
            <button
              className="shop-next"
              type="button"
              onClick={() =>
                onAction({ type: "settle", id: crypto.randomUUID() })
              }
            >
              行情到末尾 · 结算
            </button>
          ) : (
            <button
              className="shop-next"
              type="button"
              disabled={!onNext}
              onClick={onNext}
            >
              下一站 →
            </button>
          )}
        </div>
      )}
      {dialog === "details" && (
        <TradingDetails
          game={game}
          productId={product.id}
          onAction={onAction}
          onClose={() => setDialog(null)}
          learning={learning}
          initialSection={detailSection}
          quantity={quantity}
          onQuantityChange={onQuantityChange}
          onEditRule={() => setDialog("rule")}
          onKnowledge={openKnowledge}
        />
      )}
      {dialog === "rule" && (
        <RuleEditor
          game={game}
          product={product.id}
          learning={learning}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "knowledge" && question && (
        <KnowledgeCard
          key={question.id}
          game={game}
          prompt={question}
          learning={learning}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
