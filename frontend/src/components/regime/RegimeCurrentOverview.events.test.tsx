import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RegimeCurrent } from "@/types";
import { UpcomingEvents } from "./RegimeCurrentOverview";

describe("UpcomingEvents", () => {
  it("keeps cached FRED dates visible while a refresh is degraded", () => {
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

    expect(html).toContain("발표 일정 갱신 지연");
    expect(html).toContain("CPI");
    expect(html).toContain("9월 11일");
    expect(html).toContain("발표 시각 미제공");
    expect(html).not.toContain("다음 미국 BLS 발표");
  });
});
