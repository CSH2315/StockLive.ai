import os
import logging
import requests
from bs4 import BeautifulSoup
from collections import Counter
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from routes.price import router as price_router
from routes.suggest import router as suggest_router
from urllib.parse import quote_plus


app = FastAPI()
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suggest_router)
app.include_router(price_router)


@app.get("/")
def root_test():
    return {"msg": "Hello"}


load_dotenv()
HUGGINGFACE_API_KEY = os.environ.get('HUGGINGFACE-STOCK-API-KEY')
YAHOO_API_KEY = os.environ.get('YAHOO_API_KEY')
YAHOO_API_HOST = "yahoo-finance15.p.rapidapi.com"


# 감정 분석 요청 바디 스키마 정의
class NewsText(BaseModel):
    news_text: str

def fetch_korean_news(symbol: str, limit=20):
    url = (
        "https://search.naver.com/search.naver"
        f"?where=news&query={quote_plus(symbol)}"
    )
    hdrs = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://www.naver.com/",
    }
    html = requests.get(url, headers=hdrs, timeout=5).text
    soup = BeautifulSoup(html, "html.parser")

    cards = soup.select('div.hfG7LjyJAPmlsSM3W_Lz')[:limit]
    news_list = []

    for card in cards:
        title_a = card.select_one('a[data-heatmap-target=".tit"]')
        body_a = card.select_one('a[data-heatmap-target=".body"]')

        # 프로필 블록에서 바로 시간 span 찾기
        time_tag = card.select_one(
            'div.sds-comps-horizontal-layout span.sds-comps-text-type-body2'
        )

        if not title_a:
            continue

        news_list.append({
            "title": title_a.get_text(" ", strip=True),
            "link": title_a["href"],
            "description": body_a.get_text(" ", strip=True) if body_a else "No description",
            "pubDate": time_tag.get_text(strip=True) if time_tag else "",
        })
    return news_list

# 영어 감정 분석
def analyze_sentiment_english(news_text):
    api_url = "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
    data = {"inputs": news_text}

    response = requests.post(api_url, headers=headers, json=data)

    if response.status_code == 200:
        sentiment_data = response.json()
        labels = {"negative": "negative", "neutral": "neutral", "positive": "positive"}

        if not sentiment_data or not sentiment_data[0]:
            return "Unknown"

        # 가장 높은 점수를 받은 감정 선택
        best_label = max(sentiment_data[0], key=lambda x: x["score"])["label"]
        sentiment_label = labels.get(best_label, "Unknown")
        return sentiment_label
    else:
        return "Unknown"


def analyze_sentiment_korean(news_text):
    api_url = "https://api-inference.huggingface.co/models/snunlp/KR-FinBert-SC"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
    data = {"inputs": news_text}

    response = requests.post(api_url, headers=headers, json=data)

    if response.status_code != 200:
        return "Unknown"

    content_type = response.headers.get("Content-Type", "")
    if "application/json" not in content_type:
        return "Unknown"

    try:
        sentiment_data = response.json()
    except Exception as e:
        logger.warning("JSON parse error: %s", e)
        return "Unknown"

    if not sentiment_data or not sentiment_data[0]:
        return "Unknown"

    # max() 로 label 고르기
    best_label = max(sentiment_data[0], key=lambda x: x["score"])["label"]
    label_map = {"positive": "positive", "negative": "negative", "neutral": "neutral"}
    return label_map.get(best_label, "Unknown")


# 해외주식: Yahoo Finance API 사용
@app.get("/news/global/{symbol}")
def get_global_stock_news(symbol: str):
    url = f"https://{YAHOO_API_HOST}/api/yahoo/ne/news/{symbol}"
    headers = {
        'x-rapidapi-key': YAHOO_API_KEY,
        'x-rapidapi-host': YAHOO_API_HOST
    }
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
        news_data = response.json()

        # 응답 데이터가 예상한 구조인지 확인
        if "body" in news_data and isinstance(news_data["body"], list) and len(news_data["body"]) > 0:
            for article in news_data["body"]:
                description = article.get("description", "No description")

                # 감정 분석 수행
                sentiment = analyze_sentiment_english(description)
                if sentiment not in sentiment_counts:
                    sentiment_counts[sentiment] = 0
                sentiment_counts[sentiment] += 1

                # 감정 분석 결과를 뉴스 항목에 추가
                article["sentiment"] = sentiment

            return {
                "symbol": symbol,
                "sentiment_counts": sentiment_counts,
                "news": news_data["body"]
            }

        else:
            return {"error": "No news data available"}

    return {"error": "Failed to fetch"}


# 국내주식: 네이버 웹 크롤링
@app.get("/news/korea/{symbol}")
def get_korean_stock_news(symbol: str):
    raw_articles = fetch_korean_news(symbol)
    result = []
    sentiment_counts = Counter({"positive":0, "negative":0, "neutral":0})

    for art in raw_articles:
        sentiment = analyze_sentiment_korean(art["description"])
        sentiment_counts[sentiment] += 1
        result.append({**art, "sentiment": sentiment})
    return {
        "symbol": symbol,
        "sentiment_counts": sentiment_counts,
        "news": result
        }



