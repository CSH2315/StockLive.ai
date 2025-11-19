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
from concurrent.futures import ThreadPoolExecutor, as_completed

app = FastAPI()
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suggest_router)
app.include_router(price_router)
HF_API_BASE = "https://router.huggingface.co/hf-inference/models"
load_dotenv()
HUGGINGFACE_API_KEY = os.environ.get('HUGGINGFACE-STOCK-API-KEY')
YAHOO_API_KEY = os.environ.get('YAHOO_API_KEY')
YAHOO_API_HOST = "yahoo-finance15.p.rapidapi.com"


# 감정 분석 요청 바디 스키마 정의
class NewsText(BaseModel):
    news_text: str


def fetch_korean_news(name: str, limit=20):
    """네이버 뉴스 검색 크롤링"""
    url = f"https://search.naver.com/search.naver?where=news&query={quote_plus(name)}&sort=1"

    hdrs = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.naver.com/",
    }

    try:
        response = requests.get(url, headers=hdrs, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # 네이버 뉴스 카드 컨테이너
        articles = soup.select('div.OMzvsrwCLRe2oeDclV97')[:limit]

        if not articles:
            logger.warning(f"'{name}' 검색 결과에서 뉴스를 찾지 못함")
            return []

        logger.info(f"'{name}' 검색 결과 {len(articles)}개 뉴스 카드 찾음")

        news_list = []
        for article in articles:
            # 제목 찾기 - data-heatmap-target=".tit" 속성을 가진 a 태그
            title_tag = article.select_one('a[data-heatmap-target=".tit"]')
            if not title_tag:
                continue

            # 링크
            link = title_tag.get('href', '')

            # 제목 텍스트 (span 안에 있음)
            title_span = title_tag.select_one('span.sds-comps-text-type-headline1')
            title = title_span.get_text(strip=True) if title_span else title_tag.get_text(strip=True)

            # <mark> 태그 제거
            title = title.replace('<mark>', '').replace('</mark>', '')

            # 본문 찾기 - data-heatmap-target=".body" 속성을 가진 a 태그
            desc_tag = article.select_one('a[data-heatmap-target=".body"]')
            if desc_tag:
                desc_span = desc_tag.select_one('span')
                description = desc_span.get_text(strip=True) if desc_span else desc_tag.get_text(strip=True)
                description = description.replace('<mark>', '').replace('</mark>', '')
            else:
                description = "No description"

            # 시간 찾기 - Profile 안의 subtext
            time_span = article.select_one('span.sds-comps-profile-info-subtext span.sds-comps-text')
            pub_date = time_span.get_text(strip=True) if time_span else ""

            news_list.append({
                "title": title,
                "link": link,
                "description": description,
                "pubDate": pub_date,
            })

        logger.info(f"'{name}' 뉴스 {len(news_list)}개 파싱 완료")
        return news_list

    except requests.RequestException as e:
        logger.error(f"네이버 뉴스 요청 실패: {e}")
        return []
    except Exception as e:
        logger.error(f"네이버 뉴스 파싱 실패: {e}", exc_info=True)
        return []


def _normalize_hf_label(raw_label: str) -> str:
    """
    HF에서 오는 label 문자열 -> positive / negative / neutral 셋 중 하나로 정규화
    """
    if not raw_label:
        return "neutral"

    label = raw_label.strip().lower()

    # 영어 모델: "Negative", "Neutral", "Positive"
    if "positive" in label:
        return "positive"
    if "negative" in label:
        return "negative"
    if "neutral" in label:
        return "neutral"

    # 숫자/라벨형: "0", "1", "2" / "label_0" ...
    if label in ("0", "label_0"):
        return "negative"
    if label in ("1", "label_1"):
        return "neutral"
    if label in ("2", "label_2"):
        return "positive"

    # 다른 형태면 로그 남기고 neutral
    logger.warning(f"Unknown sentiment label from HF: {raw_label}")
    print(f"Unknown sentiment label from HF: {raw_label}")
    return "neutral"


def _analyze_sentiment_hf(model_id: str, text: str) -> str:
    """
    HF Inference(router)로 텍스트 감정 분석 -> 실패하면 'neutral' 반환
    """
    if not HUGGINGFACE_API_KEY:
        logger.error("HUGGINGFACE-STOCK-API-KEY 환경변수가 설정되지 않았습니다.")
        return "neutral"

    url = f"{HF_API_BASE}/{model_id}"
    headers = {
        "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"inputs": text[:512]}  # 너무 긴 텍스트는 잘라서 전송

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        if resp.status_code != 200:
            logger.warning(
                "HF sentiment API error [%s] %s: %s",
                model_id,
                resp.status_code,
                resp.text[:300],
            )
            return "neutral"

        # 일부 케이스에서 content-type이 이상하게 올 수도 있으니 그냥 json() 시도
        try:
            data = resp.json()
        except ValueError:
            logger.warning("HF sentiment API JSON 파싱 실패 [%s]: %s", model_id, resp.text[:200])
            return "neutral"

        # 기대 형식: [[{"label": "...", "score": ...}, ...]]
        if not isinstance(data, list) or not data:
            logger.warning("HF sentiment API 응답 형식 이상 [%s]: %s", model_id, data)
            return "neutral"

        candidates = data[0]
        if not isinstance(candidates, list) or not candidates:
            logger.warning("HF sentiment API 응답 후보 없음 [%s]: %s", model_id, data)
            return "neutral"

        best = max(candidates, key=lambda x: x.get("score", 0.0))
        raw_label = best.get("label", "")
        return _normalize_hf_label(raw_label)

    except Exception as e:
        logger.warning(f"HF sentiment API 호출 실패 [{model_id}]: {e}", exc_info=True)
        return "neutral"


# --------------------
# 영어 / 한국어용 wrapper
# --------------------

def analyze_sentiment_english(news_text: str) -> str:
    return _analyze_sentiment_hf(
        "cardiffnlp/twitter-roberta-base-sentiment-latest",
        news_text,
    )


def analyze_sentiment_korean(news_text: str) -> str:
    return _analyze_sentiment_hf(
        "snunlp/KR-FinBert-SC",
        news_text,
    )


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
        news_data = response.json()

        if "body" in news_data and isinstance(news_data["body"], list) and len(news_data["body"]) > 0:
            articles = news_data["body"]

            # 병렬 처리로 감정 분석 (5개씩 동시 처리)
            def analyze_article(article):
                description = article.get("description", "")
                sentiment = analyze_sentiment_english(description)
                article["sentiment"] = sentiment
                return sentiment

            sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}

            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = {executor.submit(analyze_article, art): art for art in articles}
                for future in as_completed(futures):
                    try:
                        sentiment = future.result()
                        sentiment_counts[sentiment] += 1
                    except Exception as e:
                        logger.error(f"감정 분석 에러: {e}")
                        sentiment_counts["neutral"] += 1

            logger.info(f"{symbol} 해외 뉴스 {len(articles)}개, 감정: {sentiment_counts}")

            return {
                "symbol": symbol,
                "sentiment_counts": sentiment_counts,
                "news": articles
            }

        else:
            return {"error": "No news data available"}

    return {"error": "Failed to fetch"}


# 주식 정보 조회 (Ticker → 회사명)
@app.get("/stock/info/{symbol}")
def get_stock_info(symbol: str):
    """주식 심볼 정보 조회 (회사명, 통화 등)"""
    # Yahoo Finance - 여러 엔드포인트 시도
    endpoints = [
        f"https://{YAHOO_API_HOST}/api/yahoo/qu/quote/{symbol}",
        f"https://{YAHOO_API_HOST}/api/yahoo/co/collections/list",  # 대체
    ]

    headers = {
        'x-rapidapi-key': YAHOO_API_KEY,
        'x-rapidapi-host': YAHOO_API_HOST
    }

    # 먼저 첫 번째 엔드포인트 시도
    try:
        response = requests.get(endpoints[0], headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()

            # 다양한 경로에서 회사명 찾기
            name = None

            # 경로 1: 최상위
            if not name:
                name = (
                        data.get("longName") or
                        data.get("shortName") or
                        data.get("displayName") or
                        data.get("name")
                )

            # 경로 2: quoteResponse 안
            if not name and "quoteResponse" in data:
                results = data.get("quoteResponse", {}).get("result", [])
                if results and len(results) > 0:
                    name = (
                            results[0].get("longName") or
                            results[0].get("shortName") or
                            results[0].get("displayName")
                    )

            # 경로 3: body 안
            if not name and "body" in data:
                body = data.get("body", [])
                if body and len(body) > 0:
                    name = (
                            body[0].get("longName") or
                            body[0].get("shortName") or
                            body[0].get("displayName")
                    )

            if name:
                logger.info(f"주식 정보 조회 성공: {symbol} → {name}")
                return {
                    "symbol": symbol,
                    "name": name,
                    "currency": data.get("currency", "USD")
                }
            else:
                logger.warning(f"회사명을 찾을 수 없음. 응답: {data}")

    except Exception as e:
        logger.error(f"주식 정보 조회 에러: {symbol} - {e}")

    return {
        "symbol": symbol,
        "name": name,
        "currency": "USD"
    }


# 국내주식: 네이버 웹 크롤링
@app.get("/news/korea/{name}")
def get_korean_stock_news(name: str):
    raw_articles = fetch_korean_news(name)

    if not raw_articles:
        logger.warning(f"'{name}' 검색 결과 뉴스 없음")
        return {
            "symbol": name,
            "sentiment_counts": {"positive": 0, "negative": 0, "neutral": 0},
            "news": []
        }

    result = []
    sentiment_counts = Counter({"positive": 0, "negative": 0, "neutral": 0})

    for art in raw_articles:
        sentiment = analyze_sentiment_korean(art["description"])
        sentiment_counts[sentiment] += 1
        result.append({**art, "sentiment": sentiment})

    logger.info(f"'{name}' 뉴스 {len(result)}개, 감정: {dict(sentiment_counts)}")

    return {
        "name": name,
        "sentiment_counts": sentiment_counts,
        "news": result
    }