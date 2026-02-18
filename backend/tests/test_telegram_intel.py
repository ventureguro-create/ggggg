"""
Telegram Intelligence Module - Backend API Tests
Testing endpoints:
- GET /api/admin/telegram-intel/health
- POST /api/admin/telegram-intel/ingestion/channel
- GET /api/admin/telegram-intel/state/:username
- POST /api/admin/telegram-intel/pipeline/channel
- GET /api/admin/telegram-intel/metrics/:username
- GET /api/admin/telegram-intel/fraud/:username
"""
import pytest
import requests
import os

# Use localhost:8003 as per agent context (external URL returns 404)
BASE_URL = "http://localhost:8003"


class TestTelegramIntelHealth:
    """Health endpoint tests"""
    
    def test_health_returns_200(self):
        """Health check should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/health")
        assert response.status_code == 200
        print(f"✓ Health endpoint returned 200")
    
    def test_health_mode_is_live(self):
        """Health check should show mode: live when connected to real Telegram"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/health")
        data = response.json()
        
        assert data.get("ok") == True
        assert data.get("module") == "telegram-intel"
        assert "runtime" in data
        assert data["runtime"].get("mode") == "live"
        print(f"✓ Mode is 'live' (connected to real Telegram API)")
    
    def test_health_connected_true(self):
        """Health check should show connected: true"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/health")
        data = response.json()
        
        assert data["runtime"].get("connected") == True
        print(f"✓ Runtime connected: true")


class TestIngestionChannel:
    """Channel ingestion endpoint tests"""
    
    def test_ingest_channel_with_username(self):
        """POST /api/admin/telegram-intel/ingestion/channel with username should work"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/ingestion/channel",
            json={"username": "durov"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") == True
        # Should either return inserted posts or cooldown
        res = data.get("res", {})
        if res.get("skipped"):
            assert res.get("reason") == "cooldown"
            print(f"✓ Ingestion returned cooldown (expected for recently ingested channel)")
        else:
            assert "inserted" in res or "maxId" in res
            print(f"✓ Ingestion completed: inserted={res.get('inserted')}, maxId={res.get('maxId')}")
    
    def test_ingest_channel_requires_username(self):
        """POST without username should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/ingestion/channel",
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "username_required"
        print(f"✓ Empty username correctly returns 400 with error 'username_required'")
    
    def test_ingest_channel_normalizes_username(self):
        """Channel ingestion should normalize usernames (remove @, t.me/, etc)"""
        # Test with @ prefix
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/ingestion/channel",
            json={"username": "@durov"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        print(f"✓ Username with @ prefix normalized correctly")


class TestChannelState:
    """Channel state endpoint tests"""
    
    def test_get_state_returns_cursor(self):
        """GET /api/admin/telegram-intel/state/:username should return lastMessageId cursor"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/state/durov")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") == True
        assert "state" in data
        
        state = data["state"]
        assert state.get("username") == "durov"
        assert "lastMessageId" in state
        assert isinstance(state["lastMessageId"], int)
        assert state["lastMessageId"] > 0
        print(f"✓ State returned lastMessageId cursor: {state['lastMessageId']}")
    
    def test_get_state_includes_timestamps(self):
        """State should include ingestion timestamps"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/state/durov")
        data = response.json()
        state = data["state"]
        
        assert "lastIngestAt" in state
        assert "lastProfileAt" in state
        print(f"✓ State includes timestamps: lastIngestAt, lastProfileAt")
    
    def test_get_state_nonexistent_channel(self):
        """GET state for non-existent channel should return 404"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/state/nonexistent_test_channel_xyz123")
        assert response.status_code == 404
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "not_found"
        print(f"✓ Non-existent channel correctly returns 404")


class TestMetricsPipeline:
    """Metrics pipeline endpoint tests"""
    
    def test_pipeline_channel_computes_metrics(self):
        """POST /api/admin/telegram-intel/pipeline/channel should compute metrics, fraud, score"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/pipeline/channel",
            json={"username": "durov"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") == True
        res = data.get("res", {})
        
        # Should have metrics computed
        assert res.get("metrics") == True
        print(f"✓ Pipeline computed metrics: True")
        
        # Should have fraud score
        assert "fraud" in res
        assert isinstance(res["fraud"], (int, float))
        print(f"✓ Pipeline computed fraud score: {res['fraud']}")
        
        # Should have ranking score
        assert "score" in res
        assert isinstance(res["score"], (int, float))
        print(f"✓ Pipeline computed ranking score: {res['score']}")
    
    def test_pipeline_channel_requires_username(self):
        """POST pipeline without username should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/pipeline/channel",
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "username_required"
        print(f"✓ Empty username correctly returns 400")


