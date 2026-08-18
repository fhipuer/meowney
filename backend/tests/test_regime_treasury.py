from __future__ import annotations

import httpx
import pytest

from app.db.sqlite_client import SQLiteClient
from app.services.regime_treasury import (
    TreasuryYieldService,
    parse_treasury_curve_xml,
)


def treasury_xml(fields: dict[str, float]) -> bytes:
    values = "".join(
        f"<d:{key} m:type=\"Edm.Decimal\">{value}</d:{key}>"
        for key, value in fields.items()
    )
    return (
        "<feed xmlns=\"http://www.w3.org/2005/Atom\" "
        "xmlns:m=\"http://schemas.microsoft.com/ado/2007/08/dataservices/metadata\" "
        "xmlns:d=\"http://schemas.microsoft.com/ado/2007/08/dataservices\">"
        "<entry><content type=\"application/xml\"><m:properties>"
        "<d:NEW_DATE m:type=\"Edm.DateTime\">2026-08-17T00:00:00</d:NEW_DATE>"
        f"{values}</m:properties></content></entry></feed>"
    ).encode()


def test_treasury_parser_maps_official_curve_fields_to_logical_indicators() -> None:
    result = parse_treasury_curve_xml(
        treasury_xml({"BC_10YEAR": 4.72, "BC_30YEAR": 5.31}),
        {"BC_10YEAR": "us10y", "BC_30YEAR": "us30y"},
    )

    assert result == {
        "us10y": [("2026-08-17", 4.72)],
        "us30y": [("2026-08-17", 5.31)],
    }


@pytest.mark.asyncio
async def test_treasury_refresh_persists_nominal_and_real_curve_cache(tmp_path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        dataset = request.url.params["data"]
        if dataset == "daily_treasury_yield_curve":
            content = treasury_xml({"BC_10YEAR": 4.72, "BC_30YEAR": 5.31})
        else:
            content = treasury_xml({"TC_10YEAR": 2.44, "TC_30YEAR": 3.06})
        return httpx.Response(200, content=content)

    service = TreasuryYieldService(
        db=SQLiteClient(tmp_path / "treasury.db"),
        client_factory=lambda **kwargs: httpx.AsyncClient(
            transport=httpx.MockTransport(handler), **kwargs
        ),
    )

    result = await service.refresh(force=True)

    assert result["status"] == "success"
    assert result["saved"] == 4
    assert result["last_observation_date"] == "2026-08-17"
    with service.db.connect() as conn:
        observations = conn.execute(
            "SELECT indicator_id,value,source FROM regime_observations "
            "WHERE observation_date='2026-08-17' ORDER BY indicator_id"
        ).fetchall()
        feed = conn.execute(
            "SELECT status,item_count FROM regime_feed_status "
            "WHERE source='treasury_curve'"
        ).fetchone()

    assert [(row["indicator_id"], row["value"], row["source"]) for row in observations] == [
        ("tips10y", 2.44, "treasury"),
        ("tips30y", 3.06, "treasury"),
        ("us10y", 4.72, "treasury"),
        ("us30y", 5.31, "treasury"),
    ]
    assert dict(feed) == {"status": "success", "item_count": 4}
