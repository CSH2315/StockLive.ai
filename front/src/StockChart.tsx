import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
} from "recharts";
import type { PriceItem } from "./api/types";

type StockChartProps = {
  data?: PriceItem[];
  loading?: boolean;
  error?: string;
};

export default function StockChart({ data, loading, error }: StockChartProps) {
  if (loading) {
    return (
      <section className="mb-6">
        <h3 className="sr-only">주식 차트</h3>
        <div className="h-64 w-full rounded-md border bg-gray-50 flex items-center justify-center">
          "차트 로딩..."
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">주가 차트</h3>
        <div className="h-64 w-full rounded-md border border-red-200 bg-red-50 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-800 font-medium mb-1">
              차트를 불러올 수 없습니다
            </p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) {
    return (
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">주가 차트</h3>
        <div className="h-64 w-full rounded-md border bg-gray-50 flex items-center justify-center">
          데이터가 없습니다
        </div>
      </section>
    );
  }

  // 밀리초 timestamp → 날짜 레이블로 변환
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.ts).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <section className="mb-6">
      <h3 className="text-lg font-semibold mb-2">주가 차트</h3>
      <div className="h-64 w-full rounded-md border bg-gray-50">
        <ResponsiveContainer>
          <ComposedChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => v.toLocaleString("ko-KR")}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: number) => v.toLocaleString("ko-KR")}
              labelFormatter={(l) => `${l}`}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
