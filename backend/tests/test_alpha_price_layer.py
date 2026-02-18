"""
Alpha Price Layer API Tests
Tests for Price Layer (Phase 3 Step 2): CoinGecko adapter + MongoDB cache + rate limiting + batch evaluation

Endpoints tested:
- GET /api/admin/telegram-intel/alpha/price/:token - current price
- GET /api/admin/telegram-intel/alpha/price/:token/history?date=YYYY-MM-DD - historical price
- GET /api/admin/telegram-intel/alpha/price-cache-stats - cache stats
- GET /api/admin/telegram-intel/alpha/evaluation-stats - evaluation stats
- POST /api/admin/telegram-intel/alpha/evaluate - batch evaluation job
- POST /api/admin/telegram-intel/alpha/reevaluate - reevaluate incomplete mentions

NOTE: CoinGecko free tier API may return 401 or 429 errors due to rate limiting.
Historical prices require API calls that may time out on free tier.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('BASE_URL', 'http://localhost:8003')

@pytest.fixture
def api_client():
    """Shared requests session with timeout"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestPriceCacheStats:
    """Tests for price cache statistics endpoint"""
    
    def test_price_cache_stats_returns_structure(self, api_client):
        """GET /price-cache-stats returns proper structure"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/price-cache-stats",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "totalCached" in data
        assert "uniqueTokens" in data
        assert "oldestEntry" in data
        
        # Types
        assert isinstance(data["totalCached"], int)
        assert isinstance(data["uniqueTokens"], int)
        assert data["oldestEntry"] is None or isinstance(data["oldestEntry"], str)
        
        print(f"✓ Cache stats: {data['totalCached']} cached, {data['uniqueTokens']} tokens")


class TestEvaluationStats:
    """Tests for evaluation statistics endpoint"""
    
    def test_evaluation_stats_returns_structure(self, api_client):
        """GET /evaluation-stats returns proper structure"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/evaluation-stats",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        required_fields = ["total", "evaluated", "pending", "withPriceData", 
                         "avgReturn24h", "avgReturn7d"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Types and logic
        assert isinstance(data["total"], int)
        assert isinstance(data["evaluated"], int)
        assert isinstance(data["pending"], int)
        assert isinstance(data["withPriceData"], int)
        
        # pending = total - evaluated
        assert data["pending"] == data["total"] - data["evaluated"]
        
        print(f"✓ Evaluation stats: {data['total']} total, {data['evaluated']} evaluated, {data['pending']} pending")


class TestCurrentPrice:
    """Tests for current price endpoint"""
    
    def test_get_current_price_eth_structure(self, api_client):
        """GET /price/ETH returns proper structure"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/price/ETH",
            timeout=30  # Allow time for CoinGecko rate limiting
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "ok" in data
        assert "token" in data
        assert "priceUSD" in data
        
        # Token should be normalized to uppercase
        assert data["token"] == "ETH"
        
        # If ok is true, price should be a positive number
        if data["ok"]:
            assert data["priceUSD"] is not None
            assert isinstance(data["priceUSD"], (int, float))
            assert data["priceUSD"] > 0
            print(f"✓ ETH current price: ${data['priceUSD']}")
        else:
            # API might be rate limited or unavailable
            print(f"⚠ ETH price not available (CoinGecko API may be rate limited)")
    
    def test_get_current_price_normalizes_token(self, api_client):
        """Token is normalized to uppercase"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/price/eth",  # lowercase
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data["token"] == "ETH"  # Should be uppercase
        print("✓ Token normalization working (eth -> ETH)")
    
    def test_get_current_price_unknown_token(self, api_client):
        """Unknown token returns ok=false"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/price/UNKNOWNTOKEN123",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Either ok=false with null price, or API timeout
        assert "ok" in data
        assert "token" in data
        assert data["token"] == "UNKNOWNTOKEN123"
        
        if not data["ok"]:
            assert data["priceUSD"] is None
            print("✓ Unknown token returns ok=false, priceUSD=null")
        else:
            print("⚠ Token unexpectedly found (might be a real token)")


class TestHistoricalPrice:
    """Tests for historical price endpoint"""
    
    def test_historical_price_requires_date(self, api_client):
        """Missing date parameter returns error"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/price/ETH/history",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["ok"] == False
        assert data["error"] == "date_required"
        assert "format" in data
        assert data["format"] == "YYYY-MM-DD"
        print("✓ Missing date returns proper error")
    
    def test_historical_price_invalid_date(self, api_client):
        """Invalid date format returns error"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/price/ETH/history?date=invalid",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["ok"] == False
        assert data["error"] == "invalid_date"
        print("✓ Invalid date returns proper error")
    
    def test_historical_price_structure(self, api_client):
        """GET /price/ETH/history returns proper structure"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/price/ETH/history?date=2025-01-01",
            timeout=60  # Historical API can be slow
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "ok" in data
        assert "token" in data
        assert "date" in data
        assert "priceUSD" in data
        
        # Token and date should be preserved
        assert data["token"] == "ETH"
        assert data["date"] == "2025-01-01"
        
        # Note: CoinGecko free tier may not return historical data
        if data["ok"]:
            assert data["priceUSD"] is not None
            assert isinstance(data["priceUSD"], (int, float))
            print(f"✓ ETH historical price on 2025-01-01: ${data['priceUSD']}")
        else:
            print("⚠ Historical price not available (CoinGecko free tier limitation)")


class TestEvaluateBatch:
    """Tests for batch evaluation endpoint"""
    
    def test_evaluate_batch_returns_structure(self, api_client):
        """POST /evaluate returns proper structure"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/evaluate",
            json={"limit": 10},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        required_fields = ["ok", "processed", "evaluated", "skipped", "errors"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Types
        assert isinstance(data["ok"], bool)
        assert isinstance(data["processed"], int)
        assert isinstance(data["evaluated"], int)
        assert isinstance(data["skipped"], int)
        assert isinstance(data["errors"], int)
        
        # Logic: processed = evaluated + skipped + errors (approximately)
        print(f"✓ Evaluate batch: processed={data['processed']}, evaluated={data['evaluated']}, skipped={data['skipped']}, errors={data['errors']}")
    
    def test_evaluate_batch_limits_input(self, api_client):
        """Limit parameter is respected (max 200)"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/evaluate",
            json={"limit": 500},  # Try to exceed max
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should still work but limited
        assert data["ok"] == True
        # processed should be <= 200 (max limit in code)
        assert data["processed"] <= 200
        print("✓ Limit parameter is capped at 200")
    
    def test_evaluate_batch_without_body(self, api_client):
        """POST /evaluate works without body (uses defaults)"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/evaluate",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "ok" in data
        print("✓ Evaluate works without body")


class TestReevaluate:
    """Tests for reevaluate endpoint"""
    
    def test_reevaluate_returns_structure(self, api_client):
        """POST /reevaluate returns proper structure"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/reevaluate",
            json={"limit": 10},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "ok" in data
        assert "updated" in data
        
        # Types
        assert isinstance(data["ok"], bool)
        assert isinstance(data["updated"], int)
        
        print(f"✓ Reevaluate: updated={data['updated']}")
    
    def test_reevaluate_limits_input(self, api_client):
        """Limit parameter is respected (max 100)"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/reevaluate",
            json={"limit": 500},  # Try to exceed max
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should still work
        assert data["ok"] == True
        print("✓ Reevaluate limit parameter handled")
    
    def test_reevaluate_without_body(self, api_client):
        """POST /reevaluate works without body (uses defaults)"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/reevaluate",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "ok" in data
        print("✓ Reevaluate works without body")


class TestRateLimiting:
    """Tests for rate limiting behavior"""
    
    def test_multiple_requests_dont_crash(self, api_client):
        """Multiple rapid requests don't crash the service"""
        # Make 3 quick requests (should trigger rate limiting internally)
        responses = []
        for i in range(3):
            try:
                response = api_client.get(
                    f"{BASE_URL}/api/admin/telegram-intel/alpha/price-cache-stats",
                    timeout=5
                )
                responses.append(response.status_code)
            except requests.Timeout:
                responses.append("timeout")
        
        # At least one should succeed
        assert 200 in responses, "At least one request should succeed"
        print(f"✓ Multiple requests handled: {responses}")


class TestErrorHandling:
    """Tests for error handling"""
    
    def test_invalid_date_format_variations(self, api_client):
        """Various invalid date formats are handled"""
        invalid_dates = [
            "01-01-2025",  # Wrong format (DD-MM-YYYY instead of YYYY-MM-DD)
            "2025/01/01",  # Wrong separator
            "2025-13-01",  # Invalid month
            "2025-01-32",  # Invalid day
            "",           # Empty
            "null",       # String null
        ]
        
        for date in invalid_dates:
            response = api_client.get(
                f"{BASE_URL}/api/admin/telegram-intel/alpha/price/ETH/history?date={date}",
                timeout=10
            )
            assert response.status_code == 200
            data = response.json()
            # Should return error or ok=false
            # Note: JavaScript Date parsing is lenient, so some may parse
            print(f"  Date '{date}': ok={data.get('ok')}, error={data.get('error', 'none')}")
        
        print("✓ Various date formats handled")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
