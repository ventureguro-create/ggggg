"""
Token Mentions API Tests
Tests the GET /api/telegram-intel/channel/:username/mentions endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestChannelMentionsEndpoint:
    """Tests for the public channel token mentions endpoint"""

    def test_endpoint_returns_correct_structure_with_data(self):
        """Test endpoint returns correct response structure for channel with mentions"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields
        assert data.get('ok') is True, "Expected ok=true"
        assert 'username' in data, "Missing username field"
        assert 'days' in data, "Missing days field"
        assert 'total' in data, "Missing total field"
        assert 'evaluated' in data, "Missing evaluated field"
        assert 'avgReturn7d' in data, "Missing avgReturn7d field"
        assert 'hitRate' in data, "Missing hitRate field"
        assert 'topTokens' in data, "Missing topTokens field"
        assert 'mentions' in data, "Missing mentions field"
        
        print(f"✅ Response structure validated for alpha_channel")
        print(f"   total: {data['total']}, evaluated: {data['evaluated']}")
        print(f"   avgReturn7d: {data['avgReturn7d']}, hitRate: {data['hitRate']}")

    def test_endpoint_returns_empty_for_channel_without_mentions(self):
        """Test endpoint returns empty response for channel without mentions"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/durov/mentions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        assert data.get('ok') is True, "Expected ok=true"
        assert data['total'] == 0, f"Expected total=0, got {data['total']}"
        assert data['evaluated'] == 0, f"Expected evaluated=0, got {data['evaluated']}"
        assert data['avgReturn7d'] is None, f"Expected avgReturn7d=null, got {data['avgReturn7d']}"
        assert data['hitRate'] is None, f"Expected hitRate=null, got {data['hitRate']}"
        assert len(data['topTokens']) == 0, f"Expected empty topTokens, got {len(data['topTokens'])}"
        assert len(data['mentions']) == 0, f"Expected empty mentions, got {len(data['mentions'])}"
        
        print("✅ Empty channel returns correct empty response structure")

    def test_username_normalization(self):
        """Test that username is normalized (lowercase, no @)"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/ALPHA_CHANNEL/mentions")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['username'] == 'alpha_channel', f"Username should be normalized, got {data['username']}"
        print("✅ Username normalization working (ALPHA_CHANNEL -> alpha_channel)")

    def test_days_parameter(self):
        """Test days query parameter affects results"""
        response_90d = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions?days=90")
        response_7d = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions?days=7")
        
        assert response_90d.status_code == 200
        assert response_7d.status_code == 200
        
        data_90d = response_90d.json()
        data_7d = response_7d.json()
        
        assert data_90d['days'] == 90, f"Expected days=90, got {data_90d['days']}"
        assert data_7d['days'] == 7, f"Expected days=7, got {data_7d['days']}"
        
        # 90 day window should have >= mentions than 7 day window
        assert data_90d['total'] >= data_7d['total'], "90d should have >= mentions than 7d"
        print(f"✅ Days parameter working: 90d={data_90d['total']} mentions, 7d={data_7d['total']} mentions")

    def test_limit_parameter(self):
        """Test limit query parameter limits results"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions?limit=3")
        
        assert response.status_code == 200
        data = response.json()
        
        # Mentions should be limited (max 3 in response)
        assert len(data['mentions']) <= 3, f"Expected max 3 mentions, got {len(data['mentions'])}"
        print(f"✅ Limit parameter working: returned {len(data['mentions'])} mentions")

    def test_evaluated_filter(self):
        """Test evaluated=true filter only returns evaluated mentions"""
        response_all = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions")
        response_evaluated = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions?evaluated=true")
        
        assert response_all.status_code == 200
        assert response_evaluated.status_code == 200
        
        data_all = response_all.json()
        data_evaluated = response_evaluated.json()
        
        # Evaluated filter should return <= total mentions
        assert len(data_evaluated['mentions']) <= len(data_all['mentions'])
        
        # All mentions in evaluated response should have evaluated=true
        for mention in data_evaluated['mentions']:
            assert mention.get('evaluated') is True, f"Found non-evaluated mention in filtered response"
        
        print(f"✅ Evaluated filter working: all={len(data_all['mentions'])}, evaluated={len(data_evaluated['mentions'])}")

    def test_mention_structure(self):
        """Test individual mention object has correct structure"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions?limit=1")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data['mentions']) > 0:
            mention = data['mentions'][0]
            
            # Required fields
            assert 'token' in mention, "Missing token field"
            assert 'mentionedAt' in mention, "Missing mentionedAt field"
            assert 'messageId' in mention, "Missing messageId field"
            assert 'context' in mention, "Missing context field"
            assert 'evaluated' in mention, "Missing evaluated field"
            
            # Context structure
            if mention['context']:
                assert 'snippet' in mention['context'], "Missing snippet in context"
                assert 'source' in mention['context'], "Missing source in context"
                assert 'confidence' in mention['context'], "Missing confidence in context"
            
            # If evaluated, should have returns
            if mention['evaluated']:
                assert 'returns' in mention, "Evaluated mention should have returns"
                if mention['returns']:
                    assert 'r7d' in mention['returns'] or mention['returns'].get('r7d') is not None, "Missing r7d in returns"
            
            print(f"✅ Mention structure validated: token={mention['token']}, evaluated={mention['evaluated']}")
        else:
            pytest.skip("No mentions to validate structure")

    def test_top_tokens_structure(self):
        """Test topTokens array has correct structure"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/mentions")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data['topTokens']) > 0:
            top_token = data['topTokens'][0]
            
            assert 'token' in top_token, "Missing token field"
            assert 'mentionCount' in top_token, "Missing mentionCount field"
            assert 'evaluatedCount' in top_token, "Missing evaluatedCount field"
            assert 'avgReturn7d' in top_token, "Missing avgReturn7d field"
            assert 'avgMax7d' in top_token, "Missing avgMax7d field"
            
            print(f"✅ Top tokens structure validated: {top_token['token']} (mentions: {top_token['mentionCount']})")
        else:
            pytest.skip("No topTokens to validate structure")

    def test_nonexistent_channel(self):
        """Test endpoint handles non-existent channel gracefully"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/nonexistent_xyz_channel_123/mentions")
        
        # Should return 200 with empty data, not 404
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data['ok'] is True
        assert data['total'] == 0
        
        print("✅ Non-existent channel returns empty response (not 404)")


class TestChannelMentionsIntegration:
    """Integration tests for channel mentions with frontend API"""

    def test_beta_channel_mentions(self):
        """Test another channel to verify consistency"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/beta_channel/mentions?days=90")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['ok'] is True
        assert data['username'] == 'beta_channel'
        
        print(f"✅ beta_channel: {data['total']} mentions, {data['evaluated']} evaluated")

    def test_multiple_channels_consistency(self):
        """Test that multiple channel requests return consistent structure"""
        channels = ['alpha_channel', 'beta_channel', 'gamma_channel', 'delta_channel']
        
        for channel in channels:
            response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/{channel}/mentions?days=90&limit=5")
            assert response.status_code == 200, f"Failed for {channel}"
            
            data = response.json()
            assert data['ok'] is True
            assert data['username'] == channel.lower()
            assert isinstance(data['total'], int)
            assert isinstance(data['evaluated'], int)
            assert isinstance(data['topTokens'], list)
            assert isinstance(data['mentions'], list)
            
            print(f"✅ {channel}: total={data['total']}, evaluated={data['evaluated']}")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
