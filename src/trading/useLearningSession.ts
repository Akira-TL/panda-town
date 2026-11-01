"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TradingGame } from "./model";
import { createLearningState, recordLearningAction } from "./learning/state";
import { buildLearningSummary } from "./learning/summary";
import {
  clearLearningStorage,
  LEARNING_STORAGE_KEY,
  restoreLearningState,
  saveLearningState,
} from "./learning/storage";
import type {
  LearningAction,
  LearningHookResult,
  LearningState,
} from "./learning/types";

export function useLearningSession(
  game: TradingGame | null,
): LearningHookResult {
  const [state, setState] = useState<LearningState | null>(null);
  const [notice, setNotice] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const cleared = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const sessionId = game?.sessionId ?? null;
  useEffect(() => {
    const game = gameRef.current;
    cleared.current = false;
    if (!game) {
      setState(null);
      setLoadedId(null);
      return;
    }
    setNotice("");
    let next = createLearningState(game.sessionId);
    try {
      const raw = sessionStorage.getItem(LEARNING_STORAGE_KEY);
      if (raw) {
        const restored = restoreLearningState(raw, game);
        if (restored) next = restored;
        else setNotice("旧局或损坏的学习记录未接续，本局知识保持未观察。");
      } else setNotice("");
    } catch {
      setNotice("本设备无法读取学习记录，仍可继续；刷新后可能无法恢复。");
    }
    setState(next);
    setLoadedId(game.sessionId);
    // 同一局的行情推进不重新从存储覆盖内存中的首次答案。
  }, [sessionId]);
  useEffect(() => {
    if (
      !cleared.current &&
      state &&
      loadedId === state.sessionId &&
      state.sessionId === sessionId
    ) {
      let saved = false;
      try {
        saved = saveLearningState(sessionStorage, state);
      } catch {
        saved = false;
      }
      if (!saved)
        setNotice("学习记录无法保存，仍可继续；刷新可能丢失这些记录。");
    }
  }, [state, loadedId, sessionId]);
  const record = useCallback(
    (action: LearningAction) => {
      if (!game || cleared.current) return;
      setState((current) =>
        recordLearningAction(
          current?.sessionId === game.sessionId
            ? current
            : createLearningState(game.sessionId),
          game,
          action,
        ),
      );
    },
    [game],
  );
  const clear = useCallback(() => {
    cleared.current = true;
    let success = false;
    try {
      success = clearLearningStorage(sessionStorage);
    } catch {
      success = false;
    }
    setState(null);
    setNotice(
      success
        ? ""
        : "画面中的学习记录已清除，但设备拒绝删除存储，旧记录可能残留。",
    );
    return success;
  }, []);
  const current = state?.sessionId === sessionId ? state : null;
  const summary = useMemo(
    () => (game && current ? buildLearningSummary(game, current) : null),
    [game, current],
  );
  return {
    state: current,
    summary,
    notice,
    clear,
    setRule: (rule, product) =>
      record({ type: "set-rule", id: crypto.randomUUID(), rule, product }),
    inspectIndicator: (indicator, interaction, index, product) =>
      record({
        type: "indicator",
        id: crypto.randomUUID(),
        indicator,
        interaction,
        index,
        product,
      }),
    answerKnowledge: (promptId, answerId, product) =>
      record({
        type: "answer",
        id: crypto.randomUUID(),
        promptId,
        answerId,
        product,
      }),
  };
}
