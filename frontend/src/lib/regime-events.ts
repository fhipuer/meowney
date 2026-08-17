export type RegimeEventSchedule = {
  scheduled_at?: string | null;
  scheduled_date?: string | null;
  time_precision?: "date" | "datetime";
};

export function formatRegimeEventSchedule(event: RegimeEventSchedule): {
  primary: string;
  secondary: string;
} {
  const dateOnly = event.scheduled_date || event.scheduled_at?.slice(0, 10) || "";
  if (event.time_precision === "date" || !event.scheduled_at) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
    return {
      primary: match
        ? `${Number(match[2])}월 ${Number(match[3])}일`
        : "일정 확인 필요",
      secondary: "발표 시각 미제공",
    };
  }

  const scheduledAt = new Date(event.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { primary: "일정 확인 필요", secondary: "원문 확인" };
  }
  return {
    primary: new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(scheduledAt),
    secondary: "한국시간",
  };
}
