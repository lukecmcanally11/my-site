import { NextResponse } from "next/server";

/**
 * The honest placeholder for services you haven't built yet. Returning 501
 * (Not Implemented) means the course's probes correctly FAIL these routes
 * until you do the lane's work. A stub that faked a passing answer would
 * defeat the whole point.
 */
export function notBuiltYet(lane: number, challenge: string) {
  return NextResponse.json(
    { error: `Not built yet. This is your Lane ${lane} challenge (${challenge}).` },
    { status: 501 }
  );
}
