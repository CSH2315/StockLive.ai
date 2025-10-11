type StockChartProps = {
  loading?: boolean;
};

export default function StockChart({ loading }: StockChartProps) {
  return (
    <section className="mb-6">
      <h3 className="sr-only">주식 차트</h3>
      <div className="h-64 w-full rounded-md border bg-gray-50 flex items-center justify-center">
        {loading ? "차트 로딩..." : "(주식 차트 들어가는곳)"}
      </div>
    </section>
  );
}
