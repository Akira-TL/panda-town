import { dispatch, type GameState } from "../game/engine";
import { getDecisionFeedback } from "../game/content";

export function DecisionPanel({
  game,
  onContinue,
}: {
  game: GameState;
  onContinue: () => void;
}) {
  const feedback = getDecisionFeedback(game);
  const chosen = [...game.evidence]
    .reverse()
    .find((e) => e.day === game.day && e.action === "choose");
  const delta = game.cash - (chosen?.cashBefore ?? game.cash);
  const night = dispatch(game, {
    type: "end-turn",
    id: `preview-night-${game.day}`,
    day: game.day,
  });
  const operating = night.cash - game.cash - 150;
  const newRivalStall =
    night.opponent.stallBoughtDay !== game.opponent.stallBoughtDay;
  return (
    <>
      <span className="eyebrow">{feedback.speaker} · 选择的回响</span>
      <div
        className={[
          "result-medallion",
          delta >= 0 ? "positive" : "negative",
        ].join(" ")}
      >
        <img src="/art/icon-cash.webp" alt="" />
        <strong>
          {delta >= 0 ? "+" : ""}
          {delta}
        </strong>
        <span>即时收支</span>
      </div>
      <h2>{feedback.title}</h2>
      <p className="resident-response">“{feedback.text}”</p>
      <p className="feedback-detail">{feedback.detail}</p>
      <div className="night-receipt">
        <div>
          <span>今晚基础收入</span>
          <strong>+150</strong>
        </div>
        {operating > 0 && (
          <div>
            <span>摊位经营与工具加成</span>
            <strong>+{operating}</strong>
          </div>
        )}
        <div className="receipt-total">
          <span>继续后现金</span>
          <strong>{night.cash.toLocaleString("zh-CN")}</strong>
        </div>
        {game.assets.tool.status === "pending" &&
          night.assets.tool.status === "owned" && (
            <p>明早优质工具交付，不会再扣采购款。</p>
          )}
        <p className="rival-response">
          隔壁店长
          {newRivalStall ? "接手了自己的摊位" : "完成临时工作，继续筹备"}
          ，本日结算后现金 {night.opponent.cash.toLocaleString("zh-CN")}。
        </p>
      </div>
      <button className="primary" onClick={onContinue}>
        {game.day === 8
          ? "收好第八天的收入，盘点开店资金 ↗"
          : "收好今天的收入，继续 ↗"}
      </button>
    </>
  );
}
