import type { RegimeLevel, RegimeSignal, ReviewUrgency } from "@/types";

const UNKNOWN = "자료가 부족해 판단할 수 없음";

const pick = (
  value: string | null | undefined,
  labels: Record<string, string>,
  fallback = UNKNOWN,
) => (value ? labels[value] || value : fallback);

export function regimeLevelLabel(level?: RegimeLevel | string | null): string {
  return pick(level, {
    유지: "투자 가설 유지",
    경계: "위험 신호 관찰",
    약화: "투자 가설 약화",
    전환: "투자 가설 전환 검토",
  });
}

export function regimeCandidateLabel(level?: RegimeLevel | string | null): string {
  return pick(level, {
    유지: "유지 후보",
    경계: "경계 전환 후보",
    약화: "약화 전환 후보",
    전환: "가설 전환 후보",
  });
}

export function reviewUrgencyLabel(value?: ReviewUrgency | string | null): string {
  return pick(value, {
    required: "지금 포트폴리오 상세점검 필요",
    watch: "다음 주요 발표까지 관찰",
    not_needed: "새 상세점검 필요 없음",
  });
}

export function dataQualityLabel(value?: string | null): string {
  return pick(value, {
    충분: "핵심자료 확보",
    부분: "일부 핵심자료 부족",
    부족: "핵심자료 부족",
    없음: "핵심자료 없음",
    "판정 불가": "핵심자료 부족",
    제한: "사용 가능 자료 제한",
  });
}

export function growthLevelLabel(value?: string | null): string {
  return pick(value, {
    확장: "경기 확장",
    "성장 확장": "경기 확장",
    "완만한 확장": "경기 완만한 확장",
    취약: "경기 취약",
    "성장 취약": "경기 취약",
    약함: "경기 약화",
    "판정 불가": "성장 수준을 계산할 자료 부족",
  });
}

export function inflationLevelLabel(value?: string | null): string {
  return pick(value, {
    "물가 매우 높음": "물가 부담 매우 높음",
    "매우 높음": "물가 부담 매우 높음",
    "물가 높음": "물가 부담 높음",
    높음: "물가 부담 높음",
    "물가 다소 높음": "물가 부담 다소 높음",
    "다소 높음": "물가 부담 다소 높음",
    "물가 목표 부근": "물가 목표 부근",
    "목표 부근": "물가 목표 부근",
    "판정 불가": "물가 수준을 계산할 자료 부족",
  });
}

export function macroEnvironmentLabel(value?: string | null): string {
  if (!value || value === "판정 불가") return UNKNOWN;
  const [growth, inflation] = value.split("·");
  if (!inflation) return value;
  const growthText = pick(growth, {
    "성장 확장": "경기는 확장 중",
    "완만한 확장": "경기는 완만히 확장 중",
    "성장 취약": "경기 수준은 취약",
  }, growth);
  const inflationText = pick(inflation, {
    "물가 매우 높음": "물가 부담은 매우 높음",
    "물가 높음": "물가 부담은 높음",
    "물가 다소 높음": "물가 부담은 다소 높음",
    "물가 목표 부근": "물가는 목표 부근",
  }, inflation);
  return `${growthText} · ${inflationText}`;
}

export function momentumDirectionLabel(value?: string | null): string {
  return pick(value, {
    "방향 불명확": "최근 지표 방향이 뚜렷하지 않음",
    "성장 개선 중심": "최근 지표는 성장 개선 쪽으로 움직임",
    "성장 둔화 중심": "최근 지표는 성장 둔화 쪽으로 움직임",
    "물가 재가속 중심": "최근 지표는 물가 재가속 쪽으로 움직임",
    "물가 완화 중심": "최근 지표는 물가 둔화 쪽으로 움직임",
    "성장 개선·물가 재가속": "성장 개선과 물가 재가속이 함께 나타남",
    "성장 개선·물가 완화": "성장 개선과 물가 둔화가 함께 나타남",
    "성장 둔화·물가 재가속": "성장 둔화와 물가 재가속이 함께 나타남",
    "성장 둔화·물가 완화": "성장 둔화와 물가 둔화가 함께 나타남",
    "현재 모멘텀": "현재 관측값으로 최근 방향을 계산 중",
    "판정 불가": "최근 지표 방향을 계산할 자료 부족",
  });
}

export function momentumStrengthLabel(value?: string | null): string {
  return pick(value, {
    미약: "변화 강도 작음",
    완만: "변화 강도 작음",
    보통: "변화 강도 보통",
    뚜렷함: "변화 방향 뚜렷함",
    강함: "변화 강도 큼",
    "실시간 이력 축적 전": "과거 시점 이력 축적 중",
    "판정 불가": "변화 강도를 계산할 자료 부족",
  }, value || UNKNOWN);
}

