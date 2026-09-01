"use client";

import { useEffect, useState } from "react";

interface Entry {
  name: string;
  message: string;
  created_at: string;
}

/**
 * The guestbook UI. Talks to your own /api/guestbook routes, which talk to
 * your own Supabase table (see supabase/guestbook.sql). Until your env vars
 * are set, it shows a friendly setup nudge instead of breaking.
 */
export function Guestbook() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/guestbook");
    const body = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(body)) {
      setError(
        body?.error ??
          "Guestbook not reachable yet. Have you set your Supabase env vars and created the table? See supabase/guestbook.sql."
      );
      setEntries(null);
      return;
    }
    setError(null);
    setEntries(body);
  }

  useEffect(() => {
    load();
  }, []);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message }),
    });
    if (res.ok) {
      setName("");
      setMessage("");
      await load();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? `Signing failed (${res.status}).`);
    }
    setBusy(false);
  }

  return (
    <div className="mt-6">
      <form onSubmit={sign} className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent sm:w-48"
          />
          <input
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say hello…"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Signing…" : "Sign"}
          </button>
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-muted">{error}</p>}

      {entries && entries.length === 0 && (
        <p className="mt-4 text-sm text-muted">No entries yet. Be the first.</p>
      )}

      {entries && entries.length > 0 && (
        <ul className="mt-5 space-y-3">
          {entries.map((entry, i) => (
            <li key={`${entry.created_at}-${i}`} className="rounded-xl border border-line p-4">
              <p className="text-sm">{entry.message}</p>
              <p className="mt-1 text-xs text-muted">
                — {entry.name}
                {entry.created_at && `, ${new Date(entry.created_at).toLocaleDateString()}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
