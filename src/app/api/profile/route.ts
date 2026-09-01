import { NextResponse } from "next/server";
import { profile } from "@/profile";

/**
 * Your roster card (Station 1.4). The course platform calls this on every
 * student site and assembles the class photo roster automatically: a page
 * nobody had to fill out a form for. Edit src/profile.ts, not this file.
 */
export async function GET(request: Request) {
  // The photo lives in this site's public/ folder; the roster needs an
  // absolute URL, so we build one from wherever this site is deployed.
  const photoUrl = new URL(profile.photoPath, request.url).toString();

  return NextResponse.json({
    displayName: profile.displayName,
    photoUrl,
    hometown: profile.hometown,
    funFacts: profile.funFacts,
    decisionImProudOf: profile.decisionImProudOf,
    rosterVisibility: profile.rosterVisibility,
  });
}
