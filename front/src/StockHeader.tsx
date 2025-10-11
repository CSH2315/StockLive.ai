type StockHeaderProps = {
  name?: string; // ex) "Apple Inc."
  ticker?: string; // ex) "AAPL"
  price?: number; // mock 없으면 undefined
  currency?: string; // ex) "USD", "KRW"
  loading?: boolean;
};

export default function StockHeader({
  name,
  ticker,
  price,
  currency = "",
  loading,
}: StockHeaderProps) {
  if (loading) {
    return (
      <section className="mb-4">
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="mt-2 h-12 w-64 rounded bg-gray-100 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="mb-4">
      <h2 className="text-2xl font-semibold">
        {name ?? "Name"}
        {ticker ? ` (${ticker})` : ""}
      </h2>
      <div className="mt-2 inline-flex items-baseline gap-2">
        {price != null ? (
          <span className="text-3xl font-bold">
            {price.toLocaleString()} {currency}
          </span>
        ) : (
          <span className="inline-block h-12 w-64 rounded bg-gray-100" />
        )}
      </div>
    </section>
  );
}
