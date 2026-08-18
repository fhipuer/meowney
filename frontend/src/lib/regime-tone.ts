export type SemanticTone =
  | "positive"
  | "negative"
  | "caution"
  | "neutral"
  | "info";

export type SemanticBadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "neutral"
  | "info";

export const TONE_STYLES: Record<
  SemanticTone,
  {
    badge: SemanticBadgeVariant;
    text: string;
    panel: string;
  }
> = {
  positive: {
    badge: "success",
    text: "text-success",
    panel: "border-l-2 border-l-success/70",
  },
  negative: {
    badge: "danger",
    text: "text-danger",
    panel: "border-l-2 border-l-danger/70",
  },
  caution: {
    badge: "warning",
    text: "text-warning",
    panel: "border-l-2 border-l-warning/70",
  },
  info: {
    badge: "info",
    text: "text-info",
    panel: "border-l-2 border-l-info/70",
  },
  neutral: {
    badge: "neutral",
    text: "text-foreground",
    panel: "border-l-2 border-l-border",
  },
};

// Chart series identify datasets; they do not express investment judgment.
// Keep success / warning / danger colors reserved for semantic states.
export const REGIME_SERIES_COLORS = {
  blue: "#60a5fa",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  pink: "#f472b6",
  indigo: "#818cf8",
  sky: "#38bdf8",
} as const;

const HIGHER_SUPPORTIVE_SIGNALS = new Set([
  "us_gdp",
  "us_indpro",
  "kr_gdp",
  "kr_indpro",
]);

const HIGHER_ADVERSE_SIGNALS = new Set([
  "us_unemployment",
  "us_claims",
  "hy_oas",
  "ig_oas",
]);

/**
 * Color only derived changes whose investment meaning is monotonic enough to
 * survive without additional context. Inflation, raw rates, market prices,
 * nominal retail sales and liquidity aggregates intentionally remain neutral.
 */
export function signalMetricTone(
  signalId: string,
  kind: string,
  value?: number | null,
  usable = true,
): SemanticTone {
  if (
    !usable || value == null || value === 0 ||
    !["delta", "return"].includes(kind)
  ) return "neutral";
  if (HIGHER_SUPPORTIVE_SIGNALS.has(signalId)) {
    return value > 0 ? "positive" : "negative";
  }
  if (HIGHER_ADVERSE_SIGNALS.has(signalId)) {
    return value > 0 ? "negative" : "positive";
  }
  return "neutral";
}

export function regimeLevelTone(level?: string | null): SemanticTone {
  if (level === "유지") return "positive";
  if (level === "경계") return "caution";
  if (level === "약화" || level === "전환") return "negative";
  return "neutral";
}

export function signalStatusTone(
  status?: string | null,
  excluded = false,
): SemanticTone {
  if (excluded || status === "unavailable" || status === "데이터 없음") {
    return "neutral";
  }
  if (status === "강함") return "positive";
  if (status === "둔화") return "caution";
  if (status === "약화") return "negative";
  return "neutral";
}

export function aiCapexTone(state?: string | null): SemanticTone {
  if (state === "확대 강함" || state === "높은 투자 지속") {
    return "positive";
  }
  if (state === "감속 관찰") return "caution";
  if (state === "혼조" || state === "판정 제한") return "caution";
  return "neutral";
}

export function memoryPriceTone(state?: string | null): SemanticTone {
  if (
    state === "가격 확장" ||
    state === "가격 상승" ||
    state === "가격 급등" ||
    state === "관측가격 큰 폭 상승" ||
    state === "관측가격 상승"
  ) {
    return "positive";
  }
  if (
    state === "하락 관찰" || state === "관측가격 하락" ||
    state === "가격 하락" || state === "가격 급락"
  ) {
    return "negative";
  }
  if (state === "혼조" || state === "판정 제한") return "caution";
  return "neutral";
}

