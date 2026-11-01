"use client";

import { useCallback, useEffect, useState } from "react";
import { createResearch } from "./campaign";
import type { ResearchSession, ResearchAction } from "./model";
import {
  advanceResearchStep,
  applyResearchAction,
  chooseResearchBranch,
  rollResearchDie,
} from "./navigation";
import {
  LEGACY_STORAGE_KEY,
  RESEARCH_STORAGE_KEY,
  restoreResearchSession,
} from "./session";
import type { LocationId } from "../game/content";

export function useResearchSession(reducedMotion: boolean) {
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESEARCH_STORAGE_KEY);
      if (raw) {
        const restored = restoreResearchSession(raw);
        if (restored) setSession(restored);
        else setNotice("进度已过期或损坏，请重新出发。");
      } else if (sessionStorage.getItem(LEGACY_STORAGE_KEY)) {
        setNotice(
          "已更新为量化策略展。旧开店记录无法接续，请开始一份新的研究。",
        );
      }
    } catch {
      setNotice("本设备无法读取进度，仍可开始；刷新后可能无法恢复。");
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated || !session) return;
    try {
      sessionStorage.setItem(RESEARCH_STORAGE_KEY, JSON.stringify(session));
    } catch {
      setNotice("进度无法保存，仍可继续本局；刷新可能丢失进度或恢复较早记录。");
    }
  }, [hydrated, session]);
  useEffect(() => {
    if (
      !session ||
      session.research.phase !== "travel" ||
      !session.rolled ||
      session.remaining <= 0 ||
      session.branch
    )
      return;
    const timer = setTimeout(
      () =>
        setSession((current) =>
          current ? advanceResearchStep(current) : current,
        ),
      reducedMotion ? 80 : 650,
    );
    return () => clearTimeout(timer);
  }, [session, reducedMotion]);
  const begin = useCallback(() => {
    try {
      sessionStorage.removeItem(RESEARCH_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      setNotice("");
    } catch {
      setNotice("新局已在内存开始；旧存储未能删除，刷新可能恢复旧记录。");
    }
    setSession({
      research: createResearch(crypto.randomUUID()),
      position: "square",
      remaining: 0,
      die: 0,
      rolled: false,
      branch: false,
    });
  }, []);
  const clear = useCallback(() => {
    let failed = false;
    try {
      sessionStorage.removeItem(RESEARCH_STORAGE_KEY);
    } catch {
      failed = true;
    }
    try {
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      failed = true;
    }
    setSession(null);
    setNotice(
      failed
        ? "当前画面已清除，但本设备拒绝删除存储，旧记录可能残留；请勿交给下一位玩家。"
        : "本标签页的研究与画像记录已清除。",
    );
  }, []);
  const onAction = useCallback((action: ResearchAction) => {
    setSession((current) =>
      current ? applyResearchAction(current, action) : current,
    );
  }, []);
  const roll = useCallback(() => {
    const die = Math.floor(Math.random() * 6) + 1;
    setSession((current) =>
      current ? rollResearchDie(current, die) : current,
    );
  }, []);
  const chooseBranch = useCallback((target: LocationId) => {
    setSession((current) =>
      current ? chooseResearchBranch(current, target) : current,
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