export function domainStateLabel(domain: string, state?: string | null): string {
  const labels: Record<string, Record<string, string>> = {
    growth: {
      강함: "성장·고용 흐름 양호",
      중립: "뚜렷한 성장 변화 없음",
      둔화: "성장·고용 둔화 신호",
      약화: "성장·고용 악화 신호",
    },
    inflation: {
      강함: "물가 안정 흐름 양호",
      중립: "새 물가 경보 없음",
      둔화: "물가 재가속 주의",
      약화: "물가 부담 크게 악화",
    },
    rates: {
      강함: "금리 부담 낮음",
      중립: "금리 부담 보통",
      둔화: "금리 부담 높음",
      약화: "금리 부담 매우 높음",
    },
    liquidity: {
      강함: "자금조달 여건 양호",
      중립: "자금조달 여건 보통",
      둔화: "자금조달 부담 증가",
      약화: "신용경색 위험 높음",
    },
  };
  if (!state || state === "데이터 없음") return "판정에 필요한 자료 없음";
  return labels[domain]?.[state] || state;
}

export function signalStatusLabel(signal: Pick<RegimeSignal, "domain" | "status">): string {
  if (signal.status === "unavailable") return "자료 없음";
  return domainStateLabel(signal.domain, signal.status);
}

export function ratePressureLabel(value?: string | null): string {
  return pick(value, {
    완화적: "금리 부담 낮음",
    중립: "금리 부담 보통",
    "다소 제한적": "금리 부담 다소 높음",
    제한적: "금리 부담 높음",
    "매우 제한적": "금리 부담 매우 높음",
  });
}

export function rateDriverLabel(value?: string | null): string {
  return pick(value, {
    "현재 제약 수준": "현재 높은 금리 수준",
    "최근 긴축 충격": "최근 금리 상승 충격",
    "수익률곡선 선행위험": "수익률곡선의 침체 선행 신호",
    "가용 금리 정보": "현재 확인 가능한 금리자료",
  });
}

export function policyPressureLabel(value?: string | null): string {
  return pick(value, {
    완화적: "단기금리가 수요를 누르지 않음",
    중립: "단기금리의 수요 억제력 낮음",
    "다소 제한적": "단기금리가 수요를 약하게 억제",
    제한적: "단기금리가 수요를 뚜렷하게 억제",
    "매우 제한적": "단기금리가 수요를 강하게 억제",
  });
}

export function longRatePressureLabel(value?: string | null): string {
  return pick(value, {
    완화적: "장기 차입 부담 낮음",
    중립: "장기 차입 부담 보통",
    "다소 제한적": "장기 차입 부담 다소 높음",
    제한적: "투자·차입에 뚜렷한 부담",
    "매우 제한적": "투자·차입에 매우 큰 부담",
  });
}

export function recentRateShockLabel(value?: string | null): string {
  return pick(value, {
    "급격한 긴축 충격": "최근 금리가 급격히 상승",
    "긴축 충격": "최근 금리 상승 충격 발생",
    "상승 압력": "최근 금리 상승 압력 발생",
    "완화 방향": "최근 금리 부담 완화 중",
    "변화 제한적": "최근 추가 금리 충격 거의 없음",
  });
}

export function durationStressLabel(value?: string | null): string {
  return pick(value, {
    "장기 듀레이션 충격": "30년물 중심의 장기금리 충격 발생",
    "장기 듀레이션 부담 경계": "30년물 장기금리 부담 경계",
    "장기금리 상승 관찰": "30년물 상승 지속 여부 관찰",
    "장기 구간 추가 충격 없음": "30년물의 별도 추가 충격 없음",
    "판정 불가": "30년 명목·실질금리 자료 부족",
  });
}

export function durationStressDriverLabel(value?: string | null): string {
  return pick(value, {
    "30Y 실질금리 주도": "30년 실질금리 상승이 주도",
    "실질금리·기간 프리미엄 주도": "30년 실질금리 상승이 주도",
    "인플레이션 기대 동반": "인플레이션 기대 상승도 동반",
    "장기금리 혼합": "장기금리 상승 원인이 혼합",
    "판정 불가": "상승 원인 판정자료 부족",
  });
}

