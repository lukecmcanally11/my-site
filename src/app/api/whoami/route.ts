import { NextResponse } from "next/server";
import { profile } from "@/profile";

/**
 * Who runs this site (Station 1.4). The email must match the one you use
 * to sign into the course platform. Edit src/profile.ts, not this file.
 */
export async function GET() {
  return NextResponse.json({
    name: profile.displayName,
    email: profile.email,
  });
}
