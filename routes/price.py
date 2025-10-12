from fastapi import APIRouter, HTTPException
from bs4 import BeautifulSoup
import requests, functools, datetime as dt, pytz

router = APIRouter(prefix="/price")

YH_CHART = "https://query2.finance.yahoo.com/v8/finance/chart/{sym}"


def fetch_yahoo(sym:str, range="1mo", interval="1d"):
    url = YH_CHART.format(sym=sym)
    r = requests.get(url, params={"range":range, "interval":interval}, timeout=4)
    if r.status_code != 200:
        raise HTTPException(502, "Yahoo API error")
    js = r.json()["chart"]["result"][0]
    prices = []
    for t, o, h, l, c in zip(js["timestamp"],
                             js["indicators"]["quote"][0]["open"],
                             js["indicators"]["quote"][0]["high"],
                             js["indicators"]["quote"][0]["low"],
                             js["indicators"]["quote"][0]["close"]):
        prices.append({"ts": t*1000, "open":o, "high":h, "low":l, "close":c})
    return {
        "meta": js["meta"],
        "prices": prices,
        "currency": js["meta"]["currency"]
    }


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
def price_korean(code:str):
    return fetch_naver_price(code)
