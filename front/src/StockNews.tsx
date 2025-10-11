import type { NewsResponse, Sentiment } from "@/api/types";

type Props = {
  data: NewsResponse | null;
  loading?: boolean;
};

export default function StockNews({ data, loading }: Props) {
  const counts = data?.sentimentCounts ?? {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  const total = counts.positive + counts.neutral + counts.negative;

  const headline = total === 0 ? "뉴스가 없어요." : dominantText(counts);

  return (
    <section>
      <h3 className="text-sm text-gray-600 mb-2">최근 소식</h3>

      <div className="mb-4 w-full flex flex-col items-center">
        <div className="w-full max-w-md rounded bg-gray-100 py-2 text-center font-medium">
          {loading ? "로딩 중..." : headline}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge color="green" label="Positive" value={counts.positive} />
          <Badge color="yellow" label="Neutral" value={counts.neutral} />
          <Badge color="red" label="Negative" value={counts.negative} />
        </div>
      </div>

      <ul className="space-y-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="h-16 rounded border bg-gray-50 animate-pulse"
            />
          ))}

        {!loading && (data?.news?.length ?? 0) === 0 && (
          <li className="rounded border p-4 text-sm text-gray-500">
            표시할 뉴스가 없습니다.
          </li>
        )}

        {!loading &&
          data?.news?.map((n) => (
            <li key={n.id} className="rounded border p-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                  title={n.title}
                >
                  {n.title}
                </a>
                <SentimentPill s={n.sentiment} />
              </div>

              {n.description && (
                <p className="mt-1 text-sm text-gray-700 line-clamp-2">
                  {n.description}
                </p>
              )}

              <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-3">
                <span>{n.source}</span>
                {n.publishedAt && (
                  <time dateTime={n.publishedAt}>{fmtDate(n.publishedAt)}</time>
                )}
              </div>
            </li>
          ))}
      </ul>
    </section>
  );
}

function Badge({
  color,
  label,
  value,
}: {
  color: "green" | "yellow" | "red";
  label: string;
  value: number;
}) {
  const colorMap = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${colorMap[color]}`}
    >
      {label} <strong>{value}</strong>
    </span>
  );
}

function SentimentPill({ s }: { s: Sentiment }) {
  const cls =
    s === "positive"
      ? "bg-green-100 text-green-800"
      : s === "neutral"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {s}
    </span>
  );
}

function dominantText(
  counts: Record<"positive" | "neutral" | "negative", number>
) {
  const { positive, neutral, negative } = counts;
  const max = Math.max(positive, neutral, negative);
  const label =
    max === positive ? "긍정적" : max === neutral ? "중립적" : "부정적";
  return `${label}인 소식이 많아요!`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
