from fastapi import APIRouter
import functools, requests, bs4

router = APIRouter(prefix="/suggest")

@functools.lru_cache(maxsize=4)
def _us():
    url = "https://query2.finance.yahoo.com/v1/finance/trending/US"
    q = requests.get(url, timeout=3).json()
    return [{"symbol": x["symbol"],
             "name":   x.get("shortName", "")}
            for x in q["finance"]["result"][0]["quotes"][:10]]

@router.get("/global")
def suggest_global():
    return _us()

@functools.lru_cache(maxsize=4)
def _kr():
    r = requests.get("https://finance.naver.com/sise/lastsearch2.naver", timeout=3)
    soup = bs4.BeautifulSoup(r.text, "html.parser")
    rows = soup.select("table.type_5 tr")[2:12]
    out=[]
    for tr in rows:
        a=tr.select_one("a")
        if a: out.append({"symbol":a.text.strip(),"name":a.text.strip()})
    return out

@router.get("/korea")
def suggest_korean():
    return _kr()


