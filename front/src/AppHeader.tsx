import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import SearchBar from "./SearchBar";
import MarketSegment from "./mt/MarketSegment";
import type { Market } from "./api/types";

type Props = {
  market: Market;
  setMarket: (m: Market) => void;
  query: string;
  setQuery: (v: string) => void;
  onSearch: (q: string) => void;
};

export default function AppHeader({
  market,
  setMarket,
  query,
  setQuery,
  onSearch,
}: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showBack = pathname !== "/";

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto w-full max-w-6xl px-4 py-3">
        {/* 모바일 헤더 */}
        <div className="flex items-center gap-3 md:hidden">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="뒤로 가기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          )}

          <div className="flex-1 min-w-0 flex flex-col items-center">
            <div className="text-xl font-semibold leading-none tracking-tight">
              AIStockHelper
            </div>
            <div className="mt-1">
              <MarketSegment value={market} onChange={setMarket} />
            </div>
          </div>

          <div className="h-9 w-9" />
        </div>

        {/* 데스크탑 헤더 */}
        <div className="hidden md:flex md:items-center md:gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="뒤로 가기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="text-lg font-semibold leading-none tracking-tight">
            AIStockHelper
          </div>
          <div className="flex-1 max-w-3xl ml-4">
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
          <div className="ml-3">
            <MarketSegment value={market} onChange={setMarket} />
          </div>
        </div>
      </div>
    </header>
  );
}
