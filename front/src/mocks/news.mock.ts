import type { Market, NewsItem, NewsResponse, Sentiment } from "../api/types";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const SENTS: Sentiment[] = ["positive", "neutral", "negative"];

function makeNewsItems(symbol: string, market: Market, count = 9): NewsItem[] {
  const now = Date.now();

  const titlesKR = [
    "실적 호조, 컨센 상회",
    "신제품 출시 예정",
    "공급망 이슈",
    "규제 관련 이슈",
    "대규모 수주 공시",
    "증권사 리포트",
    "배당 정책 발표",
    "경영진 발언",
    "해외 진출 발표",
  ];
  const titlesEN = [
    "Beats earnings expectations",
    "New product launch",
    "Supply-chain concerns",
    "Regulatory headline",
    "Large order backlog",
    "Analyst note",
    "Dividend policy update",
    "Management commentary",
    "Overseas expansion",
  ];

  const sourcesKR = ["Naver", "연합뉴스", "매일경제", "한국경제"];
  const sourcesEN = ["Yahoo", "Reuters", "Bloomberg", "MarketWatch"];

  return Array.from({ length: count }).map((_, i) => {
    const sentiment = SENTS[i % 3];
    const title =
      market === "korean"
        ? titlesKR[i % titlesKR.length]
        : titlesEN[i % titlesEN.length];
    const source =
      market === "korean"
        ? sourcesKR[i % sourcesKR.length]
        : sourcesEN[i % sourcesEN.length];

    return {
      id: `${symbol}-${market}-${i}`,
      title,
      description:
        market === "korean"
          ? `${symbol} 관련 모크 뉴스 요약입니다. (${sentiment})`
          : `Mock news summary for ${symbol}. (${sentiment})`,
      url: "#",
      source,
      publishedAt: new Date(now - i * 3600_000).toISOString(),
      sentiment,
    };
  });
}

export async function mockGetNews(
  symbol: string,
  market: Market
): Promise<NewsResponse> {
  await delay();
  const news = makeNewsItems(symbol.toUpperCase(), market);
  const sentimentCounts = {
    positive: news.filter((n) => n.sentiment === "positive").length,
    neutral: news.filter((n) => n.sentiment === "neutral").length,
    negative: news.filter((n) => n.sentiment === "negative").length,
  };
  return { symbol, news, sentimentCounts };
}
