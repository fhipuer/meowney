import pytest

from app.services.regime_external import ExternalObservationRepository, utc_now


def test_partial_fetch_status_preserves_usable_cache_and_error():
    repo = ExternalObservationRepository()
    feed_id = "test_partial_external_feed"

    repo.save_status(
        feed_id,
        "test",
        "partial_dataset",
        utc_now(),
        success=True,
        status="partial",
        item_count=3,
        error="one report failed",
    )

    status = repo.status(feed_id)
    assert status is not None
    assert status["status"] == "partial"
    assert status["last_success_at"] is not None
    assert status["item_count"] == 3
    assert status["error"] == "one report failed"


def test_fetch_status_rejects_unknown_state():
    with pytest.raises(ValueError, match="지원하지 않는 외부 피드 상태"):
        ExternalObservationRepository().save_status(
            "test_invalid_external_feed",
            "test",
            "invalid_dataset",
            utc_now(),
            success=False,
            status="unknown",
        )
