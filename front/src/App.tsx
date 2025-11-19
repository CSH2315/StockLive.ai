import { useState, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import SearchBar from "./SearchBar";
import { Routes, Route, useNavigate } from "react-router-dom";
import type { Market } from "./api/types";
const MarketSegment = lazy(() => import("./mt/MarketSegment"));
const Coachmark = lazy(() => import("./Coachmark"));
import SearchResult from "./SearchResult";

function MarketTab({
  market,
  setMarket,
}: {
  market: Market;
  setMarket: (m: Market) => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3"
      data-coachmark="market-segment"
    >
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

  const handleSearch = (q: string) => {
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

  // URL만 변경 (데이터 fetch는 SearchResult가 담당)
  const onSearch = (q: string) => {
    if (!q.trim()) return;
    navigate(`/search/${market}/${encodeURIComponent(q)}`);
  };

  const placeholder =
    market === "korean"
      ? "종목명을 입력해 검색하세요"
      : "Ticker를 입력해 검색하세요";

  return (
    <>
      <Suspense fallback={null}>
        <Coachmark />
      </Suspense>
      <Routes>
        <Route
          path="/"
          element={
            <div className="min-h-svh bg-white text-gray-900 flex items-center justify-center">
              <main className="w-full max-w-xl md:max-w-2xl px-4">
                <h1 className="text-2xl font-bold text-center mb-6">
                  StockLive.ai
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
    </>
  );
}
