import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppHeader from "./AppHeader";
import SearchBar from "./SearchBar";
import { getNews } from "./api/client";
import type { Market, NewsResponse } from "./api/types";

type Props = {
  market: Market;
  setMarket: (m: Market) => void;
  query: string;
  setQuery: (v: string) => void;
  onSearch: (q: string) => Promise<void>;
};

export default function SearchResult({
  market,
  setMarket,
  query,
  setQuery,
  onSearch,
}: Props) {
  const params = useParams();
  const routeMarket = (
    params.market === "global" ? "global" : "korean"
  ) as Market;
  const routeQ = decodeURIComponent(params.q ?? "");

  useEffect(() => {
    if (market !== routeMarket) setMarket(routeMarket);
    if (routeQ && routeQ !== query) setQuery(routeQ);
  }, [routeMarket, routeQ]);

  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!query) return;

    setLoading(true);
    getNews(query, market)
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [query, market]);

  return (
    <div className="min-h-svh bg-white text-gray-900">
      {/* 헤더: 데스크탑/태블릿에선 헤더 내부에 검색창(= AppHeader가 담당) */}
      <AppHeader
        market={market}
        setMarket={setMarket}
        query={query}
        setQuery={setQuery}
        onSearch={onSearch}
      />

      {/* ⬇️ 모바일에서만 보이는 검색창 (헤더 아래) */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-3 md:hidden">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onSearch={onSearch}
          placeholder={
            market === "korean"
              ? "종목명을 입력해 검색하세요"
              : "종목명 또는 ticker를 입력해 검색하세요"
          }
        />
      </div>

      {/* 본문 영역 */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6"></main>
    </div>
  );
}
