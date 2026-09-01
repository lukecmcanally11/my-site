import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * The guestbook (Station 1.4): your first real database round-trip. Data
 * in (POST), stored in YOUR Supabase, data back out (GET). Every decision
 * service in Lanes 2–5 depends on this pattern.
 *
 * Setup happens in Station 1.3 (Chapter 3, Step 5): create your Supabase
 * project, run supabase/guestbook.sql in its SQL Editor, and set
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * (and in Vercel's Environment Variables).
 */

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const client = supabase();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase env vars not set. See .env.example and the README." },
      { status: 500 }
    );
  }
  const { data, error } = await client
    .from("guestbook")
    .select("name, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const client = supabase();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase env vars not set. See .env.example and the README." },
      { status: 500 }
    );
  }
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.message) {
    return NextResponse.json({ error: "name and message required" }, { status: 400 });
  }
  const { error } = await client
    .from("guestbook")
    .insert({ name: body.name, message: body.message });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
