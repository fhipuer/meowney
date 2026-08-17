from datetime import date

from app.services.regime_customs import (
    aggregate_customs_exports,
    customs_query_windows,
    parse_customs_memory_xml,
)


def xml(items, code="00", message="정상서비스."):
    body = "".join(
        "<item>" + "".join(f"<{key}>{value}</{key}>" for key, value in item.items()) + "</item>"
        for item in items
    )
    return f"<response><header><resultCode>{code}</resultCode><resultMsg>{message}</resultMsg></header><body><items>{body}</items></body></response>".encode()


def test_customs_windows_never_exceed_twelve_months():
    result = customs_query_windows(months=26, today=date(2026, 8, 17))

    assert result == [("202407", "202506"), ("202507", "202606"), ("202607", "202608")]


def test_customs_parser_keeps_raw_hs_children_and_skips_provider_total():
    result = parse_customs_memory_xml(xml([
        {"year": "2026.07", "hsCode": "8542321010", "statKor": "디램", "expDlr": "100", "expWgt": "2", "impDlr": "20", "balPayments": "80"},
        {"year": "2026.07", "hsCode": "8542321030", "statKor": "플래시 메모리", "expDlr": "30", "expWgt": "1", "impDlr": "5", "balPayments": "25"},
        {"year": "총계", "hsCode": "-", "statKor": "-", "expDlr": "999", "expWgt": "9", "impDlr": "0", "balPayments": "999"},
    ]))

    assert len(result) == 4
    assert result[0]["series_id"] == "kr_customs_hs_8542321010_export_usd"
    assert result[0]["observation_date"] == "2026-07-01"

    aggregate = aggregate_customs_exports(result)
    assert aggregate["memory"][-1]["value"] == 130
    assert aggregate["dram"][-1]["value"] == 100
    assert aggregate["flash"][-1]["value"] == 30
    assert aggregate["dram_weight"][-1]["value"] == 2
    assert aggregate["dram_unit_value"][-1]["value"] == 50


def test_customs_aggregation_does_not_divide_by_zero_weight():
    result = parse_customs_memory_xml(xml([
        {"year": "2026.07", "hsCode": "8542321010", "statKor": "디램", "expDlr": "100", "expWgt": "0", "impDlr": "20", "balPayments": "80"},
    ]))

    aggregate = aggregate_customs_exports(result)

    assert aggregate["dram"] == [{"date": "2026-07-01", "value": 100.0}]
    assert aggregate["dram_weight"] == [{"date": "2026-07-01", "value": 0.0}]
    assert aggregate["dram_unit_value"] == []


def test_customs_parser_raises_provider_error():
    try:
        parse_customs_memory_xml(xml([], code="99", message="기간 오류"))
    except ValueError as exc:
        assert "기간 오류" in str(exc)
    else:
        raise AssertionError("provider error must not be treated as an empty success")
