import type { DispositionId, MissionData, Seat } from "../../../shared/src/types.ts";
import { RulesError } from "./scoring.ts";

export interface TwistChoice { id: string; mirroredPrimaryId?: string }

/** Look up each player's primary from the disposition matrix, then apply primary-changing twists. */
export function resolvePrimaries(
  data: MissionData, disp: Record<Seat, DispositionId>, twist?: TwistChoice,
): Record<Seat, string> {
  const look = (mine: DispositionId, theirs: DispositionId) => {
    const id = data.matrix[mine]?.[theirs];
    if (!id) throw new RulesError("matrix", `No primary for ${mine} vs ${theirs}`);
    return id;
  };
  let result: Record<Seat, string> = { A: look(disp.A, disp.B), B: look(disp.B, disp.A) };
  if (!twist) return result;

  const t = data.twists.find((x) => x.id === twist.id);
  if (!t) throw new RulesError("twist", `Unknown twist ${twist.id}`);
  if (t.effect === "scrambled-communications") {
    result = { A: result.B, B: result.A };
  } else if (t.effect === "mirrored-world") {
    const pick = twist.mirroredPrimaryId;
    if (!pick || !(t.mirroredOptions ?? []).includes(pick)) {
      throw new RulesError("twist", "Choose (or roll) one of the listed primaries for Mirrored World");
    }
    result = { A: pick, B: pick };
  }
  return result;
}

/** Roll for Mirrored World: D6, re-roll a 6. `d6` returns 1..6. */
export function rollMirrored(options: string[], d6: () => number): string {
  for (let i = 0; i < 100; i++) {
    const r = d6();
    if (r >= 1 && r <= options.length) return options[r - 1];
  }
  return options[0];
}