export function rateDirectionLabel(value?: string | null): string {
  return pick(value, {
    완화: "금리 하락",
    긴축: "금리 상승",
    혼합: "명목·실질금리 방향 엇갈림",
    안정: "뚜렷한 변화 없음",
    "판정 불가": "최근 금리 방향자료 부족",
  });
}

export function yieldCurveStateLabel(value?: string | null): string {
  return pick(value, {
    "역전 지속": "장단기 금리 역전 지속",
    "역전 확인 중": "장단기 금리 역전 지속 여부 확인 중",
    "역전 후 관찰": "과거 금리 역전의 영향 관찰 중",
    "평탄화 경계": "장단기 금리차 축소 주의",
    "정상 우상향": "장기금리가 단기금리보다 높음",
  });
}

export function yieldCurveRiskLabel(value?: string | null): string {
  return pick(value, {
    "선행위험 높음": "향후 12개월 침체 위험 높음",
    "선행위험 경계": "향후 12개월 침체 위험 관찰",
    "선행위험 낮음": "수익률곡선상 침체 위험 낮음",
  });
}

export function yieldCurveChangeLabel(value?: string | null): string {
  return pick(value, {
    "단기금리 하락 주도": "단기금리 하락으로 금리차 확대",
    "장기금리 상승 주도": "장기금리 상승으로 금리차 확대",
    "혼합 재가팔라짐": "장·단기금리 변화로 금리차 확대",
    "평탄화·역전 심화": "장단기 금리차가 더 축소됨",
    "변화 제한적": "최근 금리차 변화 거의 없음",
  });
}

export function yieldCurveConfirmationLabel(value?: string | null): string {
  return pick(value, {
    역전: "현재도 역전",
    비역전: "현재는 역전 아님",
    미확인: "확인자료 부족",
  });
}

export function creditConditionLabel(value?: string | null): string {
  return pick(value, {
    완화적: "회사채·금융 자금조달 여건 양호",
    중립: "회사채·금융 자금조달 여건 보통",
    "다소 제한적": "회사채 자금조달 부담 다소 높음",
    제한적: "회사채 자금조달 부담 높음",
    "매우 제한적": "신용시장 자금조달 부담 매우 높음",
  });
}

export function termPremiumLabel(value?: string | null): string {
  return pick(value, {
    "역사적 상단": "최근 10년 중 매우 높은 수준",
    "높은 편": "최근 10년 중 높은 수준",
    "통상 범위": "최근 10년의 통상 범위",
    "표본 부족": "과거 비교자료 부족",
    "판정 불가": "기간 프리미엄 자료 부족",
  });
}

export function aiCapexStateLabel(value?: string | null): string {
  return pick(value, {
    "확대 강함": "주요 기업 설비투자 빠르게 확대",
    "높은 투자 지속": "주요 기업의 높은 설비투자 지속",
    "감속 관찰": "일부 기업의 투자 감속 여부 관찰",
    혼조: "기업별 설비투자 방향 엇갈림",
    "판정 제한": "설비투자 판단자료 부족",
    "판정 불가": "설비투자 판단자료 부족",
  });
}

export function memoryPriceStateLabel(value?: string | null): string {
  return pick(value, {
    "가격 확장": "DRAM 공개가격 큰 폭 상승",
    "가격 상승": "DRAM 공개가격 상승",
    "하락 관찰": "DRAM 공개가격 하락 여부 관찰",
    "가격 유지": "DRAM 공개가격 변화 거의 없음",
    혼조: "DRAM 가격 신호 엇갈림",
    "판정 제한": "DRAM 가격 비교자료 부족",
    "판정 불가": "DRAM 가격자료 부족",
  });
}

export function nandPriceStateLabel(value?: string | null): string {
  return pick(value, {
    "관측가격 큰 폭 상승": "NAND 공개가격 큰 폭 상승",
    "관측가격 상승": "NAND 공개가격 상승",
    "관측가격 하락": "NAND 공개가격 하락",
    "관측가격 변화 미미": "NAND 공개가격 변화 거의 없음",
    "판정 제한": "NAND 가격 비교자료 부족",
    "판정 불가": "NAND 가격자료 부족",
  });
}

export function dramBottleneckStateLabel(value?: string | null): string {
  return pick(value, {
    "타이트 신호": "DRAM 공급 부족 압력 지속",
    "가격 상승 확인": "DRAM 가격 상승·수요 추가 확인 필요",
    "수요 강세·가격 대기": "DRAM 수요 강세·가격 확인 대기",
    "가격 강세·수요 경계": "DRAM 가격은 강하지만 수요 확인 약함",
    "병목 완화 경계": "DRAM 병목 완화 가능성 경계",
    "가격 하락 관찰": "DRAM 가격 하락 지속 여부 관찰",
    "수급 약화 경계": "DRAM 수요·실적 약화 경계",
    혼조: "DRAM 수급 신호 엇갈림",
    "판정 제한": "DRAM 핵심자료 부족",
    "판정 불가": "DRAM 핵심자료 부족",
  });
}

