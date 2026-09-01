import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Causality Audit — coming soon" };

/**
 * ── TODO: Lane 4 — your /causality page ──────────────────────────────────
 * Challenge 4's page check expects this page to DISPLAY the same answers
 * your /api/causality/decide just gave, bound via data-causality="..."
 * attributes. Build it when you take on the challenge (Chapters 15–19).
 */
export default function CausalityPage() {
  return (
    <ComingSoon
      lane={4}
      title="Causality Audit"
      description="A service that tells forks from pipes from colliders, and knows when to stratify. Built after Lane 4."
    />
  );
}
