import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import SearchBar from "./SearchBar";
import { getPrice, getNews, getStockInfo } from "./api/client";
import type { Market, NewsResponse, PriceResponse } from "./api/types";
import StockHeader from "./StockHeader";
import StockChart from "./StockChart";
import StockNews from "./StockNews";

type Props = {
  market: Market;
  setMarket: (m: Market) => void;
  query: string;
  setQuery: (v: string) => void;
  onSearch: (q: string) => Promise<void>;
};

export default function SearchResult({ setMarket, setQuery }: Props) {
  const params = useParams();
  const navigate = useNavigate();


  const routeMarket = (
    params.market === "global" ? "global" : "korean"
  ) as Market;
  const routeQ = decodeURIComponent(params.q ?? "");

  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState<PriceResponse | null>(null);
  const [error, setError] = useState<{ news?: string; price?: string }>({});
  const [stockName, setStockName] = useState<string>("");

  const latest = price?.prices?.length
    ? price.prices[price.prices.length - 1]
    : undefined;

  // 부모 state 동기화
  useEffect(() => {
    setMarket(routeMarket);
    setQuery(routeQ);
  }, [routeMarket, routeQ, setMarket, setQuery]);

  // 세그먼트 변경 시 홈으로 이동 (에러 방지)
  const handleMarketChange = (newMarket: Market) => {
    if (newMarket !== routeMarket) {
      setMarket(newMarket); // 부모 state 먼저 업데이트
      navigate("/");
    }
  };

  // URL params를 직접 보고 데이터 fetch (query state 무시)
  useEffect(() => {
    if (!routeQ) {
      setData(null);
      setPrice(null);
      setStockName("");
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    // 새 검색 시작할 때 이전 데이터 클리어
    setData(null);
    setPrice(null);
    setStockName("");
    setError({});

    // 해외 주식이면 회사명도 가져오기
    const stockInfoPromise =
      routeMarket === "global"
        ? getStockInfo(routeQ)
            .then((info) => {
              if (!alive) return;
              console.log("🏢 주식 정보:", info);
              setStockName(info.name);
            })
            .catch((err) => {
              if (!alive) return;
              console.error("주식 정보 로딩 실패:", err);
              setStockName(routeQ); // 실패 시 ticker 그대로
            })
        : Promise.resolve();

    // Promise 각각 처리 (하나가 느려도 다른 건 먼저 표시)
    const newsPromise = getNews(routeQ, routeMarket)
      .then((newsData) => {
        if (!alive) return;
        setData(newsData);
      })
      .catch((err) => {
        if (!alive) return;
        console.error("뉴스 로딩 실패:", err);
        setData(null);
        setError((prev) => ({
          ...prev,
          news: err.message || "뉴스를 불러올 수 없습니다",
        }));
      });

    const pricePromise = getPrice(routeQ, routeMarket)
      .then((priceData) => {
        if (!alive) return;
        setPrice(priceData);
      })
      .catch((err) => {
        if (!alive) return;
        console.error("가격 로딩 실패:", err);
        setPrice(null);
        setError((prev) => ({
          ...prev,
          price: err.message || "가격 정보를 불러올 수 없습니다",
        }));
      });

    Promise.all([newsPromise, pricePromise, stockInfoPromise]).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [routeQ, routeMarket]); // URL params만 감시

  // 검색 버튼 클릭 시 URL만 변경 (데이터는 위 useEffect가 자동 처리)
  const handleSearch = (q: string) => {
    if (!q.trim()) return;
    navigate(`/search/${routeMarket}/${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-svh bg-white text-gray-900">
      <AppHeader
        market={routeMarket}
        setMarket={handleMarketChange}
        query={routeQ}
        setQuery={setQuery}
        onSearch={handleSearch}
      />

      {/* 모바일 검색창 */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-3 md:hidden">
        <SearchBar
          defaultValue={routeQ}
          onSearch={handleSearch}
          placeholder={
            routeMarket === "korean"
              ? "종목명을 입력해 검색하세요"
              : "종목명 또는 ticker를 입력해 검색하세요"
          }
          loading={loading}
        />
      </div>

      {/* 본문 영역 */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <StockHeader
              name={routeMarket === "global" && stockName ? stockName : routeQ}
              ticker={routeMarket === "global" ? routeQ : undefined}
              price={latest?.close}
              currency={routeMarket === "korean" ? "KRW" : "USD"}
              loading={loading}
            />
          </div>

          <div>
            <StockChart
              data={price?.prices}
              loading={loading}
              error={error.price}
            />
          </div>

          <div className="md:col-span-2">
            <StockNews data={data} loading={loading} error={error.news} />
          </div>
        </div>
      </main>
    </div>
  );
}
