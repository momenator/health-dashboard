import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CopilotResponse } from "@/lib/ai-mock";

type ChatChartPayload = NonNullable<CopilotResponse["chart"]>;

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function ChatChart({ chart }: { chart: ChatChartPayload }) {
  if (!chart.data.length) return null;

  if (chart.type === "table" || !chart.xKey || !chart.yKey) {
    return <ChartTable chart={chart} />;
  }

  const data = chart.data.map((row) => ({
    ...row,
    [chart.yKey as string]: toNumber(row[chart.yKey as string]),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === "line" ? (
              <LineChart data={data} margin={{ top: 12, right: 18, left: -8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={chart.xKey}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={58}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={chart.yKey}
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            ) : chart.type === "pie" ? (
              <PieChart>
                <Tooltip />
                <Pie
                  data={data}
                  dataKey={chart.yKey}
                  nameKey={chart.xKey}
                  outerRadius={95}
                  label
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={data} margin={{ top: 12, right: 18, left: -8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={chart.xKey}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={58}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey={chart.yKey} fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartTable({ chart }: { chart: ChatChartPayload }) {
  const columns = Object.keys(chart.data[0] ?? {}).slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.data.slice(0, 20).map((row, index) => (
                <tr key={index} className="border-t">
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2 text-muted-foreground">
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