export function hbmProxyStateLabel(value?: string | null): string {
  return pick(value, {
    "타이트 지속 신호": "HBM·서버 DRAM 공급 부족 정황 지속",
    "타이트 관찰": "서버 DRAM 공급 부족 정황 관찰",
    "병목 완화 경계": "HBM·서버 DRAM 병목 완화 가능성 경계",
    "완화 관찰": "서버 DRAM 가격 하락 지속 여부 관찰",
    "수요 강세·서버 가격 대기": "수출 수요 강세·서버 가격 확인 대기",
    혼조: "HBM 간접지표 방향 엇갈림",
    "판정 제한": "HBM 간접판정 자료 부족",
    "판정 불가": "HBM 간접판정 자료 부족",
  });
}

export function exportDemandStateLabel(value?: string | null): string {
  return pick(value, {
    "수출 확장 강함": "DRAM 수출 증가세 매우 강함",
    "수출 증가": "DRAM 수출 증가",
    "수출 감소 지속": "DRAM 수출 감소 지속",
    "감속 관찰": "DRAM 수출 둔화 지속 여부 관찰",
    혼조: "DRAM 수출 방향 엇갈림",
    "판정 불가": "DRAM 수출자료 부족",
  });
}

export function exportStructureStateLabel(value?: string | null): string {
  return pick(value, {
    "단가·믹스 주도 확장": "가격·고부가 제품 비중이 수출 증가 주도",
    "수출액·후공정 동반 확장": "DRAM 칩과 MCP·모듈 수출이 함께 증가",
    "수출액 확장": "DRAM 칩 수출액 증가",
    "수출 약화": "DRAM 수출 구조 약화",
    혼조: "DRAM 수출 지표 방향 엇갈림",
    "판정 불가": "수출 구조자료 부족",
  });
}

export function supplyStateLabel(value?: string | null): string {
  return pick(value, {
    "재고 부담": "완제품 재고 부담 높음",
    "재고 반등 관찰": "완제품 재고 반등·수준은 아직 낮음",
    "생산·출하 둔화": "생산과 출하가 함께 둔화",
    "수급 개선": "생산·출하 증가·재고 부담 낮음",
    혼조: "생산·출하·재고 방향 엇갈림",
    "판정 불가": "완제품 수급자료 부족",
  });
}

export function companyConfirmationStateLabel(value?: string | null): string {
  return pick(value, {
    "확장 확인": "국내 2사 실적이 확장을 뒷받침",
    "실적 둔화": "국내 2사 실적 둔화",
    "재고 부담": "국내 2사 재고 부담 증가",
    혼조: "기업별 실적 방향 엇갈림",
    "판정 불가": "기업 공시자료 부족",
  });
}

export function semiconductorStateLabel(value?: string | null): string {
  return pick(value, {
    "확장 확인": "DRAM 중심 확장 신호 확인",
    경계: "DRAM 사이클 약화 가능성 경계",
    "감속 관찰": "DRAM 가격 둔화 지속 여부 관찰",
    혼조: "DRAM·보조지표 방향 엇갈림",
    "판정 불가": "반도체 핵심자료 부족",
  });
}

export function powerStateLabel(value?: string | null): string {
  return pick(value, {
    "전력망 투자 가설 강화": "수요·계통 부담·송전 투자 동시 확인",
    "계통 부담 확인·투자 반응 대기": "계통 부담 확인·송전 투자 반응 대기",
    "전력수요 확대·병목 미확인": "전력 수요 확대·계통 병목 미확인",
    "투자 선행·수요 확인 필요": "송전 투자 선행·수요 확인 필요",
    "전력 투자 근거 약화": "전력 인프라 투자 근거 약화",
    "근거 혼조": "전력 인프라 근거 엇갈림",
    "병목 압력 상승": "수요 가속·공급 대응 부족",
    "수요 가속·공급 확충": "수요 가속과 설비 확충 동행",
    "병목 가능성 관찰": "수요 증가·공급 대응 제한",
    "수요 확대·공급 확충": "수요 증가와 설비 확충 동행",
    "전력 수요 둔화": "전력 수요 증가세 약화",
    "병목 근거 제한": "수요·공급 신호 엇갈림",
    "판정 제한": "전력 투자 근거자료 부족",
    "수요 확장": "전력 수요 증가세 뚜렷함",
    "수요 둔화": "전력 수요가 함께 감소",
    "상업용 수요 우세": "상업용 전력 수요가 더 빠르게 증가",
    "완만한 변화": "전력 수요는 증가하나 가속 신호 약함",
    "판정 불가": "전력 수요자료 부족",
  });
}

