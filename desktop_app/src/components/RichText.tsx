import type { RichText as RichTextValue } from "@/lib/dqi/types";

/** Renders rule descriptions with column names and values in monospace. */
export function RichText({ value }: { value: RichTextValue }) {
  return (
    <>
      {value.map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <code
            key={i}
            className="rounded bg-muted px-1 py-px font-mono text-[12px] text-foreground"
          >
            {part.code}
          </code>
        ),
      )}
    </>
  );
}
