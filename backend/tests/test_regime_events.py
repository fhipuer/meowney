from app.services.regime_events import parse_ics


def test_parse_ics_filters_key_bls_events_and_converts_to_utc():
    payload = """BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=US-Eastern:20260911T083000
SUMMARY:Consumer Price Index for August 2026
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=US-Eastern:20260912T083000
SUMMARY:Import and Export Price Indexes
END:VEVENT
END:VCALENDAR"""
    result = parse_ics(payload)
    assert len(result) == 1
    assert result[0]["title"] == "CPI"
    assert result[0]["scheduled_at"] == "2026-09-11T12:30:00+00:00"
    assert result[0]["affected_domains"] == ["inflation", "rates"]
