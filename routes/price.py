from fastapi import APIRouter, HTTPException, Query
from pykrx import stock
from bs4 import BeautifulSoup
from typing import Optional
import pandas as pd
import re, time, requests, functools, datetime as dt, pytz, math

router = APIRouter(prefix="/price")

YH_CHARTS = [
    "https://query2.finance.yahoo.com/v8/finance/chart/{sym}",
    "https://query1.finance.yahoo.com/v8/finance/chart/{sym}",  # fallback
]

YH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/127.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

def fetch_yahoo(sym: str, range="1mo", interval="1d"):
    last_err = None
    for i, base in enumerate(YH_CHARTS):
        try:
            url = base.format(sym=sym)
            params = {
                "range": range,
                "interval": interval,
                "events": "div,splits",
                "includePrePost": "false",
            }
            r = requests.get(url, params=params, headers=YH_HEADERS, timeout=6)
            r.raise_for_status()
            payload = r.json()
            result = payload["chart"]["result"][0]
            q = result["indicators"]["quote"][0]
            ts = result.get("timestamp", []) or []

            prices = []
            for t, o, h, l, c in zip(ts, q["open"], q["high"], q["low"], q["close"]):
                if o is None or c is None:  # 결측치 보호
                    continue
                prices.append({"ts": t * 1000, "open": o, "high": h, "low": l, "close": c})

            return {
                "meta": result.get("meta", {}),
                "prices": prices,
                "currency": result.get("meta", {}).get("currency"),
            }
        except Exception as e:
            last_err = e
            if i == 0:
                time.sleep(0.2)  # 짧은 대기 후 fallback
            continue
    # 두 엔드포인트 모두 실패
    raise HTTPException(502, f"Yahoo API error: {last_err}")


@router.get("/global/{symbol}")
def price_global(symbol:str, range:str="1mo", interval:str="1d"):
    return fetch_yahoo(symbol, range, interval)

def fetch_naver_price(code:str):
    url = f"https://finance.naver.com/item/sise.naver?code={code}"
    r = requests.get(url, headers={"User-Agent":"Mozilla"}, timeout=3)
    soup = BeautifulSoup(r.text, "html.parser")
    price = soup.select_one("#_nowVal").text.replace(",","")
    return {"price": float(price), "currency": "KRW"}


def _normalize_kor(s: str) -> str:
    # 공백 제거 + 소문자 (한글은 소문자 영향 없음, 영문 섞인 종목 대응)
    return re.sub(r"\s+", "", s).lower()

# 한 번 만들어두고 프로세스가 살아있는 동안 캐싱
_name_to_code_map: Optional[dict[str, str]] = None

def _build_name_code_map() -> dict[str, str]:
    # KOSPI+KOSDAQ 전체 조회
    tickers = stock.get_market_ticker_list(market="ALL")
    m: dict[str, str] = {}
    for code in tickers:
        name = stock.get_market_ticker_name(code)  # 예: "삼성전자"
        m[name] = code
        m[_normalize_kor(name)] = code  # 정규화 키도 함께 저장(공백 제거 등)
    return m

def _resolve_korea_code(name_or_code: str) -> Optional[str]:
    global _name_to_code_map
    s = name_or_code.strip()

    # 이미 6자리 숫자면 코드로 간주
    if re.fullmatch(r"\d{6}", s):
        return s

    # 맵이 없으면 생성
    if _name_to_code_map is None:
        _name_to_code_map = _build_name_code_map()

    # 1) 정확 일치
    code = _name_to_code_map.get(s)
    if code:
        return code
    # 2) 정규화(공백 제거) 일치
    code = _name_to_code_map.get(_normalize_kor(s))
    if code:
        return code

    # 3) 부분 일치(앞부분)
    candidates = [v for k, v in _name_to_code_map.items() if not k.isdigit() and k.startswith(s)]
    if candidates:
        return candidates[0]

    return None

# ---------- 국내 차트(코드 기반) ----------
@router.get("/korea/{code}")
def price_korean(code: str, days: int = Query(30, ge=1, le=3650)):
    try:
        end = dt.date.today()
        start = end - dt.timedelta(days=days)
        start_str = start.strftime("%Y%m%d")
        end_str = end.strftime("%Y%m%d")

        df = stock.get_market_ohlcv_by_date(start_str, end_str, code)
        if df is None or len(df) == 0:
            return {"prices": [], "currency": "KRW"}

        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index, errors="coerce")
        df = df[~df.index.isna()]

        need_cols = ["시가", "고가", "저가", "종가"]
        for c in need_cols:
            if c not in df.columns:
                raise HTTPException(502, f"PyKRX columns missing: {need_cols}, got {list(df.columns)}")
        df = df.dropna(subset=need_cols).astype({c: "float64" for c in need_cols})

        ts_ms = (df.index.astype("int64") // 1_000_000).astype("int64")
        prices = []
        for ts, row in zip(ts_ms, df.itertuples(index=False)):
            prices.append({
                "ts": int(ts),
                "open": float(getattr(row, "시가")),
                "high": float(getattr(row, "고가")),
                "low":  float(getattr(row, "저가")),
                "close":float(getattr(row, "종가")),
            })
        return {"prices": prices, "currency": "KRW"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"PyKRX error: {e}")

# ---------- 국내 차트(이름 기반) ----------
@router.get("/korea/by-name/{name}")
def price_korean_by_name(name: str, days: int = Query(30, ge=1, le=3650)):
    code = _resolve_korea_code(name)
    if not code:
        raise HTTPException(404, f"'{name}' 종목을 찾을 수 없습니다.")
    # 코드 기반 엔드포인트 재사용
    return price_korean(code, days)