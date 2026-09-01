import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Reasoning & Uncertainty — coming soon" };

/**
 * ── TODO: Lane 2 — your /reasoning page ──────────────────────────────────
 * Challenge 2's page check expects this page to DISPLAY the same answers
 * your /api/reasoning/decide just gave, bound via data-reasoning="..."
 * attributes. Build it when you take on the challenge (Chapters 5–9).
 */
export default function ReasoningPage() {
  return (
    <ComingSoon
      lane={2}
      title="Reasoning & Uncertainty"
      description="A service that audits syllogisms, updates beliefs on base rates, and reads Bernoulli businesses. Built after Lane 2."
    />
  );
}
