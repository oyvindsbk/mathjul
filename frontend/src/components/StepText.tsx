import type { InstructionSegment } from "@/lib/instruction-mentions";

/**
 * Renders an instruction step's resolved segments.
 *
 * Mentions get a subtle emphasis so they read as data rather than prose. A
 * mention whose ingredient is gone (`resolved: false`) is deliberately styled
 * as ordinary text — the sentence still reads, it just stopped scaling, and
 * the reader has nothing to act on.
 */
export function StepText({ segments }: { segments: InstructionSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "mention" && segment.resolved ? (
          <span key={index} className="font-semibold text-gray-900" data-mention>
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
