from fastapi import APIRouter, HTTPException, Query
from pykrx import stock
from bs4 import BeautifulSoup
import pandas as pd
import time, requests, functools, datetime as dt, pytz, math

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


@router.get("/korea/{code}")
def price_korean(
    code: str,
    days: int = Query(30, ge=1, le=3650),
    debug: bool = Query(False)
):
    try:
        # days를 무조건 int로
        try:
            days = int(days)
        except Exception:
            raise HTTPException(400, f"invalid days: {days!r}")

        end = dt.date.today()
        start = end - dt.timedelta(days=days)
        start_str = start.strftime("%Y%m%d")
        end_str = end.strftime("%Y%m%d")

        df = stock.get_market_ohlcv_by_date(start_str, end_str, code)

        if df is None or len(df) == 0:
            return {"prices": [], "currency": "KRW", **({"_debug": {"empty": True}} if debug else {})}

        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index, errors="coerce")

        df = df[~df.index.isna()]

        need_cols = ["시가", "고가", "저가", "종가"]
        for col in need_cols:
            if col not in df.columns:
                raise HTTPException(502, f"PyKRX columns missing: {need_cols}, got {list(df.columns)}")

        df = df.dropna(subset=need_cols).astype({c: "float64" for c in need_cols})

        if len(df) == 0:
            return {"prices": [], "currency": "KRW", **({"_debug": {"after_dropna_empty": True}} if debug else {})}

        ts_ms = (df.index.astype("int64") // 1_000_000).astype("int64")

        prices = []
        for ts, row in zip(ts_ms, df.itertuples(index=False)):
            o = getattr(row, "시가", None)
            h = getattr(row, "고가", None)
            l = getattr(row, "저가", None)
            c = getattr(row, "종가", None)

            if any(v is None or (isinstance(v, float) and math.isnan(v)) for v in (o, h, l, c)):
                continue

            prices.append({
                "ts": int(ts),
                "open": float(o),
                "high": float(h),
                "low":  float(l),
                "close":float(c),
            })

        payload = {"prices": prices, "currency": "KRW"}
        if debug:
            payload["_debug"] = {
                "rows": len(df),
                "index_type": str(type(df.index)),
                "index_sample": df.index[:3].astype(str).tolist(),
                "columns": df.columns.tolist(),
            }
        return payload

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"PyKRX error: {e}")