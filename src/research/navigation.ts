import { LOCATIONS, type LocationId } from "../game/content";
import { dispatchResearch } from "./campaign";
import type { ResearchAction, ResearchSession } from "./model";

function exits(location: LocationId): readonly LocationId[] {
  return LOCATIONS.find((place) => place.id === location)!.next;
}
function move(session: ResearchSession, target: LocationId): ResearchSession {
  const remaining = session.remaining - 1;
  return {
    ...session,
    position: target,
    remaining,
    branch: remaining > 0 && exits(target).length > 1,
    research:
      remaining === 0
        ? dispatchResearch(session.research, {
            type: "arrive",
            id: `arrival:${session.research.day}`,
            day: session.research.day,
            location: target,
          })
        : session.research,
  };
}
export function rollResearchDie(
  session: ResearchSession,
  die: number,
): ResearchSession {
  if (
    session.research.phase !== "travel" ||
    session.rolled ||
    !Number.isInteger(die) ||
    die < 1 ||
    die > 6
  )
    return session;
  return {
    ...session,
    die,
    remaining: die,
    rolled: true,
    branch: exits(session.position).length > 1,
  };
}
export function advanceResearchStep(session: ResearchSession): ResearchSession {
  if (
    session.research.phase !== "travel" ||
    !session.rolled ||
    session.remaining <= 0 ||
    session.branch
  )
    return session;
  return move(session, exits(session.position)[0]!);
}
export function chooseResearchBranch(
  session: ResearchSession,
  target: LocationId,
): ResearchSession {
  if (
    session.research.phase !== "travel" ||
    !session.branch ||
    session.remaining <= 0 ||
    !exits(session.position).includes(target)
  )
    return session;
  return move(session, target);
}
export function applyResearchAction(
  session: ResearchSession,
  action: ResearchAction,
): ResearchSession {
  const research = dispatchResearch(session.research, action);
  if (research === session.research) return session;
  if (research.phase === "exhibit")
    return {
      ...session,
      research,
      position: research.location,
      remaining: 0,
      branch: false,
    };
  if (research.phase === "travel" && research.day !== session.research.day)
    return {
      ...session,
      research,
      die: 0,
      rolled: false,
      branch: false,
      remaining: 0,
    };
  return { ...session, research };
}