export function powerDemandAxisLabel(value?: string | null): string {
  return pick(value, {
    "전력 수요 빠르게 확대": "전력 수요 빠르게 확대",
    "전력 수요 확대": "전력 수요 확대",
    "AI 관찰지역 중심 확대": "AI 관찰지역 중심 확대",
    "전력 수요 감소": "전력 수요 감소",
    "방향 엇갈림": "지역·기간별 방향 엇갈림",
    "자료 부족": "수요자료 부족",
    "광범위한 수요 가속": "여러 지역에서 수요 가속",
    "수요 확장": "전력 수요 증가",
    "수요 둔화": "전력 수요 증가세 약화",
    혼조: "지역·기간별 방향 엇갈림",
    "판정 제한": "수요자료 부족",
  });
}

export function powerSupplyAxisLabel(value?: string | null): string {
  return pick(value, {
    "건설 확대": "발전·저장 건설 확대",
    "건설 진행": "발전·저장 건설 진행",
    "건설 미약": "발전·저장 건설 미약",
    "지연·순감소": "건설 지연·순설비 감소",
    "자료 부족": "건설자료 부족",
    "공급 확충 강함": "건설 중 설비가 빠르게 증가",
    "공급 확충 진행": "건설 중 설비가 증가",
    "공급 대응 제한": "예정된 순설비 확충이 제한적",
    "설비 순감소 위험": "은퇴 반영 시 설비 순감소",
    "판정 제한": "설비자료 부족",
  });
}

export function powerOperationsAxisLabel(value?: string | null): string {
  return pick(value, {
    "운영 여유": "운영 압력 낮음",
    "부담 신호 관찰": "운영 부담 신호 관찰",
    "운영 부담 높음": "운영 부담 높음",
    "자료 부족": "운영자료 부족",
  });
}

export function interconnectionAxisLabel(value?: string | null): string {
  return pick(value, {
    "접속 대기 부담 높음": "발전 접속 대기 부담 높음",
    "접속 대기 부담": "발전 접속 대기 부담",
    "부담 완화": "발전 접속 대기 부담 완화",
    "자료 부족": "접속 대기자료 부족",
  });
}

export function transmissionInvestmentAxisLabel(value?: string | null): string {
  return pick(value, {
    "송전 투자 확대": "송전 투자 확대",
    "투자 유지": "송전 투자 증가세 유지",
    "투자 둔화": "송전 투자 둔화",
    "표본 제한": "송전 투자 비교 제한",
    "자료 부족": "송전 투자자료 부족",
  });
}

export function rdimmStateLabel(value?: string | null): string {
  return pick(value, {
    "가격 급등": "서버 RDIMM 공개가격 급등",
    "가격 상승": "서버 RDIMM 공개가격 상승",
    "가격 급락": "서버 RDIMM 공개가격 급락",
    "가격 하락": "서버 RDIMM 공개가격 하락",
    보합: "서버 RDIMM 공개가격 변화 거의 없음",
    "판정 제한": "서버 RDIMM 가격자료 부족",
  });
}

export function observationStatusLabel(value?: string | null): string {
  return pick(value, {
    연결: "자동 수집",
    "간접 관측": "간접 추정",
    제한: "자료 부족",
  });
}

export function plainLanguageStateText(value: string): string {
  const replacements: Array<[string, string]> = [
    ["타이트 지속 신호", "공급 부족 정황 지속"],
    ["타이트 신호", "공급 부족 신호"],
    ["타이트 관찰", "공급 부족 정황 관찰"],
    ["수출 확장 강함", "수출 증가세 매우 강함"],
    ["확대 강함", "설비투자 빠르게 확대"],
    ["재고 반등 관찰", "완제품 재고 반등·수준은 아직 낮음"],
    ["완만한 변화", "증가세는 있으나 가속 신호 약함"],
    ["변화 제한적", "최근 변화 거의 없음"],
    ["제한적 실질금리", "높은 실질금리 부담"],
    ["중립 규칙", "설정된 위험 기준에 해당하지 않음"],
  ];
  return replacements.reduce(
    (result, [before, after]) => result.split(before).join(after),
    value,
  );
}
