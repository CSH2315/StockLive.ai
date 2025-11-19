// client.ts
import type { Market, NewsItem, NewsResponse, PriceResponse } from "./types";
import { mockGetNews } from "../mocks/news.mock";

// --- 환경 변수 ---
const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";
// 예: VITE_API_BASE_URL=http://localhost:8000
const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

// 글로벌 뉴스는 느리니까 기본 60초로 증가
const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 60000);

// --- 공통: JSON fetch + 타임아웃/에러 처리 ---
async function getJSON<T = any>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT
): Promise<T> {
  // 1) 타임아웃 컨트롤러
  const timeoutController = new AbortController();

  // 2) 호출자 시그널과 타임아웃 시그널 병합
  //    - 최신 브라우저: AbortSignal.any 사용
  //    - 폴백: 호출자 시그널이 abort되면 타임아웃 컨트롤러를 abort시키는 방식
  const userSignal = init.signal as AbortSignal | undefined;
  let signal: AbortSignal = timeoutController.signal;

  if (userSignal) {
    if ("any" in AbortSignal) {
      signal = (AbortSignal as any).any([userSignal, timeoutController.signal]);
    } else {
      if (userSignal.aborted) {
        // 이미 abort되어 들어오면 즉시 동일 사유로 abort
        timeoutController.abort((userSignal as any).reason);
      } else {
        userSignal.addEventListener(
          "abort",
          () => timeoutController.abort((userSignal as any).reason),
          { once: true }
        );
      }
      signal = timeoutController.signal;
    }
  }

  // 3) 타임아웃 타이머
  const timer = setTimeout(() => {
    // 이유를 넣어주면 디버깅 편함
    try {
      // DOMException은 브라우저/런타임에 따라 없을 수 있음 → 문자열 허용
      timeoutController.abort(new DOMException("Timeout", "TimeoutError"));
    } catch {
      timeoutController.abort("Timeout");
    }
  }, timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init, // 호출자 옵션 먼저
      // 안전한 헤더 병합
      headers: {
        Accept: "application/json",
        ...(init.headers || {}),
      },
      // 마지막에 병합 시그널 주입(호출자 signal을 덮어씀)
      signal,
      method: init.method ?? "GET",
      mode: init.mode ?? "cors",
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${msg}`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    // AbortError를 구분해서 메시지 명확화
    if (err?.name === "AbortError") {
      const cause = userSignal?.aborted
        ? "caller-abort"
        : "timeout-or-external-abort";
      throw new Error(`AbortError: ${cause}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

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
  // FastAPI 글로벌: { symbol, sentiment_counts, news } 또는 { body: [...] } 지원
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

  // 글로벌 뉴스는 90초 타임아웃 (더 느림)
  const timeout = market === "global" ? 120000 : DEFAULT_TIMEOUT;
  const data = await getJSON<any>(path, {}, timeout);

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

export async function getPrice(
  symbolOrName: string,
  market: Market
): Promise<PriceResponse> {
  const path =
    market === "korean"
      ? `/price/korea/by-name/${encodeURIComponent(symbolOrName)}?days=30`
      : `/price/global/${encodeURIComponent(
          symbolOrName
        )}?range=1mo&interval=1d`;

  // BASE_URL을 반드시 붙여서 호출
  return await getJSON<PriceResponse>(path);
}

// 주식 정보 조회 (해외 주식의 회사명 가져오기)
export async function getStockInfo(symbol: string): Promise<{
  symbol: string;
  name: string;
  currency: string;
}> {
  const path = `/stock/info/${encodeURIComponent(symbol)}`;
  return await getJSON(path);
}
