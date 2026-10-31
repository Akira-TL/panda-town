"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dispatch,
  visibleGame,
  type PresentedOption,
} from "../src/game/engine";
import {
  getEventDialogue,
  getEventForLocation,
  LOCATIONS,
} from "../src/game/content";
import { buildProfile } from "../src/game/profile";
import {
  STORAGE_KEY,
  freshSession,
  restoreSession,
  type Session,
  type ActionInput,
} from "../src/game/session";
import { ReportPanel } from "../src/ui/ReportPanel";
import { StudyPanel } from "../src/ui/StudyPanel";
import { InventoryPanel, FinalAssetNote } from "../src/ui/InventoryPanel";
import { DecisionPanel } from "../src/ui/DecisionPanel";
import { DiceFace } from "../src/ui/GameDetails";
import type { AssetStatus } from "../src/scene/TownScene";
import "./globals.css";

const TownScene = dynamic(() => import("../src/scene/TownScene"), {
  ssr: false,
  loading: () => <div className="scene-loading">正在点亮小镇的灯……</div>,
});
const money = (n: number) => n.toLocaleString("zh-CN");
function choiceTitle(option: PresentedOption): string {
  switch (option.effect.kind) {
    case "work":
      return "接一份临时工作";
    case "buy-stall":
      return "接手集市摊位";
    case "buy-tool":
      return option.effect.quality === "used" ? "买二手工具" : "买优质工具";
    case "cooperate":
      return "一起采购优质工具";
    case "consume":
      return option.label.split(/[，；]/)[0] ?? option.label;
    default:
      return option.label;
  }
}
function choiceDescription(option: PresentedOption): string {
  if (!option.available)
    return option.shortfall > 0
      ? `现金还差 ${option.shortfall}`
      : "当前条件不满足";
  switch (option.effect.kind) {
    case "work":
      return "确定收入，代替本回合其他行动";
    case "buy-stall":
      return "次日起每日 +100 · 期末可卖 480";
    case "buy-tool":
      return `每次摊位收入 +${option.effect.quality === "used" ? 20 : 40}，需先经营摊位`;
    case "cooperate":
      return "明天交货 · 每次摊位收入 +40";
    case "invest":
      return "可能盈亏，最多损失已投入金额";
    case "sell-investment":
      return "按当前报价全部退出，费用为 0";
    case "consume":
      return option.effect.itemId === "repair-service"
        ? "师傅当场帮忙修好"
        : "记入本局回顾，不可出售";
    default:
      return "不额外花费现金";
  }
}
export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [cameraMode, setCameraMode] = useState<"follow" | "overview">("follow");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneError, setSceneError] = useState("");
  const [assetStatus, setAssetStatus] = useState<AssetStatus | null>(null);
  const [showIntroduction, setShowIntroduction] = useState(false);
  const [viewReport, setViewReport] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const onError = useCallback((message: string) => setSceneError(message), []);
  const onAssetStatus = useCallback(
    (status: AssetStatus) => setAssetStatus(status),
    [],
  );
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = restoreSession(raw);
        if (restored) {
          setSession(restored);
          setViewReport(restored.game.phase === "report");
          setNotice("已恢复本标签页的当前一局。");
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
          setNotice("记录版本不兼容或内容损坏，请重新开始。");
        }
      }
    } catch {
      setNotice("本设备记录不可用，本局仍可进行；刷新后进度可能丢失。");
    }
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      setNotice("记录无法保存，刷新将丢失当前进度。");
    }
  }, [session, hydrated]);
  const game = session?.game;
  const visible = game ? visibleGame(game) : null;
  const report = useMemo(
    () => (game?.phase === "report" ? buildProfile(game.evidence) : null),
    [game],
  );
  const place = LOCATIONS.find((p) => p.id === session?.position);
  const act = useCallback((input: ActionInput) => {
    const actionId = crypto.randomUUID();
    setSession((previous) =>
      previous
        ? {
            ...previous,
            game: dispatch(previous.game, {
              ...input,
              id: actionId,
              day: previous.game.day,
            }),
          }
        : previous,
    );
  }, []);
  useEffect(() => {
    if (
      !session ||
      session.game.phase !== "travel" ||
      !session.rolled ||
      session.branch
    )
      return;
    if (session.remaining === 0) {
      setSession((previous) =>
        previous && previous.game.phase === "travel"
          ? {
              ...previous,
              game: dispatch(previous.game, {
                type: "open-event",
                id: `arrival-${previous.game.day}-${previous.position}`,
                day: previous.game.day,
                event: getEventForLocation(previous.game, previous.position),
              }),
            }
          : previous,
      );
      return;
    }
    const paths = LOCATIONS.find((p) => p.id === session.position)?.next ?? [];
    if (paths.length > 1) {
      setSession((previous) =>
        previous ? { ...previous, branch: true } : previous,
      );
      return;
    }
    const next = paths[0];
    if (!next) return;
    const timer = setTimeout(
      () =>
        setSession((previous) =>
          previous &&
          previous.game.phase === "travel" &&
          previous.position === session.position &&
          previous.remaining === session.remaining
            ? { ...previous, position: next, remaining: previous.remaining - 1 }
            : previous,
        ),
      reducedMotion ? 80 : 650,
    );
    return () => clearTimeout(timer);
  }, [session, reducedMotion]);
  useEffect(() => {
    if (
      game?.phase === "decision" ||
      game?.phase === "feedback" ||
      game?.phase === "settlement" ||
      game?.phase === "report" ||
      session?.branch
    )
      dialogRef.current?.focus();
  }, [game?.phase, session?.branch, viewReport]);
  function begin() {
    setSession(freshSession());
    setCameraMode("follow");
    setSceneError("");
    setNotice("");
    setShowIntroduction(true);
    setViewReport(false);
  }
  function clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 内存仍会清除。 */
    }
    setSession(null);
    setNotice("本局记录与画像已清除。");
    setAssetStatus(null);
    setViewReport(false);
  }
  function roll() {
    setSession((previous) => {
      if (!previous || previous.game.phase !== "travel" || previous.rolled)
        return previous;
      const die = Math.floor(Math.random() * 6) + 1;
      return { ...previous, die, remaining: die, rolled: true };
    });
  }
  function endTurn() {
    setSession((previous) =>
      previous
        ? {
            ...previous,
            game: dispatch(previous.game, {
              type: "end-turn",
              id: `end-${previous.game.day}`,
              day: previous.game.day,
            }),
            remaining: 0,
            rolled: false,
            branch: false,
          }
        : previous,
    );
  }
  if (!hydrated) return <main className="boot">正在打开小镇的门……</main>;
  if (!session || !game || !visible)
    return (
      <main className="welcome">
        <div
          className="welcome-art"
          role="img"
          aria-label="童话小镇概念效果图"
        />
        <div className="welcome-shade" />
        <section className="welcome-card">
          <span className="eyebrow">PANDA TOWN · 熊猫小镇</span>
          <h1>
            八天，开一家
            <br />
            <em>自己的咖啡馆。</em>
          </h1>
          <p>
            掷骰走进小镇，在商店与居民间做选择。工作、经营与投资，慢慢筹齐 3000
            金币。
          </p>
          <button className="primary large" onClick={begin}>
            出发去小镇 <span>↗</span>
          </button>
          <p className="welcome-footnote">
            单人 + 电脑店长 · 约 5–8 分钟 · 阅读不限时
          </p>
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          <small>演示数据 · 当前设备保存 · 入口背景为概念效果图</small>
        </section>
      </main>
    );
  if (game.phase === "report" && report && viewReport)
    return (
      <main className="report-page">
        <header className="report-top">
          <a className="wordmark" href="#report-heading">
            PANDA TOWN <span>本局画像</span>
          </a>
          <span className="data-badge">仅保存在本设备</span>
        </header>
        <section
          className="report-hero"
          aria-labelledby="report-heading"
          tabIndex={-1}
          ref={dialogRef}
        >
          <img src="/art/panda-tripo-source.png" alt="背着绿色背包的熊猫" />
          <div className="report-heading-copy">
            <span className="eyebrow">本局选择与行为证据</span>
            <h1 id="report-heading">用户画像</h1>
            <strong className="report-nickname">{report.title.label}</strong>
            <p>{report.title.reason}</p>
          </div>
          <div className="outcome">
            <strong>
              {game.result?.opened ? "咖啡馆开张了！" : "咖啡馆筹备中"}
            </strong>
            <div className="outcome-amount">
              <img src="/art/icon-cash.png" alt="金币" />
              <b>{money(game.result?.cashBeforeOpening ?? game.cash)}</b>
            </div>
            <small>结算可用现金</small>
            <span>
              {game.result?.opened
                ? `开店后余额 ${money(game.cash)}`
                : `还差 ${money(game.result?.gap ?? 0)}`}
            </span>
          </div>
        </section>
        <FinalAssetNote game={game} />
        <ReportPanel report={report} />
        <footer className="report-actions">
          <button className="primary" onClick={begin}>
            重开一局 ↗
          </button>
          <button className="secondary" onClick={clear}>
            清除记录
          </button>
          <span>演示数据 · 无自动上传</span>
        </footer>
      </main>
    );
  const event = visible.event;
  const copy = event
    ? getEventDialogue(game, event.id, session.position)
    : null;
  const projectedCash =
    game.cash +
    (session.sellStall && game.assets.stall ? 480 : 0) +
    (session.sellInvestment ? visible.investmentValue : 0);
  const goalCash = game.result?.cashBeforeOpening ?? game.cash;
  const investmentOffers =
    event?.id === "E05"
      ? event.options
          .filter((o) => o.effect.kind === "invest" && o.available)
          .map((o) => {
            const preview = dispatch(game, {
              type: "choose",
              id: `preview-${game.day}-${o.id}`,
              day: game.day,
              optionId: o.id,
            });
            return `${o.cost} 金币 → ${preview.assets.investment?.shares.toFixed(3)} 份`;
          })
          .join(" · ")
      : null;
  return (
    <main
      className={`game-shell ${game.phase !== "travel" || session.branch ? "has-dialogue" : ""}`}
    >
      <div className="scene">
        <TownScene
          playerLocation={session.position}
          cameraMode={cameraMode}
          stallOwned={game.assets.stall !== null}
          cafeOpened={game.result?.opened ?? false}
          reducedMotion={reducedMotion}
          onError={onError}
          onAssetStatus={onAssetStatus}
        />
      </div>
      <header className="hud">
        <div className="wordmark">
          PANDA TOWN <span>熊猫小镇</span>
        </div>
        <div className="day-counter">
          <span>第</span>
          <strong>{game.day}</strong>
          <span>/ 8 天</span>
          <div className="day-beads" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} className={i < game.day ? "passed" : ""} />
            ))}
          </div>
        </div>
        <div className="cash">
          <small>手头现金</small>
          <strong>
            <img src="/art/icon-cash.png" alt="" />
            {money(game.cash)}
          </strong>
        </div>
      </header>
      <aside className="goal-card">
        <span className="eyebrow">唯一目标 · 开张咖啡馆</span>
        <strong>筹齐 3000 金币</strong>
        <span className="mobile-goal-status">
          {game.result?.opened
            ? "目标达成"
            : goalCash >= 3000
              ? "资金已够"
              : `还差 ${money(3000 - goalCash)}`}
        </span>
        <div className="progress-track">
          <span style={{ width: `${Math.min(100, goalCash / 30)}%` }} />
        </div>
        <small>
          {game.result?.opened
            ? "开店资金已投入，目标达成。"
            : goalCash >= 3000
              ? "开店资金已够，记得保留到结算。"
              : `现金还差 ${money(3000 - goalCash)}`}{" "}
          · 资产须变现后计入
        </small>
        {game.assets.stall && (
          <small>
            我的摊位 ·{" "}
            {game.assets.stall.boughtDay < game.day
              ? "今日开始经营"
              : "明天开始经营"}
          </small>
        )}
        {game.assets.investment && (
          <small>
            演示持仓 · 当前退出价值 {money(visible.investmentValue)}
          </small>
        )}
        {game.assets.tool.status === "pending" && (
          <small>工具待交货 · 第 {game.assets.tool.deliveryDay} 天到货</small>
        )}
      </aside>
      <InventoryPanel game={game} />
      <nav className="view-controls" aria-label="视角和动画">
        <button
          className={cameraMode === "follow" ? "selected" : ""}
          onClick={() => setCameraMode("follow")}
          aria-pressed={cameraMode === "follow"}
        >
          跟随
        </button>
        <button
          className={cameraMode === "overview" ? "selected" : ""}
          onClick={() => setCameraMode("overview")}
          aria-pressed={cameraMode === "overview"}
        >
          全局
        </button>
        <button
          onClick={() => setReducedMotion((v) => !v)}
          aria-pressed={reducedMotion}
        >
          {reducedMotion ? "简化动画 ✓" : "简化动画"}
        </button>
      </nav>
      <aside className="opponent-peek">
        <span className="opponent-avatar">♟</span>
        <div>
          <small>隔壁店长也在筹备</small>
          <strong>
            {game.opponent.stallBoughtDay ? "正在经营摊位" : "攒钱迎接新机会"}
          </strong>
          <span>手头现金 {money(game.opponent.cash)}</span>
        </div>
      </aside>
      <div className="scene-status">
        <span>演示数据</span>
        {assetStatus?.missing.length ? (
          <span>开发预览 · 部分正式模型待接入</span>
        ) : null}
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {sceneError && (
        <aside className="scene-error" role="alert">
          <strong>三维场景暂时无法显示</strong>
          <p>{sceneError}</p>
          <button onClick={() => location.reload()}>刷新重试</button>
        </aside>
      )}
      {game.phase === "travel" && !session.branch && (
        <section className="travel-panel">
          <span className="location-label">⌖ {place?.name}</span>
          {session.rolled ? (
            <>
              <strong aria-live="polite">
                沿街前进 · 剩余 {session.remaining} 步
              </strong>
              <DiceFace value={session.die} rolling={!reducedMotion} />
            </>
          ) : (
            <>
              <h2>
                {game.day === 1
                  ? "让开店计划迈出第一步"
                  : `第 ${game.day} 天，新的机会`}
              </h2>
              {game.day === 4 || game.day === 8 ? (
                <p>
                  演示市场报价已更新：{visible.price}
                  。资料只显示截至今天的情况。
                </p>
              ) : (
                <p>掷一枚骰子，熊猫会自动沿街行走；岔路由你来选。</p>
              )}
              <button
                className="primary roll-button"
                onClick={roll}
                aria-label="掷骰出发"
              >
                <DiceFace value={session.die || 5} />
                <span>
                  掷骰出发 <small>走到哪里，由这一掷开始</small>
                </span>
                <b>↗</b>
              </button>
              {session.die > 0 && <small>上次掷出 {session.die} 点</small>}
            </>
          )}
        </section>
      )}
      {session.branch && (
        <section
          className="dialogue compact"
          aria-label="选择岔路"
          tabIndex={-1}
          ref={dialogRef}
        >
          <span className="eyebrow">
            前面有两条街 · 还剩 {session.remaining} 步
          </span>
          <h2>这次往哪里走？</h2>
          <div className="choices">
            {place?.next.map((id) => {
              const destination = LOCATIONS.find((p) => p.id === id);
              return (
                <button
                  className="choice"
                  key={id}
                  onClick={() =>
                    setSession((previous) =>
                      previous &&
                      previous.branch &&
                      previous.remaining > 0 &&
                      previous.game.phase === "travel" &&
                      LOCATIONS.find(
                        (p) => p.id === previous.position,
                      )?.next.includes(id)
                        ? {
                            ...previous,
                            position: id,
                            remaining: previous.remaining - 1,
                            branch: false,
                          }
                        : previous,
                    )
                  }
                >
                  <strong>{destination?.name} ↗</strong>
                  <small>{destination?.theme}机会 · 走到这里消耗 1 步</small>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {game.phase === "decision" && event && copy && (
        <section
          className="dialogue"
          aria-label={copy.title}
          tabIndex={-1}
          ref={dialogRef}
        >
          <div className="dialogue-heading">
            <div className="speaker-portrait">
              <img src="/art/panda-tripo-source.png" alt="小镇居民" />
            </div>
            <div>
              <span className="eyebrow">
                {copy.speaker} · {place?.name}
              </span>
              <h2>{copy.title}</h2>
            </div>
            <span className="event-number">第 {game.day} 天</span>
          </div>
          <p className="dialogue-text">{copy.text}</p>
          {investmentOffers && (
            <p className="investment-offer-preview">{investmentOffers}</p>
          )}
          <StudyPanel
            key={`${game.day}-${event.id}`}
            event={event}
            game={game}
            inspect={(materialId) => act({ type: "inspect", materialId })}
            compare={(materialIds) => act({ type: "compare", materialIds })}
            answer={(questionId, answerId) =>
              act({ type: "answer", questionId, answerId })
            }
          />
          <div className="choices">
            {event.options.map((o, index) => (
              <button
                className="choice"
                key={o.id}
                disabled={!o.available}
                aria-label={o.label}
                onClick={() => act({ type: "choose", optionId: o.id })}
              >
                <span className="choice-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{choiceTitle(o)}</strong>
                <span
                  className={`choice-price ${o.effect.kind === "work" ? "income" : ""}`}
                >
                  {o.effect.kind === "work"
                    ? "+250"
                    : o.cost > 0
                      ? `−${o.cost}`
                      : "0"}
                  <img src="/art/icon-cash.png" alt="金币" />
                </span>
                <small>{choiceDescription(o)}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {game.phase === "feedback" && (
        <section
          className="dialogue compact"
          aria-label="本回合选择结果"
          tabIndex={-1}
          ref={dialogRef}
        >
          <DecisionPanel game={game} onContinue={endTurn} />
        </section>
      )}
      {game.phase === "settlement" && (
        <section
          className="dialogue settlement"
          aria-label="开店资金结算"
          tabIndex={-1}
          ref={dialogRef}
        >
          <span className="eyebrow">第八天 · 最后盘点</span>
          <h2>让筹备迎来一个结果</h2>
          <p>
            今日基础收入和到期经营收入已经到账。资产只有选择出售后才计入开店现金。
          </p>
          {game.assets.stall && (
            <label className="sale-option">
              <input
                type="checkbox"
                checked={session.sellStall}
                onChange={(e) =>
                  setSession((p) =>
                    p ? { ...p, sellStall: e.target.checked } : p,
                  )
                }
              />
              <span>
                出售摊位 <strong>+480</strong>
                <small>也可保留，保留时不计入现金。</small>
              </span>
            </label>
          )}
          {game.assets.investment && (
            <label className="sale-option">
              <input
                type="checkbox"
                checked={session.sellInvestment}
                onChange={(e) =>
                  setSession((p) =>
                    p ? { ...p, sellInvestment: e.target.checked } : p,
                  )
                }
              />
              <span>
                全部出售演示持仓{" "}
                <strong>+{money(visible.investmentValue)}</strong>
                <small>按当前报价 {visible.price}，费用为 0。</small>
              </span>
            </label>
          )}
          <div className="settlement-total">
            <span>确认后可用现金</span>
            <strong>{money(projectedCash)}</strong>
            <small>
              {projectedCash >= 3000
                ? `支付开店款 3000 后剩余 ${money(projectedCash - 3000)}`
                : `离开张还差 ${money(3000 - projectedCash)}，仍可查看完整画像。`}
            </small>
          </div>
          <button
            className="primary large"
            onClick={() =>
              act({
                type: "finish",
                sellStall: session.sellStall,
                sellInvestment: session.sellInvestment,
              })
            }
          >
            确认结算，查看本局画像 ↗
          </button>
        </section>
      )}
      {game.phase === "report" && !viewReport && game.result && (
        <section
          className="dialogue compact outcome-dialogue"
          aria-label="咖啡馆结局"
          tabIndex={-1}
          ref={dialogRef}
        >
          <span className="eyebrow">八天的筹备，走到这里</span>
          <h2>
            {game.result.opened ? "我的咖啡馆，今天开张！" : "咖啡馆仍在筹备中"}
          </h2>
          <p>
            {game.result.opened
              ? `结算可用现金 ${money(game.result.cashBeforeOpening)}，支付开店款后剩余 ${money(game.cash)}。`
              : `结算可用现金 ${money(game.result.cashBeforeOpening)}，离开张还差 ${money(game.result.gap)}。你的八天经历同样值得回顾。`}
          </p>
          <button className="primary large" onClick={() => setViewReport(true)}>
            看看本局的选择与画像 ↗
          </button>
        </section>
      )}
      {showIntroduction && (
        <div
          className="intro-overlay"
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              event.currentTarget.querySelector("button")?.focus();
            }
          }}
        >
          <section
            className="intro-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-heading"
          >
            <span className="eyebrow">欢迎来到熊猫小镇</span>
            <h2 id="intro-heading">
              带着 1000 金币，
              <br />
              开始八天的咖啡馆计划。
            </h2>
            <p>
              每回合掷骰沿街自动行走，在岔路和店前选择。每晚基础收入
              150，也可以选择临时工作多赚 250。
            </p>
            <p>
              第八天筹齐 3000 即可开张。没有淘汰，结尾会回顾你的选择与偏好。
            </p>
            <button
              autoFocus
              className="primary large"
              onClick={() => setShowIntroduction(false)}
            >
              明白了，开始第一天 ↗
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
