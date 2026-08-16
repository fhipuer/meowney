from app.services.regime_memory import (
    classify_memory_cycle, classify_nand_prices, parse_memory_price_page, parse_nand_price_page,
)


def section(title, updated, headers, row):
    return f"""
    <div class="price-title">{title}</div>
    <div class="price-last-update"><p>Last Update {updated} 18:10 (GMT+8)</p></div>
    <div class="table-container"><table class="price-table">
      <thead><tr>{''.join(f'<th>{item}</th>' for item in headers)}</tr></thead>
      <tbody><tr>{''.join(f'<td>{item}</td>' for item in row)}</tr></tbody>
    </table></div>"""


def test_parser_reads_public_spot_and_monthly_contract_tables():
    html = section(
        "DRAM Spot Price", "2026-08-14",
        ["Item", "Daily High", "Daily Low", "Session High", "Session Low", "Session Average", "Session Change", "History"],
        ["DDR5 16Gb (2Gx8) 4800/5600", "68.20", "34.00", "68.20", "34.00", "52.733", "▲ 0.06 %", ""],
    ) + section(
        "DRAM Contract Price (2H Jun)", "2026-06-30",
        ["Item", "Session High", "Session Low", "Session Average", "Average Change", "Low Change", "History"],
        ["DDR5 8GB SO-DIMM", "123", "102", "115", "▲ 2.68 %", "▲ 3.03 %", ""],
    )
    result = parse_memory_price_page(html)
    assert len(result) == 2
    assert result[0]["series_id"] == "dram_spot_ddr5_16gb"
    assert result[0]["price_average"] == 52.733
    assert result[1]["series_id"] == "dram_contract_ddr5_sodimm_8gb"
    assert result[1]["period_label"] == "2H Jun"
    assert result[1]["change_percent"] == 2.68


def test_parser_rejects_unknown_products_and_changed_columns():
    unknown = section(
        "DRAM Spot Price", "2026-08-14",
        ["Item", "Session High", "Session Low", "Last Price", "Session Change"],
        ["Unknown DDR", "1", "1", "1", "▲ 1%"],
    )
    assert parse_memory_price_page(unknown) == []


def test_memory_cycle_uses_contract_as_primary_signal():
    state, reason = classify_memory_cycle([
        {"series_id": "dram_contract_ddr5_sodimm_8gb", "change_percent": 6.2},
        {"series_id": "dram_spot_ddr5_16gb", "change_percent": -1.0},
    ])
    assert state == "가격 확장"
    assert "+6.2%" in reason


def test_memory_cycle_requires_contract_data():
    state, _ = classify_memory_cycle([
        {"series_id": "dram_spot_ddr5_16gb", "change_percent": 3.0}
    ])
    assert state == "판정 불가"


def test_nand_parser_reads_tlc_wafer_and_client_ssd():
    html = section(
        "Wafer Spot Price", "2026-08-14",
        ["Item", "Weekly High", "Weekly Low", "Session High", "Session Low", "Session Average", "Session Change", "History"],
        ["512Gb TLC", "23", "17", "23", "17", "20.125", "▲ 4.55 %", ""],
    ) + section(
        "PC-Client OEM SSD Contract Price (2Q'26)", "2026-04-27",
        ["Item", "High", "Low", "Average"],
        ["1TB-mSATA/M.2 TLC PCIe-Value Grade", "278", "265", "270.10"],
    )
    result = parse_nand_price_page(html)
    assert [item["series_id"] for item in result] == ["nand_wafer_spot_512gb_tlc", "nand_client_ssd_contract_1tb"]
    assert result[0]["change_percent"] == 4.55
    assert result[1]["period_label"] == "2Q'26"


def test_nand_classification_uses_512gb_tlc_wafer_spot():
    state, reason = classify_nand_prices([
        {"series_id": "nand_wafer_spot_512gb_tlc", "change_percent": -1.28},
    ])
    assert state == "관측가격 하락"
    assert "-1.3%" in reason
