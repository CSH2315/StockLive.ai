import { useState, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import SearchBar from "./SearchBar";
import SearchResult from "./SearchResult";
import { getNews } from "./api/client";
import { Routes, Route, useNavigate } from "react-router-dom";
import type { Market } from "./api/types";
const MarketSegment = lazy(() => import("./mt/MarketSegment"));

function MarketTab({
  market,
  setMarket,
}: {
  market: Market;
  setMarket: (m: Market) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <h2 className="sr-only">관리</h2>
      <ErrorBoundary>
        <Suspense fallback={<div className="p-3">로딩 중...</div>}>
          <MarketSegment value={market} onChange={setMarket} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function StockSearchBar({
  placeholder,
  market,
}: {
  placeholder: string;
  market: Market;
}) {
  const navigate = useNavigate();

  const handleSearch = async (q: string) => {
    const data = await getNews(q, market);
    console.log("뉴스 응답:", data);

    navigate(`/search/${market}/${encodeURIComponent(q)}`);
  };

  return (
    <div className="w-full flex justify-center">
      <SearchBar
        onSearch={handleSearch}
        placeholder={placeholder}
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
      />
    </div>
  );
}

export default function App() {
  const [market, setMarket] = useState<Market>("korean");
  const [query, setQuery] = useState<string>("");
  const navigate = useNavigate();
  const onSearch = async (q: string) => {
    const data = await getNews(q, market);
    console.log("뉴스 응답:", data);
    setQuery(q); // 검색어 보관
    navigate(`/search/${market}/${encodeURIComponent(q)}`);
  };
  const placeholder =
    market === "korean"
      ? "종목명을 입력해 검색하세요"
      : "종목명 또는 ticker를 입력해 검색하세요";

  console.log("App render");

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-svh bg-white text-gray-900 flex items-center justify-center">
            <main className="w-full max-w-xl md:max-w-2xl px-4">
              <h1 className="text-2xl font-bold text-center mb-6">
                AIStockHelper
              </h1>
              <div className="flex flex-col items-center gap-4">
                <MarketTab market={market} setMarket={setMarket} />
                <StockSearchBar
                  placeholder={placeholder}
                  market={market}
                  key={market}
                />
              </div>
            </main>
          </div>
        }
      />
      <Route
        path="/search/:market/:q"
        element={
          <SearchResult
            market={market}
            setMarket={setMarket}
            query={query}
            setQuery={setQuery}
            onSearch={onSearch}
          />
        }
      />
    </Routes>
  );
}
