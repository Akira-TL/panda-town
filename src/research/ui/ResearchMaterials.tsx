"use client";

import { getAvailableResearchQuizzes, RESEARCH_TOPICS } from "../chapters";
import { DATASET_VERSION, getDataIssues, getResearchData } from "../data";
import type { ResearchAction, ResearchState, ResearchTopic } from "../model";
import { ResearchModal } from "./ResearchModal";
import { SimulationView } from "./SimulationView";
import { number, ruleNames, validationNames } from "./format";
import { getRuleDescription } from "../simulation";

export function ResearchMaterials({
  state,
  topic,
  onAction,
  onClose,
  embedded = false,
}: {
  state: ResearchState;
  topic: ResearchTopic;
  onAction: (action: ResearchAction) => void;
  onClose: () => void;
  embedded?: boolean;
}) {
  const data = getResearchData();
  const issues = getDataIssues();
  const title = RESEARCH_TOPICS[topic].label;
  const latest = state.runs.at(-1);
  const validation = state.runs
    .filter((run) => run.config.segment === "validation")
    .at(-1);
  const quizList =
    topic === "explanation"
      ? getAvailableResearchQuizzes(state)
      : getAvailableResearchQuizzes(state).filter((quiz) =>
          quiz.id === "fees"
            ? topic === "cost"
            : ["comparison", "drawdown", "trades"].includes(topic),
        );
  const content = (
    <>
      <p>{RESEARCH_TOPICS[topic].description}</p>
      <p className="research-caveat">
        PandaAI研究流程演示 · 本地计算 ·
        尚未连接PandaData。商品名与资金为游戏设定，价格走势来自真实历史映射。
      </p>
      <p className="research-caveat">
        历史数据：
        <a
          href="https://data.binance.vision/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Binance Vision
        </a>{" "}
        ·{" "}
        <a
          href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          CC BY-NC-SA 4.0
        </a>
        。 价格与数量已缩放为游戏单位。
      </p>{" "}
      {(topic === "source" || topic === "quality") && (
        <>
          <dl className="research-inputs">
            <div>
              <dt>数据版本</dt>
              <dd>{DATASET_VERSION}</dd>
            </div>
            <div>
              <dt>来源</dt>
              <dd>
                Binance
                Vision现货历史日线：BTCUSDT映射竹材、ETHUSDT映射松果；各自首期开盘缩放为100
              </dd>
            </div>
            <div>
              <dt>研究区间</dt>
              <dd>
                {data[0]?.date} — {data.at(-1)?.date}
              </dd>
            </div>
            <div>
              <dt>样本</dt>
              <dd>{data.length}个日期 · 竹材与松果两种虚构商品</dd>
            </div>
          </dl>
          <h3>记录核查与处理说明</h3>
          {issues.length ? (
            issues.map((issue, index) => (
              <div
                className="research-raw-record"
                key={`${issue.date}-${index}`}
              >
                <strong>
                  {issue.date} · {issue.asset === "bamboo" ? "竹材" : "松果"} ·{" "}
                  {issue.field === "close" ? "收盘价" : "成交量"}
                </strong>
                <p>
                  收到：
                  {issue.received === null ? "缺失" : number(issue.received)}
                  ；核验副本：{number(issue.restored)}。
                </p>
                <p>{issue.explanation}</p>
              </div>
            ))
          ) : (
            <p>
              当前核验记录未列出待处理问题；不由空列表宣称所有真实数据都可靠。
            </p>
          )}
          <details className="research-details">
            <summary>展开研究段核验副本（不会揭晓预留数据）</summary>
            <div
              className="research-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="研究数据表，可横向滚动"
            >
              <table>
                <caption>仅包含本次已公布研究段</caption>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>竹材开盘 / 收盘</th>
                    <th>成交量</th>
                    <th>松果开盘 / 收盘</th>
                    <th>成交量</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((bar) => (
                    <tr key={bar.date}>
                      <td>{bar.date}</td>
                      <td>
                        {number(bar.bamboo.open)} / {number(bar.bamboo.close)}
                      </td>
                      <td>{bar.bamboo.volume}</td>
                      <td>
                        {number(bar.pine.open)} / {number(bar.pine.close)}
                      </td>
                      <td>{bar.pine.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {topic === "rule" && (
        <div className="research-empty">
          <strong>
            {state.rule ? ruleNames[state.rule] : "规则还没有确认"}
          </strong>
          {state.rule && <p>{getRuleDescription(state.rule)}</p>}
          <p>
            策略版本{state.strategyVersion}
            ；确认后保留具体规则和输入，调整后保存新版本。运行区间、投入比例、检查频率和费用均可在结果中的“输入与方法”展开。
          </p>
        </div>
      )}
      {topic === "validation" && (
        <>
          <p>当前版本检验状态：{validationNames[state.validation]}。</p>
          <p>
            研究段与新数据段分别从1000模拟币独立运行，不能接成一条连续获利曲线。已根据揭晓结果修改的版本，还需要另一批新数据。
          </p>
          {validation ? (
            <SimulationView result={validation} />
          ) : (
            <div className="research-empty">
              本局尚未运行这段新数据，不提前展示结果，也不把暂缓当作通过。
            </div>
          )}
        </>
      )}
      {["comparison", "drawdown", "trades", "cost"].includes(topic) &&
        (latest ? (
          <SimulationView result={latest} />
        ) : (
          <div className="research-empty">
            尚无已完成计算。先完成当前研究步骤，再查看对应输出。
          </div>
        ))}
      {quizList.map((quiz) => {
        const answer = state.answers.find((item) => item.id === quiz.id);
        return (
          <section
            className="research-quiz"
            key={quiz.id}
            aria-label="可跳过的理解题"
          >
            <div className="research-eyebrow">
              理解一下 · 可以跳过，不影响展示策略
            </div>
            <h3>{quiz.prompt}</h3>
            {answer ? (
              <div role="status">
                <p>
                  你的首次答案：
                  {
                    quiz.answers.find((option) => option.id === answer.answer)
                      ?.label
                  }
                  。{answer.correct ? "本题回答正确。" : "本题回答与解释不同。"}
                </p>
                <p>{quiz.explanation}</p>
                <p>首次答案已保存，重复打开不会增加答题次数。</p>
              </div>
            ) : (
              <div className="research-quiz-buttons">
                {quiz.answers.map((answerOption) => (
                  <button
                    type="button"
                    className="research-secondary"
                    key={answerOption.id}
                    onClick={() =>
                      onAction({
                        type: "answer",
                        id: crypto.randomUUID(),
                        day: state.day,
                        question: quiz.id,
                        answer: answerOption.id,
                      })
                    }
                  >
                    {answerOption.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="research-secondary"
                  onClick={onClose}
                >
                  跳过这题，返回工作台
                </button>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
  return embedded ? (
    content
  ) : (
    <ResearchModal title={title} onClose={onClose}>
      {content}
    </ResearchModal>
  );
}
