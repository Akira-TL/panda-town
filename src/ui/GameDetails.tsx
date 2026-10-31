import { currentPrice, type GameState } from "../game/engine";

export function DiceFace({
  value,
  rolling = false,
}: {
  value: number;
  rolling?: boolean;
}) {
  const patterns: number[][] = [
    [],
    [4],
    [0, 8],
    [0, 4, 8],
    [0, 2, 6, 8],
    [0, 2, 4, 6, 8],
    [0, 2, 3, 5, 6, 8],
  ];
  return (
    <span
      className={`dice-face ${rolling ? "rolling" : ""}`}
      aria-label={`${value} 点`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i
          key={i}
          className={patterns[value]?.includes(i) ? "pip filled" : "pip"}
        />
      ))}
    </span>
  );
}
export function MaterialChart({
  eventId,
  game,
}: {
  eventId: string;
  game: GameState;
}) {
  if (eventId === "E04")
    return (
      <figure className="material-chart">
        <figcaption>
          <span>小镇营业记录</span>
          <small>开局前已公布 · 演示数据</small>
        </figcaption>
        <div className="sales-chart">
          {[100, 120, 90].map((v, i) => (
            <div key={i}>
              <strong>{v}</strong>
              <span style={{ height: `${v / 1.5}px` }} />
              <small>样例第 {i + 1} 天</small>
            </div>
          ))}
        </div>
      </figure>
    );
  if (eventId === "E05" || eventId === "E06") {
    const prices = [100];
    const labels = ["开局"];
    if (game.day >= 4) {
      prices.push(currentPrice({ day: 4, scenario: game.scenario }));
      labels.push("第4天");
    }
    if (game.day >= 8) {
      prices.push(currentPrice({ day: 8, scenario: game.scenario }));
      labels.push("第8天");
    }
    return (
      <figure className="material-chart">
        <figcaption>
          <span>已公布的市场报价</span>
          <small>截至第 {game.day} 天 · 演示数据</small>
        </figcaption>
        <svg
          className="quote-chart"
          viewBox="0 0 300 120"
          role="img"
          aria-label={`已公布报价：${prices.join("、")}`}
        >
          <path
            d="M20 90H280M20 60H280M20 30H280"
            stroke="#e1d5ba"
            strokeDasharray="3 5"
            fill="none"
          />
          <polyline
            points={prices
              .map((p, i) => `${35 + i * 110},${100 - (p - 60)}`)
              .join(" ")}
            fill="none"
            stroke="#4d7951"
            strokeWidth="3"
          />
          {prices.map((p, i) => (
            <g key={i}>
              <circle
                cx={35 + i * 110}
                cy={100 - (p - 60)}
                r="5"
                fill="#bc8c34"
              />
              <text x={35 + i * 110} y={87 - (p - 60)} textAnchor="middle">
                {p}
              </text>
              <text
                x={35 + i * 110}
                y="117"
                textAnchor="middle"
                className="chart-label"
              >
                {labels[i]}
              </text>
            </g>
          ))}
        </svg>
        <p>未来报价尚未公布。历史表现不保证后续收益。</p>
      </figure>
    );
  }
  return null;
}
