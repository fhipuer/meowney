import { describe, expect, it } from "vitest";

import { formatRegimeEventSchedule } from "./regime-events";

describe("formatRegimeEventSchedule", () => {
  it("does not invent a time for a date-only FRED release", () => {
    expect(
      formatRegimeEventSchedule({
        scheduled_at: null,
        scheduled_date: "2026-09-11",
        time_precision: "date",
      }),
    ).toEqual({ primary: "9월 11일", secondary: "발표 시각 미제공" });
  });

  it("converts a precise source timestamp to Korea time", () => {
    const result = formatRegimeEventSchedule({
      scheduled_at: "2026-09-11T12:30:00+00:00",
      scheduled_date: "2026-09-11",
      time_precision: "datetime",
    });

    expect(result.primary).toContain("9월 11일");
    expect(result.primary).toContain("21:30");
    expect(result.secondary).toBe("한국시간");
  });
});
