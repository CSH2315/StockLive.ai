import type { Market, NewsItem, NewsResponse } from "./types";
import { mockGetNews } from "../mocks/news.mock";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";
const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

// --- 어댑터: 서버 응답 -> 프론트 타입 ---

function adaptKoreanNews(symbol: string, body: any): NewsResponse {
  const list: any[] = Array.isArray(body?.news) ? body.news : [];
  const news: NewsItem[] = list.map((it: any, i: number) => ({
    id: String(it.guid ?? it.link ?? i),
    title: String(it.title ?? ""),
    description: String(it.description ?? ""),
    url: String(it.link ?? "#"),
    source: "Naver",
    publishedAt: String(it.pubDate ?? new Date().toISOString()),
    sentiment: it.sentiment ?? "unknown",
  }));
  const sentimentCounts = {
    positive: news.filter((n) => n.sentiment === "positive").length,
    neutral: news.filter((n) => n.sentiment === "neutral").length,
    negative: news.filter((n) => n.sentiment === "negative").length,
  };
  return { symbol, news, sentimentCounts };
}

function adaptGlobalNews(symbol: string, body: any): NewsResponse {
  // FastAPI 글로벌: { symbol, sentiment_counts, news } 형태 (or body)
  const list: any[] = Array.isArray(body?.news)
    ? body.news
    : Array.isArray(body?.body)
    ? body.body
    : [];
  const news: NewsItem[] = list.map((it: any, i: number) => ({
    id: String(it.guid ?? it.link ?? i),
    title: String(it.title ?? it.headline ?? ""),
    description: String(it.description ?? it.summary ?? ""),
    url: String(it.link ?? it.url ?? "#"),
    source: String(it.publisher ?? it.source ?? "Yahoo"),
    publishedAt: String(
      it.pubDate ?? it.published_at ?? new Date().toISOString()
    ),
    sentiment: it.sentiment ?? "unknown",
  }));
  const counts = body?.sentiment_counts;
  const sentimentCounts = counts
    ? {
        positive: Number(counts.positive ?? 0),
        neutral: Number(counts.neutral ?? 0),
        negative: Number(counts.negative ?? 0),
      }
    : {
        positive: news.filter((n) => n.sentiment === "positive").length,
        neutral: news.filter((n) => n.sentiment === "neutral").length,
        negative: news.filter((n) => n.sentiment === "negative").length,
      };
  return { symbol, news, sentimentCounts };
}

// --- 실제 서버 호출 ---

async function realGetNews(
  symbol: string,
  market: Market
): Promise<NewsResponse> {
  const path =
    market === "global"
      ? `/news/global/${encodeURIComponent(symbol)}`
      : `/news/korea/${encodeURIComponent(symbol)}`;

  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  return market === "global"
    ? adaptGlobalNews(symbol, data)
    : adaptKoreanNews(symbol, data);
}

// --- 공개 API (페이지는 이 함수만 사용) ---

export async function getNews(
  symbol: string,
  market: Market
): Promise<NewsResponse> {
  if (USE_MOCK) return mockGetNews(symbol, market);
  return realGetNews(symbol, market);
}
