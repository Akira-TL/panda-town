"use client";

import { useCallback, useEffect, useState } from "react";
import type { LocationId } from "../game/content";
import type { TradingAction, TradingSession } from "./model";
import {
  advanceTradingStep,
  applyTradingAction,
  chooseTradingBranch,
  rollTradingSession,
} from "./navigation";
import {
  freshTradingSession,
  restoreTradingSession,
  TRADING_STORAGE_KEY,
} from "./session";

const OLD_KEYS = ["panda-town.research.v3", "panda-town.current.v1"] as const;
export function useTradingSession(reducedMotion: boolean, paused: boolean) {
  const [session, setSession] = useState<TradingSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TRADING_STORAGE_KEY);
      if (raw) {
        const restored = restoreTradingSession(raw);
        if (restored) setSession(restored);
        else setNotice("进度已过期或损坏，请重新出发。");
      } else if (OLD_KEYS.some((key) => sessionStorage.getItem(key))) {
        setNotice("已换成商店交易，重新出发吧。");
      }
    } catch {
      setNotice("本设备无法读取进度；仍可开始，刷新可能丢失。");
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated || !session) return;
    try {
      sessionStorage.setItem(TRADING_STORAGE_KEY, JSON.stringify(session));
    } catch {
      setNotice("进度无法保存，仍可继续；刷新可能丢失。");
    }
  }, [hydrated, session]);
  useEffect(() => {
    if (
      !session ||
      paused ||
      session.game.phase !== "travel" ||
      !session.rolled ||
      session.remaining <= 0 ||
      session.branch
    )
      return;
    const timer = setTimeout(
      () =>
        setSession((current) =>
          current ? advanceTradingStep(current) : current,
        ),
      reducedMotion ? 80 : 650,
    );
    return () => clearTimeout(timer);
  }, [session, paused, reducedMotion]);
  const begin = useCallback(() => {
    let failed = false;
    for (const key of [TRADING_STORAGE_KEY, ...OLD_KEYS]) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        failed = true;
      }
    }
    setSession(freshTradingSession(crypto.randomUUID()));
    setNotice(
      failed ? "新局已开始；设备未能删除旧存储，刷新可能恢复旧进度。" : "",
    );
  }, []);
  const clear = useCallback(() => {
    let failed = false;
    for (const key of [TRADING_STORAGE_KEY, ...OLD_KEYS]) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        failed = true;
      }
    }
    setSession(null);
    setNotice(
      failed
        ? "画面已清除，但设备拒绝删除存储，旧记录可能残留。"
        : "本局记录已清除。",
    );
  }, []);
  const onAction = useCallback((action: TradingAction) => {
    setSession((current) =>
      current ? applyTradingAction(current, action) : current,
    );
  }, []);
  const roll = useCallback(() => {
    const die = Math.floor(Math.random() * 6) + 1;
    setSession((current) =>
      current ? rollTradingSession(current, die) : current,
    );
  }, []);
  const chooseBranch = useCallback((target: LocationId) => {
    setSession((current) =>
      current ? chooseTradingBranch(current, target) : current,
    );
  }, []);
  return {
    session,
    hydrated,
    notice,
    setNotice,
    begin,
    clear,
    onAction,
    roll,
    chooseBranch,
  };
}
