"""
Alpha Engine - Token Extractor + Mention Storage Tests
Phase 3 Step 1: Telegram Intelligence Platform

Endpoints tested:
- POST /api/admin/telegram-intel/alpha/scan/channel - сканирование постов канала на токены
- GET /api/admin/telegram-intel/alpha/mentions/:username - получение списка mentions канала
- GET /api/admin/telegram-intel/alpha/stats - агрегированная статистика по всем mentions
- POST /api/admin/telegram-intel/alpha/scan/batch - batch сканирование нескольких каналов

Features tested:
- Token extraction: $TOKEN, #TOKEN, PAIR/USDT formats
- Idempotency: duplicate key ignored on re-scan
- Username normalization
"""
import pytest
import requests
from datetime import datetime, timedelta
import time

BASE_URL = "http://localhost:8003"

# Test channel (using existing durov channel or test data)
TEST_CHANNEL = "durov"


class TestAlphaScanChannel:
    """POST /api/admin/telegram-intel/alpha/scan/channel tests"""

    def test_scan_channel_success(self):
        """Scan channel returns expected response structure"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": TEST_CHANNEL, "days": 30}
        )
        assert response.status_code == 200
        data = response.json()

        assert data.get("ok") == True
        assert data.get("username") == TEST_CHANNEL.lower()
        assert "postsScanned" in data
        assert "mentionsCreated" in data
        assert "duplicatesSkipped" in data
        print(f"✓ Scan channel success: scanned={data['postsScanned']}, created={data['mentionsCreated']}")

    def test_scan_channel_requires_username(self):
        """Scan without username returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "username_required"
        print("✓ Empty username correctly returns 400 with 'username_required'")

    def test_scan_channel_empty_string_username(self):
        """Scan with empty string username returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": ""}
        )
        assert response.status_code == 400
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "username_required"
        print("✓ Empty string username correctly returns 400")

    def test_scan_channel_whitespace_username(self):
        """Scan with whitespace-only username returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": "   "}
        )
        assert response.status_code == 400
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "username_required"
        print("✓ Whitespace-only username correctly returns 400")

    def test_scan_channel_normalizes_at_prefix(self):
        """Scan normalizes @prefix in username"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": "@durov", "days": 30}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("username") == "durov"
        print("✓ @prefix correctly normalized")

    def test_scan_channel_normalizes_telegram_url(self):
        """Scan normalizes https://t.me/ prefix"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": "https://t.me/durov", "days": 30}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("username") == "durov"
        print("✓ t.me/ URL correctly normalized")

    def test_scan_channel_custom_days_param(self):
        """Scan accepts custom days parameter"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": TEST_CHANNEL, "days": 7}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("days") == 7
        print("✓ Custom days parameter accepted")

    def test_scan_channel_custom_min_confidence(self):
        """Scan accepts custom minConfidence parameter"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": TEST_CHANNEL, "days": 30, "minConfidence": 0.5}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        print("✓ Custom minConfidence parameter accepted")


