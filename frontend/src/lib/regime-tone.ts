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
  if (state === "감속 관찰") return "negative";
  if (state === "혼조" || state === "판정 제한") return "caution";
  return "neutral";
}

export function memoryPriceTone(state?: string | null): SemanticTone {
  if (
    state === "가격 확장" ||
    state === "가격 상승" ||
    state === "관측가격 큰 폭 상승" ||
    state === "관측가격 상승"
  ) {
    return "positive";
  }
  if (state === "하락 관찰" || state === "관측가격 하락") {
    return "negative";
  }
  if (state === "혼조" || state === "판정 제한") return "caution";
  return "neutral";
}

export function financialConditionTone(label?: string | null): SemanticTone {
  if (label === "완화적") return "positive";
  if (label === "매우 제한적") return "negative";
  if (label === "제한적" || label === "다소 제한적") return "caution";
  return "neutral";
}

export function dataQualityTone(status?: string | null): SemanticTone {
  return status === "충분" ? "info" : "caution";
}

export function availabilityTone(status?: string | null): SemanticTone {
  if (status === "연결") return "info";
  if (status === "제한" || status === "부분 관측") return "caution";
  return "neutral";
}

// These helpers are deliberately context-specific. A positive number is not
// globally green: it is supportive only within these explicitly named theses.
export function aiCapexDeltaTone(
  value?: number | null,
  usable = true,
): SemanticTone {
  if (!usable || value == null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

export function memorySupplierPriceDeltaTone(
  value?: number | null,
  usable = true,
): SemanticTone {
  if (!usable || value == null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}
