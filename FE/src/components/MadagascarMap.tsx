// Stylized Madagascar district map placeholder.
import { VACCINATION_BY_DISTRICT } from "@/lib/sample-data";

const COLORS: Record<string, string> = {
  Ambanja: "var(--color-danger)",
  "Diego II": "var(--color-warning)",
  Antsiranana: "var(--color-success)",
  Sambava: "var(--color-success)",
  Andapa: "var(--color-success)",
  Vohémar: "var(--color-warning)",
};

const REGIONS = [
  { name: "Antsiranana", d: "M120,30 L170,40 L175,80 L130,90 Z" },
  { name: "Vohémar", d: "M175,80 L210,75 L215,130 L180,140 Z" },
  { name: "Sambava", d: "M180,140 L220,135 L225,190 L185,200 Z" },
  { name: "Andapa", d: "M140,150 L180,140 L185,200 L150,210 Z" },
  { name: "Diego II", d: "M85,55 L120,30 L130,90 L95,110 Z" },
  { name: "Ambanja", d: "M70,120 L130,90 L150,150 L100,180 Z" },
];

export function MadagascarMap() {
  return (
    <div className="relative">
      <svg viewBox="0 0 280 260" className="w-full h-full max-h-80">
        <defs>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <rect width="280" height="260" fill="var(--color-muted)" rx="12" />
        {REGIONS.map((r) => (
          <g key={r.name}>
            <path
              d={r.d}
              fill={COLORS[r.name] ?? "var(--color-primary)"}
              fillOpacity={0.7}
              stroke="var(--color-background)"
              strokeWidth="1.5"
              filter="url(#soft)"
            />
            <title>{r.name}</title>
          </g>
        ))}
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {VACCINATION_BY_DISTRICT.map((d) => (
          <div key={d.district} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ background: COLORS[d.district] ?? "var(--color-primary)" }}
              />
              <span className="truncate">{d.district}</span>
            </div>
            <span className="text-muted-foreground tabular-nums">{d.coverage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
