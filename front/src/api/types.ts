export type Market = "korean" | "global";
export type Sentiment = "positive" | "neutral" | "negative";

export type NewsItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: Sentiment;
};

export type NewsResponse = {
  symbol: string;
  news: NewsItem[];
  sentimentCounts: Record<"positive" | "neutral" | "negative", number>;
};
