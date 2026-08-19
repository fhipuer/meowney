import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RegimeCurrent } from "@/types";
import { UpcomingEvents } from "./RegimeCurrentOverview";

describe("UpcomingEvents", () => {
  it("keeps cached FRED dates visible without exposing collector status", () => {
    const data = {
      feed_health: {
        events: {
          source: "macro_events",
          status: "failed",
        },
      },
      upcoming_events: [
        {
          id: "cpi-2026-09-11",
          event_type: "CPI",
          scheduled_at: null,
          scheduled_date: "2026-09-11",
          time_precision: "date",
          importance: "high",
          status: "scheduled",
          source: "FRED",
          source_url: "https://fred.stlouisfed.org/release?rid=10",
          affected_domains: ["inflation", "rates"],
        },
      ],
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<UpcomingEvents data={data} />);

    expect(html).not.toContain("발표 일정 갱신 지연");
    expect(html).not.toContain("일부 일정만 갱신됨");
    expect(html).toContain("CPI");
    expect(html).toContain("9월 11일");
    expect(html).toContain("발표 시각 미제공");
    expect(html).not.toContain("다음 미국 BLS 발표");
  });

  it("shows the nearest release date first and keeps every cached event accessible", () => {
    const events = [
      ["gdp", "미국 GDP", "2026-08-26"],
      ["pce", "PCE·개인소득", "2026-08-26"],
      ["jolts", "JOLTS", "2026-09-01"],
      ["jobs", "미국 고용보고서", "2026-09-04"],
      ["ppi", "PPI", "2026-09-10"],
    ].map(([id, event_type, scheduled_date]) => ({
      id,
      event_type,
      scheduled_at: null,
      scheduled_date,
      time_precision: "date" as const,
      importance: "high",
      status: "scheduled",
      source: "FRED",
      source_url: "https://fred.stlouisfed.org/",
      affected_domains: ["growth"],
    }));
    const data = {
      feed_health: { events: { source: "macro_events", status: "success" } },
      upcoming_events: events,
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<UpcomingEvents data={data} />);

    expect(html).toContain("향후 5건");
    expect(html).toContain("가장 가까운 발표일 · 2건");
    expect(html).toContain("이후 일정 3건 전체 보기");
    expect(html).toContain("JOLTS");
    expect(html).toContain("미국 고용보고서");
    expect(html).toContain("PPI");
    expect(html).not.toContain("일부 일정만 갱신됨");
  });
});
