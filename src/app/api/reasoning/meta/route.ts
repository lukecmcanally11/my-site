import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "reasoning", // which decision service is answering
    specVersion: "1", // which version of the problem format it speaks
    studentToken: process.env.SITE_TOKEN, // proves this service is yours
  });
}