export function financialConditionTone(label?: string | null): SemanticTone {
  if (label === "완화적" || label === "완화 방향" || label === "선행위험 낮음") return "positive";
  if (
    label === "매우 제한적" || label === "급격한 긴축 충격" ||
    label === "장기 듀레이션 충격" || label === "선행위험 높음"
  ) return "negative";
  if (
    label === "제한적" || label === "다소 제한적" ||
    label === "긴축 충격" || label === "상승 압력" ||
    label === "장기 듀레이션 부담 경계" || label === "장기금리 상승 관찰" ||
    label === "선행위험 경계"
  ) return "caution";
  return "neutral";
}

export function dataQualityTone(status?: string | null): SemanticTone {
  return status === "충분" ? "info" : "caution";
}

export function availabilityTone(status?: string | null): SemanticTone {
  if (
    status === "연결" || status === "부분 관측" || status === "간접 관측"
  ) return "info";
  if (status === "제한") return "caution";
  return "neutral";
}

// These helpers are deliberately context-specific. A positive number is not
// globally green: it is supportive only within these explicitly named theses.
export function aiCapexDeltaTone(
  value?: number | null,
  usable = true,
): SemanticTone {
  if (!usable || value == null || value === 0) return "neutral";
  // One company and one fiscal quarter cannot confirm broad AI investment
  // contraction. Expansion is supportive; a decline is a watch signal until
  // the aggregate rule confirms breadth and persistence.
  return value > 0 ? "positive" : "caution";
}

export type MemoryPriceSampleRole =
  | "direct"
  | "proxy"
  | "spot"
  | "nand"
  | "context";

export function memorySupplierPriceDeltaTone(
  value?: number | null,
  usable = true,
  role: MemoryPriceSampleRole = "direct",
  aggregateState?: string | null,
): SemanticTone {
  if (!usable || value == null || value === 0 || role === "context") {
    return "neutral";
  }
  if (role === "spot") return "caution";
  if (value > 0) {
    return aggregateState && memoryPriceTone(aggregateState) !== "positive"
      ? "caution"
      : "positive";
  }
  return aggregateState && memoryPriceTone(aggregateState) === "negative"
    ? "negative"
    : "caution";
}

export function powerDemandTone(
  state?: string | null,
  usable = true,
): SemanticTone {
  if (!usable) return "neutral";
  if (!["수요 확장", "수요 둔화", "상업용 수요 우세"].includes(state || "")) {
    return "neutral";
  }
  return thesisSignalTone(state);
}

export function thesisSignalTone(state?: string | null): SemanticTone {
  if (
    state && [
      "확장 확인", "수출 확장 강함", "수출 증가", "수급 개선",
      "수요 확장", "타이트 신호", "가격 상승 확인",
      "타이트 지속 신호", "단가·믹스 주도 확장",
      "수출액·후공정 동반 확장", "수출액 확장", "재고 소화 강함",
      "재고 효율 개선", "상대 재고부담 크게 완화", "상대 재고부담 완화",
      "가격 급등", "가격 상승",
    ].includes(state)
  ) return "positive";
  if (
    state && [
      "수출 감소 지속", "생산·출하 둔화", "재고 부담",
      "실적 둔화", "수요 둔화", "병목 완화 경계", "수급 약화 경계",
      "완화 관찰", "수출 약화",
      "재고 부담 확대", "재고 효율 악화", "상대 재고부담 크게 확대",
      "상대 재고부담 확대", "가격 급락", "가격 하락",
    ].includes(state)
  ) return "negative";
  if (
    state && [
      "혼조", "경계", "감속 관찰", "완만한 변화", "재고 반등 관찰",
      "수요 강세·가격 대기", "가격 강세·수요 경계", "가격 하락 관찰",
      "수요 강세·서버 가격 대기", "타이트 관찰", "상업용 수요 우세",
      "보합", "안정",
    ].includes(state)
  ) {
    return "caution";
  }
  return "neutral";
}
