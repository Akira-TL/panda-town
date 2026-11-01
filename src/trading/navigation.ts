import { LOCATIONS, type LocationId } from "../game/content";
import { dispatchTrading } from "./engine";
import type { TradingAction, TradingSession } from "./model";

function exits(location: LocationId): readonly LocationId[] {
  return LOCATIONS.find((place) => place.id === location)!.next;
}
function move(session: TradingSession, target: LocationId): TradingSession {
  const remaining = session.remaining - 1;
  return {
    ...session,
    position: target,
    remaining,
    branch: remaining > 0 && exits(target).length > 1,
    game:
      remaining === 0
        ? dispatchTrading(session.game, {
            type: "arrive",
            id: `arrival:${session.game.round}`,
            location: target,
          })
        : session.game,
  };
}
export function rollTradingSession(
  session: TradingSession,
  die: number,
): TradingSession {
  const phase = session.game.phase;
  if (
    !Number.isInteger(die) ||
    die < 1 ||
    die > 6 ||
    !(phase === "feedback" || (phase === "travel" && !session.rolled))
  )
    return session;
  const game = dispatchTrading(session.game, {
    type: "start-round",
    id: `round:${session.game.round + 1}`,
  });
  if (game === session.game) return session;
  return {
    ...session,
    game,
    die,
    remaining: die,
    rolled: true,
    branch: exits(session.position).length > 1,
  };
}
export function advanceTradingStep(session: TradingSession): TradingSession {
  if (
    session.game.phase !== "travel" ||
    !session.rolled ||
    session.remaining <= 0 ||
    session.branch
  )
    return session;
  return move(session, exits(session.position)[0]!);
}
export function chooseTradingBranch(
  session: TradingSession,
  target: LocationId,
): TradingSession {
  if (
    session.game.phase !== "travel" ||
    !session.branch ||
    session.remaining <= 0 ||
    !exits(session.position).includes(target)
  )
    return session;
  return move(session, target);
}
export function applyTradingAction(
  session: TradingSession,
  action: TradingAction,
): TradingSession {
  const game = dispatchTrading(session.game, action);
  if (game === session.game) return session;
  return game.phase === "report"
    ? { ...session, game, remaining: 0, branch: false }
    : { ...session, game };
}