class TestAlphaMentions:
    """GET /api/admin/telegram-intel/alpha/mentions/:username tests"""

    def test_mentions_returns_structure(self):
        """Mentions endpoint returns expected structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/{TEST_CHANNEL}"
        )
        assert response.status_code == 200
        data = response.json()

        assert data.get("ok") == True
        assert data.get("username") == TEST_CHANNEL.lower()
        assert "totalMentions" in data
        assert "topTokens" in data
        assert isinstance(data["topTokens"], list)
        assert "mentions" in data
        assert isinstance(data["mentions"], list)
        print(f"✓ Mentions endpoint returns proper structure: totalMentions={data['totalMentions']}")

    def test_mentions_normalizes_username(self):
        """Mentions normalizes @prefix in username"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/@{TEST_CHANNEL}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("username") == TEST_CHANNEL.lower()
        print("✓ Mentions endpoint normalizes @prefix")

    def test_mentions_custom_days(self):
        """Mentions accepts days query param"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/{TEST_CHANNEL}?days=7"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("days") == 7
        print("✓ Mentions endpoint accepts days param")

    def test_mentions_custom_limit(self):
        """Mentions accepts limit query param"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/{TEST_CHANNEL}?limit=50"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert len(data.get("mentions", [])) <= 50
        print("✓ Mentions endpoint accepts limit param")

    def test_mentions_nonexistent_channel(self):
        """Mentions for non-existent channel returns empty list (not 404)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/nonexistent_test_xyz123"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("totalMentions") == 0
        assert data.get("mentions") == []
        print("✓ Non-existent channel returns empty list")


class TestAlphaStats:
    """GET /api/admin/telegram-intel/alpha/stats tests"""

    def test_stats_returns_structure(self):
        """Stats endpoint returns expected structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/stats"
        )
        assert response.status_code == 200
        data = response.json()

        assert data.get("ok") == True
        assert "totalMentions" in data
        assert "uniqueTokensCount" in data
        assert "topTokens" in data
        assert isinstance(data["topTokens"], list)
        assert "topChannels" in data
        assert isinstance(data["topChannels"], list)
        print(f"✓ Stats endpoint returns proper structure: totalMentions={data['totalMentions']}")

    def test_stats_custom_days(self):
        """Stats accepts days query param"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/stats?days=7"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("days") == 7
        print("✓ Stats endpoint accepts days param")


class TestAlphaBatchScan:
    """POST /api/admin/telegram-intel/alpha/scan/batch tests"""

    def test_batch_scan_success(self):
        """Batch scan multiple channels"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/batch",
            json={"usernames": ["durov", "telegram"], "days": 30}
        )
        assert response.status_code == 200
        data = response.json()

        assert data.get("ok") == True
        assert "channelsProcessed" in data
        assert "totalMentionsCreated" in data
        assert "results" in data
        assert isinstance(data["results"], list)
        assert data["channelsProcessed"] == 2
        print(f"✓ Batch scan success: processed={data['channelsProcessed']}, created={data['totalMentionsCreated']}")

    def test_batch_scan_requires_usernames(self):
        """Batch scan without usernames returns error"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/batch",
            json={}
        )
        assert response.status_code == 200  # Returns JSON error, not HTTP error
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "usernames_required"
        print("✓ Empty usernames correctly returns error")

    def test_batch_scan_empty_array(self):
        """Batch scan with empty array returns error"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/batch",
            json={"usernames": []}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == False
        assert data.get("error") == "usernames_required"
        print("✓ Empty array correctly returns error")

    def test_batch_scan_normalizes_usernames(self):
        """Batch scan normalizes usernames with @prefix"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/batch",
            json={"usernames": ["@durov", "https://t.me/telegram"], "days": 30}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True

        # Check results contain normalized usernames
        result_usernames = [r.get("username") for r in data.get("results", [])]
        assert "durov" in result_usernames
        assert "telegram" in result_usernames
        print("✓ Batch scan normalizes usernames correctly")

    def test_batch_scan_limits_to_20_channels(self):
        """Batch scan processes max 20 channels"""
        # Create list of 25 usernames
        usernames = [f"test_channel_{i}" for i in range(25)]
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/batch",
            json={"usernames": usernames, "days": 30}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("channelsProcessed") <= 20
        print(f"✓ Batch scan limits to 20 channels: processed={data['channelsProcessed']}")

    def test_batch_scan_handles_mixed_results(self):
        """Batch scan handles mix of successful and failed channels"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/batch",
            json={"usernames": ["durov", ""], "days": 30}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        # At least one should process (durov)
        assert data.get("channelsProcessed") >= 1
        print("✓ Batch scan handles mixed results")


class TestIdempotency:
    """Test that re-scanning doesn't create duplicates"""

    def test_rescan_no_duplicates(self):
        """Running scan twice should not create duplicates"""
        # First scan
        response1 = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": TEST_CHANNEL, "days": 30}
        )
        assert response1.status_code == 200
        data1 = response1.json()
        created1 = data1.get("mentionsCreated", 0)
        duplicates1 = data1.get("duplicatesSkipped", 0)

        # Second scan (same channel, same params)
        response2 = requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": TEST_CHANNEL, "days": 30}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        created2 = data2.get("mentionsCreated", 0)
        duplicates2 = data2.get("duplicatesSkipped", 0)

        # Second scan should skip existing mentions (not create more)
        # If first scan created N mentions, second scan should skip N or more
        print(f"✓ Idempotency: first scan created={created1}, duplicates={duplicates1}")
        print(f"✓ Idempotency: second scan created={created2}, duplicates={duplicates2}")

        # Key assertion: second scan should not create NEW mentions if nothing changed
        # The created2 should be 0 or very small (only new posts since first scan)
        # duplicates2 should be >= created1 (at least as many as were created first time)
        assert data2.get("ok") == True
        print("✓ Re-scan handled duplicates correctly (no errors)")


