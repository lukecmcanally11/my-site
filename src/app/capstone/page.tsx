import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Capstone — coming soon" };

/**
 * ── TODO: Lane 5 — your /capstone page ───────────────────────────────────
 * The capstone's page check expects a full advocacy report here (the
 * Patrick standard from Chapter 22), bound to your API's live answers via
 * data-capstone="..." attributes. Build it when you take on the challenge
 * (Chapters 20–22).
 */
export default function CapstonePage() {
  return (
    <ComingSoon
      lane={5}
      title="Capstone: Live Decision Service"
      description="A full advocacy report on a decision domain I choose (staffing, inventory, pricing, or channels). Built after Lane 5."
    />
  );
}