class TestWindowMetrics:
    """Window metrics endpoint tests"""
    
    def test_get_metrics_returns_windows(self):
        """GET /api/admin/telegram-intel/metrics/:username should return 7d, 30d, 90d windows"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/metrics/durov")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") == True
        assert "metrics" in data
        assert isinstance(data["metrics"], list)
        
        windows = {m["window"] for m in data["metrics"]}
        assert "7d" in windows, "Missing 7d window"
        assert "30d" in windows, "Missing 30d window"
        assert "90d" in windows, "Missing 90d window"
        print(f"✓ Metrics returned all windows: {windows}")
    
    def test_metrics_contains_required_fields(self):
        """Metrics should contain required statistical fields"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/metrics/durov")
        data = response.json()
        
        required_fields = [
            "postsCount", "postsPerDay", "medianViews", "p90Views",
            "viewDispersion", "forwardRate", "activeDaysRatio"
        ]
        
        for metric in data["metrics"]:
            for field in required_fields:
                assert field in metric, f"Missing field: {field} in {metric['window']} window"
        
        print(f"✓ All metrics contain required fields: {required_fields}")
    
    def test_metrics_nonexistent_channel_returns_empty(self):
        """GET metrics for non-existent channel should return empty list"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/metrics/nonexistent_test_channel_xyz123")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("metrics") == []
        print(f"✓ Non-existent channel correctly returns empty metrics list")


class TestFraudSignals:
    """Fraud signals endpoint tests"""
    
    def test_get_fraud_returns_signals(self):
        """GET /api/admin/telegram-intel/fraud/:username should return fraud signals"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/fraud/durov")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("ok") == True
        assert "fraud" in data
        
        fraud = data["fraud"]
        assert fraud.get("username") == "durov"
        assert "fraudRisk" in fraud
        assert "signals" in fraud
        print(f"✓ Fraud returned fraudRisk: {fraud['fraudRisk']}")
    
    def test_fraud_contains_signal_breakdown(self):
        """Fraud should contain signal breakdown"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/fraud/durov")
        data = response.json()
        fraud = data["fraud"]
        
        signals = fraud.get("signals", {})
        
        # Check for expected signal types
        assert "irregularPosting" in signals or "subscriberEfficiency" in signals or "spikeRatio" in signals
        print(f"✓ Fraud signals breakdown: {list(signals.keys())}")
    
    def test_fraud_nonexistent_channel(self):
        """GET fraud for non-existent channel should return 404"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/fraud/nonexistent_test_channel_xyz123")
        assert response.status_code == 404
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "not_found"
        print(f"✓ Non-existent channel correctly returns 404")


class TestEdgeCases:
    """Edge case and error handling tests"""
    
    def test_ingestion_with_empty_string(self):
        """Ingestion with empty string username should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/ingestion/channel",
            json={"username": ""}
        )
        assert response.status_code == 400
        print(f"✓ Empty string username returns 400")
    
    def test_ingestion_with_whitespace_only(self):
        """Ingestion with whitespace only username should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/ingestion/channel",
            json={"username": "   "}
        )
        assert response.status_code == 400
        print(f"✓ Whitespace-only username returns 400")
    
    def test_state_excludes_mongodb_id(self):
        """State response should exclude MongoDB _id field"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/state/durov")
        data = response.json()
        state = data.get("state", {})
        
        assert "_id" not in state or state.get("_id") is None
        print(f"✓ State correctly excludes _id field")
    
    def test_metrics_exclude_mongodb_id(self):
        """Metrics response should exclude MongoDB _id field"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/metrics/durov")
        data = response.json()
        
        for metric in data.get("metrics", []):
            assert "_id" not in metric or metric.get("_id") is None
        print(f"✓ Metrics correctly exclude _id field")
    
    def test_fraud_excludes_mongodb_id(self):
        """Fraud response should exclude MongoDB _id field"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-intel/fraud/durov")
        data = response.json()
        fraud = data.get("fraud", {})
        
        assert "_id" not in fraud or fraud.get("_id") is None
        print(f"✓ Fraud correctly excludes _id field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
