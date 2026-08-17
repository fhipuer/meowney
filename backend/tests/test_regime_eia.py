import pytest

from app.config import settings
from app.services.regime_eia import EiaPowerService, parse_eia_rows
from app.services.regime_thesis import classify_power_demand


def test_eia_parser_normalizes_monthly_and_annual_periods():
    monthly = parse_eia_rows(
        {"response": {"data": [{
            "period": "2026-05", "sectorid": "COM", "sales": "124043.5",
            "sales-units": "million kilowatt hours", "stateid": "US",
        }]}},
        {"COM": ("us_electricity_sales_commercial", "sales")}, "https://example.test",
    )
    annual = parse_eia_rows(
        {"response": {"data": [{
            "period": "2024", "stateID": "US", "net-summer-capacity": "1230416",
            "net-summer-capacity-units": "megawatts",
        }]}},
        {"US": ("us_electricity_net_summer_capacity", "net-summer-capacity")}, "https://example.test",
    )

    assert monthly[0]["observation_date"] == "2026-05-01"
    assert monthly[0]["value"] == 124043.5
    assert annual[0]["observation_date"] == "2024-12-31"


def test_power_classification_uses_seasonally_matched_three_month_yoy():
    state, _ = classify_power_demand({"yoy_3m_avg": 4.0}, {"yoy_3m_avg": 5.0})
    assert state == "수요 확장"

    state, _ = classify_power_demand({"yoy_3m_avg": -1.0}, {"yoy_3m_avg": -2.0})
    assert state == "수요 둔화"

    state, _ = classify_power_demand({"yoy_3m_avg": 0.5}, {"yoy_3m_avg": 3.0})
    assert state == "상업용 수요 우세"


@pytest.mark.asyncio
async def test_eia_refresh_saves_all_required_series(monkeypatch):
    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def get(self, url, params):
            if "retail-sales" in url:
                rows = [
                    {"period": "2026-05", "sectorid": sector, "sales": value,
                     "sales-units": "million kilowatt hours"}
                    for sector, value in (("ALL", "350"), ("COM", "125"), ("IND", "90"))
                ]
            elif "operational-data" in url:
                rows = [{"period": "2026-05", "sectorid": "99", "fueltypeid": "ALL",
                         "generation": "360", "generation-units": "thousand megawatthours"}]
            else:
                rows = [{"period": "2024", "stateID": "US", "net-summer-capacity": "1230",
                         "net-summer-capacity-units": "megawatts"}]
            return FakeResponse({"response": {"data": rows}})

    monkeypatch.setattr(settings, "eia_api_key", "test-key")
    monkeypatch.setattr("app.services.regime_eia.httpx.AsyncClient", lambda **_: FakeClient())

    result = await EiaPowerService().refresh(force=True)

    assert result == {"status": "success", "saved": 5}
