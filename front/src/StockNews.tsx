import { useEffect } from "react";
import type { NewsResponse, Sentiment } from "./api/types";

// RFC 2822(pubDate) → ISO 보정
function toISO(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

// Unknown 등은 neutral로 다운그레이드(정책 맞게 조절 가능)
function normalizeSentiment(s?: string): Sentiment {
  const k = (s ?? "").toLowerCase();
  return k === "positive" || k === "negative" ? (k as Sentiment) : "neutral";
}

type Props = {
  data: NewsResponse | null;
  loading?: boolean;
  error?: string;
};

export default function StockNews({ data, loading, error }: Props) {
  // 실제로 뭐가 오는지 확인
  useEffect(() => {
    if (data) {
      // console.log("📰 StockNews 받은 데이터:", data);
      // console.log("📰 뉴스 개수:", data.news?.length);
      // console.log("📰 감정 카운트:", data.sentimentCounts);
    }
  }, [data]);

  // 로딩 중
  if (loading) {
    return (
      <section>
        <h3 className="text-sm text-gray-600 mb-2">최근 소식</h3>
        <div className="mb-4 w-full flex flex-col items-center">
          <div className="w-full max-w-md rounded bg-gray-100 py-2 text-center font-medium">
            로딩 중...
          </div>
        </div>
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="h-16 rounded border bg-gray-50 animate-pulse"
            />
          ))}
        </ul>
      </section>
    );
  }

  // 에러 발생
  if (error) {
    return (
      <section>
        <h3 className="text-sm text-gray-600 mb-2">최근 소식</h3>
        <div className="rounded border border-red-200 bg-red-50 p-4">
          <p className="text-red-800 font-medium mb-1">
            뉴스를 불러올 수 없습니다
          </p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </section>
    );
  }

  // 감정 카운트: camelCase 우선, 없으면 snake_case 사용 + Unknown은 neutral에 합산
  const scCamel = (data as any)?.sentimentCounts;
  const scSnake = (data as any)?.sentiment_counts;
  const counts = scCamel
    ? scCamel
    : {
        positive: scSnake?.positive ?? 0,
        neutral:
          (scSnake?.neutral ?? 0) + (scSnake?.Unknown ?? scSnake?.unknown ?? 0),
        negative: scSnake?.negative ?? 0,
      };

  const total =
    (counts?.positive ?? 0) + (counts?.neutral ?? 0) + (counts?.negative ?? 0);

  const headline = total === 0 ? "뉴스가 없어요." : dominantText(counts);

  // 뉴스 아이템 정규화(id/url/publishedAt/sentiment)
  const items =
    (data?.news ?? []).map((n: any) => {
      const url = n.url ?? n.link ?? "";
      let source = n.source as string | undefined;
      if (!source && url) {
        try {
          source = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          /* empty */
        }
      }
      return {
        id: n.id ?? n.guid ?? url,
        title: n.title,
        description: n.description,
        url,
        source,
        publishedAt: n.publishedAt ?? toISO(n.pubDate),
        sentiment: normalizeSentiment(n.sentiment),
      };
    }) ?? [];

  return (
    <section>
      <h3 className="text-sm text-gray-600 mb-2">최근 소식</h3>

      {/* 가운데 정렬된 요약/배지 */}
      <div className="mb-4 w-full flex flex-col items-center">
        <div className="w-full max-w-md rounded bg-gray-100 py-2 text-center font-medium">
          {headline}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge color="green" label="Positive" value={counts?.positive ?? 0} />
          <Badge color="yellow" label="Neutral" value={counts?.neutral ?? 0} />
          <Badge color="red" label="Negative" value={counts?.negative ?? 0} />
        </div>
      </div>

      {/* 뉴스 리스트 */}
      <ul className="space-y-3">
        {items.length === 0 && (
          <li className="rounded border p-4 text-sm text-gray-500">
            표시할 뉴스가 없습니다.
          </li>
        )}

        {items.map((n) => (
          <li key={n.id} className="rounded border p-3 hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
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
              {n.source && <span>{n.source}</span>}
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
  const { positive = 0, neutral = 0, negative = 0 } = counts ?? {};
  const max = Math.max(positive, neutral, negative);
  const label =
    max === positive ? "긍정적" : max === neutral ? "중립적" : "부정적";
  return `${label}인 소식이 많아요!`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR");
}
