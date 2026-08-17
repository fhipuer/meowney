from app.services.regime_kosis import ITEM_SERIES, parse_kosis_semiconductor


def row(item="T10", period="202606", value="204.7", **overrides):
    result = {
        "ORG_ID": "101", "TBL_ID": "DT_1F02001", "C1": "00", "C2": "C261",
        "ITM_ID": item, "ITM_NM": ITEM_SERIES.get(item, ("", "unknown"))[1],
        "PRD_DE": period, "DT": value, "LST_CHN_DE": "2026-07-22",
        "C2_NM": "반도체 제조업",
    }
    result.update(overrides)
    return result


def test_kosis_parser_maps_all_six_fixed_semiconductor_series():
    result = parse_kosis_semiconductor([row(item=item) for item in ITEM_SERIES])

    assert {item["series_id"] for item in result} == {
        definition[0] for definition in ITEM_SERIES.values()
    }
    assert result[0]["observation_date"] == "2026-06-01"
    assert result[0]["value"] == 204.7
    assert result[0]["unit"] == "2020=100"


def test_kosis_parser_rejects_wrong_table_region_industry_and_symbols():
    result = parse_kosis_semiconductor([
        row(TBL_ID="changed"), row(C1="11"), row(C2="C26"), row(value="-"), row(period="2026Q2"),
    ])

    assert result == []
