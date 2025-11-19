import { useState, useEffect } from "react";

type Step = {
  target: string; // CSS selector
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
};

const STEPS: Step[] = [
  {
    target: '[data-coachmark="market-segment"]',
    title: "시장 선택",
    description:
      "국내는 한국 주식, 해외는 미국/글로벌 주식을 검색할 수 있어요.",
    position: "bottom",
  },
  {
    target: '[data-coachmark="search-bar"]',
    title: "종목 검색",
    description:
      "국내는 종목명(예: 삼성전자), 해외는 Ticker(예: AAPL)로 검색하세요. 올바른 시장과 형식으로 입력해야 차트와 가격이 표시됩니다.",
    position: "bottom",
  },
  {
    target: '[data-coachmark="search-bar"]',
    title: "💡 꿀팁",
    description:
      '해외 주식의 한국어 뉴스를 보고 싶다면? "국내"를 선택하고 해외 종목(TSLA, 애플 등)을 검색해보세요!',
    position: "bottom",
  },
  {
    target: '[data-coachmark="market-segment"]',
    title: "시장 전환",
    description:
      "검색 중에 시장을 바꾸면 홈으로 돌아갑니다. 그 후 원하는 종목을 다시 검색하세요.",
    position: "bottom",
  },
];

export default function Coachmark() {
  const [currentStep, setCurrentStep] = useState(0);
  const [show, setShow] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const hasSeenCoachmark = localStorage.getItem("hasSeenCoachmark");
    if (!hasSeenCoachmark) {
      // 페이지 로드 후 1초 뒤에 시작
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

  useEffect(() => {
    if (!show) return;

    const target = document.querySelector(STEPS[currentStep].target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);

      // 타겟을 스크롤로 보이게
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [show, currentStep]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleClose = () => {
    localStorage.setItem("hasSeenCoachmark", "true");
    setShow(false);
  };

  if (!show || !targetRect) return null;

  const step = STEPS[currentStep];

  // 툴팁 위치 계산
  const getTooltipStyle = () => {
    const padding = 16;
    switch (step.position) {
      case "bottom":
        return {
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2,
          transform: "translateX(-50%)",
        };
      case "top":
        return {
          bottom: window.innerHeight - targetRect.top + padding,
          left: targetRect.left + targetRect.width / 2,
          transform: "translateX(-50%)",
        };
      case "right":
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + padding,
          transform: "translateY(-50%)",
        };
      case "left":
        return {
          top: targetRect.top + targetRect.height / 2,
          right: window.innerWidth - targetRect.left + padding,
          transform: "translateY(-50%)",
        };
    }
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={handleSkip} />

      {/* 강조 영역 (spotlight) */}
      <div
        className="fixed z-40 pointer-events-none"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          boxShadow:
            "0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.6)",
          borderRadius: "8px",
        }}
      />

      {/* 툴팁 */}
      <div
        className="fixed z-50 w-80 rounded-lg bg-white p-4 shadow-2xl"
        style={getTooltipStyle()}
      >
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{step.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i === currentStep ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="rounded px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              건너뛰기
            </button>
            <button
              onClick={handleNext}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {currentStep < STEPS.length - 1 ? "다음" : "시작하기"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
