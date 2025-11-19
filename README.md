# StockLive.ai

AI 기반으로 주식 뉴스의 분위기를 자동 분석하여  
사용자가 시장의 흐름을 빠르게 파악할 수 있도록 돕는 실시간 투자 보조 대시보드입니다.

StockLive.ai는  
- 종목별 최신 뉴스를 수집하고,  
- HuggingFace 모델을 활용해 긍정/중립/부정을 분석하며,  
- FastAPI 기반 백엔드 + React 기반 프론트엔드로  
시각화된 감성 요약 정보를 제공합니다.

## 설치 (Installation)

```bash
# 저장소 복제
git clone https://github.com/you/stocklive.ai.git
cd stocklive.ai

# 백엔드 의존성 설치
pip install -r requirements.txt

# 프론트엔드 의존성 설치
cd frontend
npm install
```

## 환경 변수 설정 (Configuration)

StockLive.ai는 뉴스/주가 API 및 감성 분석 모델을 활용합니다. 
아래의 API 키를 발급받아, .env 파일 생성 후 입력해야 합니다.
- HuggingFace Interference API (https://huggingface.co/settings/tokens)
- YH Finance API(RapidAPI) (https://rapidapi.com/sparior/api/yahoo-finance15)

## 실행 방법

1) FastAPI 백엔드 실행
   ```
   cd stocklive.ai
   python -m uvicorn main:app --reload
   ```
2) React 프론트엔드 실행
   ```
   cd frontend
   npm run dev
   ```
3) 접속 주소
   - 프론트엔드: http://localhost:8000
   - 백엔드: http://localhost:5173

## 실행 화면
<img width="2559" height="1395" alt="image" src="https://github.com/user-attachments/assets/4903c139-a366-42b9-860d-7802e908e0d6" />
<img width="2559" height="1400" alt="image" src="https://github.com/user-attachments/assets/2dc7949f-4eac-47a8-a8d1-e5ae50ce6439" />
<img width="2559" height="1400" alt="image" src="https://github.com/user-attachments/assets/94df773d-2356-4b3a-af15-d7bb204208ab" />
<img width="2558" height="1397" alt="image" src="https://github.com/user-attachments/assets/72c0a61f-be68-41e0-b643-5e7b7ab921ee" />
<img width="2559" height="1400" alt="image" src="https://github.com/user-attachments/assets/fcdf3781-c412-4e4e-8151-93c7319c1833" />


