"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { LOCATIONS } from "../src/game/content";
import type { AssetStatus } from "../src/scene/TownScene";
import { DiceFace } from "../src/ui/GameDetails";
import { GameDialog } from "../src/ui/GameDialog";
import { SessionActions } from "../src/ui/SessionActions";
import { useTradingSession } from "../src/trading/useTradingSession";
import { useLearningSession } from "../src/trading/useLearningSession";
import { getAccountSnapshot } from "../src/trading/engine";
import { getMarketDate, getQuote, LAST_MARKET_INDEX } from "../src/trading/market";
import { getLocationProduct, PRODUCTS } from "../src/trading/products";
import type { TradingAction } from "../src/trading/model";
import { TradingPanel } from "../src/trading/ui/TradingPanel";
import { TradingReport } from "../src/trading/ui/TradingReport";
import "./globals.css";
import "./research-shell.css";
import "./shop-shell.css";

const TownScene = dynamic(() => import("../src/scene/TownScene"), {
  ssr: false,
  loading: () => <div className="scene-loading">小镇正在醒来……</div>,
});
const money = (value: number) => value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
type Menu = "settings" | "holdings" | "data" | null;

export default function Home() {
  const [cameraMode, setCameraMode] = useState<"follow" | "overview">("follow");
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [quantity, setQuantity] = useState(1);
  const [sceneError, setSceneError] = useState("");
  const [assetStatus, setAssetStatus] = useState<AssetStatus | null>(null);
  const [hiddenLearningNotice, setHiddenLearningNotice] = useState("");
  const branchHeading = useRef<HTMLHeadingElement>(null);
  const { session, hydrated, notice, setNotice, begin, clear, onAction, roll, chooseBranch } =
    useTradingSession(reducedMotion, menu !== null);
  const learning = useLearningSession(session?.game ?? null);
  const visibleNotice = notice || (learning.notice !== hiddenLearningNotice ? learning.notice : "");
  const onError = useCallback((message: string) => setSceneError(message), []);
  const onAssetStatus = useCallback((status: AssetStatus) => setAssetStatus(status), []);
  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (session?.branch) branchHeading.current?.focus();
  }, [session?.branch]);
  useEffect(() => {
    setQuantity(1);
  }, [session?.game.round, session?.game.location]);
  function restart() {
    const deleted = learning.clear();
    setMenu(null);
    setHiddenLearningNotice("");
    begin();
    if (!deleted) setNotice("新局已开始；设备拒绝删除旧学习存储，旧记录可能残留。");
  }
  function clearRecord() {
    const deleted = learning.clear();
    setMenu(null);
    clear();
    if (!deleted) setNotice("画面已清除，但设备拒绝删除学习存储，旧记录可能残留。");
  }
  function action(next: TradingAction) {
    onAction(next);
  }
  function nextShop() {
    if (session && session.game.marketIndex >= LAST_MARKET_INDEX) {
      setNotice("这段历史播完了，可在设置中结算。");
      return;
    }
    roll();
  }
  if (!hydrated) return <main className="scene-loading">准备出发……</main>;
  if (!session)
    return (
      <main className="welcome">
        <img className="welcome-art" src="/art/town-overview.webp" alt="童话小镇概念图" />
        <div className="welcome-shade" />
        <section className="welcome-card">
          <span className="eyebrow">PANDA TOWN · 小镇交易节</span>
          <h1>
            看懂涨跌，
            <br />
            <em>做自己的买卖。</em>
          </h1>
          <p>带1000枚小镇币，看看自己的办法能走多远。</p>
          <button className="primary large" onClick={restart} aria-label="开始小镇交易">
            出发 ↗
          </button>
          <p className="welcome-footnote">掷骰逛店 · 设置中随时结算</p>
          {visibleNotice && (
            <p className="notice" role="status">
              {visibleNotice}
            </p>
          )}
          <small>模拟资金 · 进度留在本机</small>
        </section>
      </main>
    );
  const game = session.game;
  const account = getAccountSnapshot(game);
  const place = LOCATIONS.find((item) => item.id === session.position)!;
  const decisionOpen = game.phase !== "travel" || session.branch;
  return (
    <main className={`game-shell quant-game shop-game ${decisionOpen ? "has-dialogue" : ""}`}>
      <div className="scene">
        <TownScene
          playerLocation={session.position}
          cameraMode={cameraMode}
          cameraResetKey={cameraResetKey}
          stallOwned={false}
          cafeOpened={false}
          decisionOpen={decisionOpen}
          reducedMotion={reducedMotion}
          onError={onError}
          onAssetStatus={onAssetStatus}
        />
      </div>
      <header className="hud">
        <div className="wordmark">
          <img src="/art/panda-portrait.webp" width={36} height={40} alt="" />
          <div>
            熊猫小镇 <span>PANDA TOWN</span>
          </div>
        </div>
        <div className="day-counter" aria-label={`第${game.round}轮`}>
          <strong>{game.round || "—"}</strong>
          <span>轮</span>
        </div>
        <div className="trading-wallet" aria-label="当前账户">
          <div className="wallet-card">
            <img src="/art/icon-cash.webp" width={34} height={34} alt="" />
            <div>
              <span>现金</span>
              <b>{money(account.cash)}</b>
            </div>
          </div>
          <div className="wallet-card">
            <img src="/art/icon-assets.webp" width={34} height={34} alt="" />
            <div>
              <span>总资产</span>
              <b>{money(account.totalAssets)}</b>
            </div>
          </div>
        </div>
      </header>
      <nav className="view-controls" aria-label="视角和设置">
        <button
          className={cameraMode === "follow" ? "selected" : ""}
          aria-pressed={cameraMode === "follow"}
          onClick={() => {
            setCameraMode("follow");
            setCameraResetKey((value) => value + 1);
          }}
          title="重新对准主角与门面；可拖动旋转"
        >
          跟随
        </button>
        <button
          className={cameraMode === "overview" ? "selected" : ""}
          aria-pressed={cameraMode === "overview"}
          onClick={() => setCameraMode("overview")}
        >
          全局
        </button>
        <button onClick={() => setMenu("settings")} aria-label="设置，随时结算">
          设置
        </button>
      </nav>
      <div className="scene-status">
        <span>历史映射 · 未接PandaData</span>
        {assetStatus?.missing.length ? <span>部分素材未加载</span> : null}
      </div>
      {visibleNotice && (
        <div className="toast" role="status">
          {visibleNotice}
          <button
            aria-label="关闭提示"
            onClick={() => {
              setNotice("");
              setHiddenLearningNotice(learning.notice);
            }}
          >
            ×
          </button>
        </div>
      )}
      {sceneError && (
        <aside className="scene-error" role="alert">
          <strong>画面暂时中断</strong>
          <p>{sceneError}</p>
          <button onClick={() => location.reload()}>刷新重试</button>
        </aside>
      )}
      {game.phase === "travel" && !session.branch && (
        <section className="travel-panel">
          <span className="location-label">{place.name}</span>
          {session.rolled ? (
            <>
              <strong aria-live="polite">还剩{session.remaining}步</strong>
              <DiceFace value={session.die} rolling={!reducedMotion} />
            </>
          ) : (
            <button className="primary roll-button" onClick={nextShop} aria-label="掷骰出发">
              <DiceFace value={5} />
              <span>掷骰</span>
              <b>↗</b>
            </button>
          )}
        </section>
      )}
      {session.branch && (
        <section className="dialogue compact" aria-label="选择岔路">
          <h2 ref={branchHeading} tabIndex={-1}>
            往哪边？
          </h2>
          <div className="choices">
            {place.next.map((id) => {
              const product = getLocationProduct(id);
              return (
                <button className="choice" key={id} onClick={() => chooseBranch(id)}>
                  <img src={product.icon} width={44} height={44} alt="" />
                  <div>
                    <strong>{LOCATIONS.find((item) => item.id === id)!.name}</strong>
                    <small>
                      {product.name} · 已知价{money(getQuote(product.id, game.marketIndex).close)}
                    </small>
                  </div>
                  <span>↗</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <TradingPanel
        game={game}
        onAction={action}
        quantity={quantity}
        onQuantityChange={(value) =>
          setQuantity(Math.max(0.000001, Math.min(100000, Number.isFinite(value) ? value : 1)))
        }
        reducedMotion={reducedMotion}
        onNext={nextShop}
        learning={learning}
      />
      {game.phase === "report" && (
        <TradingReport game={game} onRestart={restart} onClear={clearRecord} learning={learning} />
      )}
      {menu && (
        <GameDialog
          title={menu === "settings" ? "设置" : menu === "holdings" ? "我的持仓" : "行情与说明"}
          onClose={() => setMenu(null)}
        >
          {menu === "settings" ? (
            <>
              <div className="shop-settings-actions">
                <button
                  className="primary"
                  disabled={game.phase === "report"}
                  onClick={() => {
                    setMenu(null);
                    onAction({ type: "settle", id: crypto.randomUUID() });
                  }}
                >
                  {game.phase === "report" ? "本局已结算" : "结算本局 ↗"}
                </button>
                <button className="secondary" onClick={() => setMenu("holdings")}>
                  我的持仓
                </button>
                <button className="secondary" onClick={() => setMenu("data")}>
                  行情与说明
                </button>
                <button
                  className="secondary"
                  aria-pressed={reducedMotion}
                  onClick={() => setReducedMotion((value) => !value)}
                >
                  {reducedMotion ? "减少动画 ✓" : "减少动画"}
                </button>
              </div>
              <p className="shop-setting-note">可随时结算。持仓按当前市值计入，不自动卖出。</p>
              <SessionActions onRestart={restart} onClear={clearRecord} />
            </>
          ) : menu === "holdings" ? (
            <>
              <p>
                现金 {money(account.cash)} · 持仓市值 {money(account.holdingsValue)}
              </p>
              <div className="shop-portfolio-list">
                {PRODUCTS.filter((product) => game.holdings[product.id].quantity > 0).map(
                  (product) => {
                    const holding = game.holdings[product.id];
                    const value = holding.quantity * getQuote(product.id, game.marketIndex).close;
                    return (
                      <article key={product.id}>
                        <img src={product.icon} alt="" width={48} height={48} />
                        <strong>{product.name}</strong>
                        <span>×{money(holding.quantity)}</span>
                        <span>
                          {money(value)}
                          <small>
                            成本 {money(holding.costBasis)} · 盈亏{" "}
                            {money(value - holding.costBasis)}
                          </small>
                        </span>
                      </article>
                    );
                  },
                )}
              </div>
              {account.holdingsValue === 0 && <p>还没有持仓。</p>}
            </>
          ) : (
            <>
              <p>
                {getMarketDate(game.marketIndex)} · 第{game.round}轮 · 日线
              </p>
              <p>
                八家店对应八种商品，各自映射独立真实历史行情。四价、成交量和指标只显示已经走到的信息。
              </p>
              <p>
                按已显示收盘价纸上成交，费用0.1%。商品名和小镇币为游戏设定，未连接PandaData或实盘。
              </p>
              <p>
                历史来源{" "}
                <a href="https://data.binance.vision/" target="_blank" rel="noopener noreferrer">
                  Binance Vision
                </a>
                ， 按
                <a
                  href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  CC BY-NC-SA 4.0
                </a>
                保留署名与游戏映射说明。
              </p>
              <p>游戏与学习进度只留在本标签页；PandaAI链接不携带画像，问题仅在你点击时复制。</p>
              <p>拖动场景可旋转，滚轮或双指可缩放；点“跟随”重新对准主角。</p>
            </>
          )}
        </GameDialog>
      )}
    </main>
  );
}