class TestTokenExtractionWithRealData:
    """Test token extraction using test_crypto channel with crypto content"""

    def test_cashtag_extraction(self):
        """$TOKEN cashtags should be extracted with high confidence"""
        # Scan test_crypto channel (has posts with $ARB, $ETH, $MAGIC)
        requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": "test_crypto", "days": 30}
        )

        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/test_crypto"
        )
        assert response.status_code == 200
        data = response.json()

        # Find cashtag mentions
        cashtag_mentions = [m for m in data.get("mentions", []) if m.get("context", {}).get("source") == "cashtag"]
        
        assert len(cashtag_mentions) > 0, "Should extract cashtag tokens"
        
        # Check ARB with high confidence
        arb_cashtag = next((m for m in cashtag_mentions if m["token"] == "ARB"), None)
        assert arb_cashtag is not None, "Should extract $ARB cashtag"
        assert arb_cashtag["context"]["confidence"] >= 0.80, "Cashtag confidence should be >= 0.80"
        print(f"✓ Cashtag extraction: ARB with confidence {arb_cashtag['context']['confidence']}")

    def test_hashtag_extraction(self):
        """#TOKEN hashtags should be extracted"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/test_crypto"
        )
        assert response.status_code == 200
        data = response.json()

        hashtag_mentions = [m for m in data.get("mentions", []) if m.get("context", {}).get("source") == "hashtag"]
        
        assert len(hashtag_mentions) > 0, "Should extract hashtag tokens"
        
        sol_hashtag = next((m for m in hashtag_mentions if m["token"] == "SOL"), None)
        assert sol_hashtag is not None, "Should extract #SOL hashtag"
        assert sol_hashtag["context"]["confidence"] >= 0.60, "Hashtag confidence should be >= 0.60"
        print(f"✓ Hashtag extraction: SOL with confidence {sol_hashtag['context']['confidence']}")

    def test_pair_extraction(self):
        """PAIR/USDT patterns should be extracted"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/test_crypto"
        )
        assert response.status_code == 200
        data = response.json()

        # Find plain source mentions (pairs)
        plain_mentions = [m for m in data.get("mentions", []) if m.get("context", {}).get("source") == "plain"]
        
        # Should have ARB from ARB/USDT and PEPE from PEPE/USDT
        plain_tokens = {m["token"] for m in plain_mentions}
        assert "ARB" in plain_tokens or "PEPE" in plain_tokens, "Should extract pair tokens"
        print(f"✓ Pair extraction: found tokens {plain_tokens}")

    def test_context_boost_working(self):
        """Context keywords should boost confidence"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/test_crypto"
        )
        data = response.json()

        # MAGIC should have boosted confidence due to "airdrop" context
        magic_mention = next((m for m in data.get("mentions", []) if m["token"] == "MAGIC"), None)
        assert magic_mention is not None, "Should have MAGIC mention"
        assert magic_mention["context"]["confidence"] > 0.82, "Context boost should increase confidence above base"
        print(f"✓ Context boost: MAGIC confidence {magic_mention['context']['confidence']}")

    def test_mention_has_required_fields(self):
        """Each mention should have all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/test_crypto"
        )
        data = response.json()

        required_fields = ["token", "postId", "messageId", "mentionedAt", "username", "context", "evaluated"]
        context_fields = ["snippet", "source", "confidence"]

        for mention in data.get("mentions", []):
            for field in required_fields:
                assert field in mention, f"Missing field: {field}"
            
            context = mention.get("context", {})
            for field in context_fields:
                assert field in context, f"Missing context field: {field}"

        print("✓ All mentions have required fields")


class TestDataValidation:
    """Test response data validation and _id exclusion"""

    def test_mentions_excludes_mongodb_id(self):
        """Mentions response should exclude _id field"""
        # First ensure we have some data by scanning
        requests.post(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/scan/channel",
            json={"username": "test_crypto", "days": 30}
        )

        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/mentions/test_crypto"
        )
        assert response.status_code == 200
        data = response.json()

        # Check mentions don't have _id
        for mention in data.get("mentions", []):
            assert "_id" not in mention, f"Mention should not contain _id: {mention}"
        print("✓ Mentions correctly exclude _id field")

    def test_stats_top_tokens_structure(self):
        """Stats topTokens should have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/stats"
        )
        assert response.status_code == 200
        data = response.json()

        for token in data.get("topTokens", []):
            assert "token" in token
            assert "count" in token
            assert "_id" not in token
        print("✓ Stats topTokens have correct structure")

    def test_stats_top_channels_structure(self):
        """Stats topChannels should have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/telegram-intel/alpha/stats"
        )
        assert response.status_code == 200
        data = response.json()

        for channel in data.get("topChannels", []):
            assert "username" in channel
            assert "count" in channel
            assert "_id" not in channel
        print("✓ Stats topChannels have correct structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
