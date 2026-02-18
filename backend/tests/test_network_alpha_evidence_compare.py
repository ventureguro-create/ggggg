"""
Network Alpha Evidence & Compare Panel API Tests
Tests for Block UI-4 (Network Evidence) and Block UI-5 (Compare Panel) endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNetworkEvidenceEndpoint:
    """Tests for GET /api/telegram-intel/channel/:username/network-evidence (Block UI-4)"""

    def test_endpoint_returns_correct_structure_with_data(self):
        """Test endpoint returns correct response structure for channel with evidence"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/network-evidence")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields
        assert data.get('ok') is True, "Expected ok=true"
        assert 'username' in data, "Missing username field"
        assert 'count' in data, "Missing count field"
        assert 'summary' in data, "Missing summary field"
        assert 'items' in data, "Missing items field"
        
        # Verify summary structure
        summary = data['summary']
        assert 'totalTokens' in summary, "Missing totalTokens in summary"
        assert 'hitsCount' in summary, "Missing hitsCount in summary"
        assert 'avgPercentile' in summary, "Missing avgPercentile in summary"
        assert 'firstPlaces' in summary, "Missing firstPlaces in summary"
        
        print(f"✅ Network Evidence structure validated for alpha_channel")
        print(f"   count: {data['count']}, tokens: {summary['totalTokens']}, first places: {summary['firstPlaces']}")

    def test_evidence_items_have_correct_structure(self):
        """Test each evidence item has required fields"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/network-evidence")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data.get('items', [])) > 0:
            item = data['items'][0]
            
            # Required fields for evidence item
            assert 'token' in item, "Missing token field"
            assert 'earlyRank' in item, "Missing earlyRank field"
            assert 'cohortSize' in item, "Missing cohortSize field"
            assert 'delayHours' in item, "Missing delayHours field"
            assert 'percentile' in item, "Missing percentile field"
            assert 'return7d' in item, "Missing return7d field"
            assert 'isHit' in item, "Missing isHit field"
            assert 'mentionedAt' in item, "Missing mentionedAt field"
            
            # Data type validations
            assert isinstance(item['earlyRank'], int), "earlyRank should be int"
            assert isinstance(item['cohortSize'], int), "cohortSize should be int"
            assert isinstance(item['delayHours'], (int, float)), "delayHours should be numeric"
            assert isinstance(item['percentile'], (int, float)), "percentile should be numeric"
            assert isinstance(item['isHit'], bool), "isHit should be bool"
            
            print(f"✅ Evidence item structure validated: ${item['token']}")
            print(f"   rank: {item['earlyRank']}/{item['cohortSize']}, delay: {item['delayHours']}h, 7d ROI: {item['return7d']}%")
        else:
            pytest.skip("No evidence items to validate")

    def test_alpha_channel_has_expected_tokens(self):
        """Test alpha_channel has $ARB and $OP with expected data"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/network-evidence")
        
        assert response.status_code == 200
        data = response.json()
        
        tokens = [item['token'] for item in data.get('items', [])]
        
        # Per context, alpha_channel should have ARB and OP
        assert 'ARB' in tokens, "Expected $ARB in alpha_channel evidence"
        assert 'OP' in tokens, "Expected $OP in alpha_channel evidence"
        
        # Verify count matches
        assert data['count'] == 2, f"Expected 2 tokens, got {data['count']}"
        
        print(f"✅ alpha_channel has expected tokens: {tokens}")

    def test_empty_response_for_channel_without_evidence(self):
        """Test endpoint returns empty response for channel without network evidence"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/durov/network-evidence")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        assert data.get('ok') is True, "Expected ok=true"
        assert data['count'] == 0, f"Expected count=0, got {data['count']}"
        assert len(data['items']) == 0, f"Expected empty items, got {len(data['items'])}"
        
        # Summary should reflect empty state
        summary = data['summary']
        assert summary['totalTokens'] == 0
        assert summary['hitsCount'] == 0
        assert summary['firstPlaces'] == 0
        
        print("✅ Empty channel returns correct empty response for network-evidence")

    def test_username_normalization(self):
        """Test username is normalized (lowercase, no @)"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/ALPHA_CHANNEL/network-evidence")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['username'] == 'alpha_channel', f"Username should be normalized, got {data['username']}"
        print("✅ Username normalization working for network-evidence")

    def test_limit_parameter(self):
        """Test limit query parameter limits results"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/network-evidence?limit=1")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data['items']) <= 1, f"Expected max 1 item, got {len(data['items'])}"
        print(f"✅ Limit parameter working for network-evidence: returned {len(data['items'])} items")


class TestComparePanelEndpoint:
    """Tests for GET /api/telegram-intel/channel/:username/compare (Block UI-5)"""

    def test_endpoint_returns_correct_structure(self):
        """Test endpoint returns correct response structure for channel with ranking"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/compare")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields
        assert data.get('ok') is True, "Expected ok=true"
        assert 'username' in data, "Missing username field"
        assert 'current' in data, "Missing current field"
        assert 'position' in data, "Missing position field"
        assert 'gaps' in data, "Missing gaps field"
        assert 'neighbors' in data, "Missing neighbors field"
        assert 'peerContext' in data, "Missing peerContext field"
        
        print(f"✅ Compare Panel structure validated for alpha_channel")

    def test_current_field_structure(self):
        """Test current field has required data"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/compare")
        
        assert response.status_code == 200
        data = response.json()
        
        current = data.get('current', {})
        
        assert 'intelScore' in current, "Missing intelScore in current"
        assert 'tier' in current, "Missing tier in current"
        assert 'components' in current, "Missing components in current"
        
        # Verify tier is valid
        assert current['tier'] in ['S', 'A', 'B', 'C', 'D'], f"Invalid tier: {current['tier']}"
        
        print(f"✅ Current data validated: score={current['intelScore']}, tier={current['tier']}")

    def test_position_field_structure(self):
        """Test position field has required data"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/compare")
        
        assert response.status_code == 200
        data = response.json()
        
        position = data.get('position', {})
        
        assert 'rank' in position, "Missing rank in position"
        assert 'total' in position, "Missing total in position"
        assert 'percentile' in position, "Missing percentile in position"
        assert 'percentileLabel' in position, "Missing percentileLabel in position"
        
        # Data validations
        assert isinstance(position['rank'], int), "rank should be int"
        assert isinstance(position['total'], int), "total should be int"
        assert position['rank'] >= 1, "rank should be >= 1"
        assert position['rank'] <= position['total'], "rank should be <= total"
        
        print(f"✅ Position data validated: #{position['rank']}/{position['total']} ({position['percentileLabel']})")

    def test_gaps_field_structure(self):
        """Test gaps field has required data"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/compare")
        
        assert response.status_code == 200
        data = response.json()
        
        gaps = data.get('gaps', {})
        
        # These fields can be null if at top/bottom
        assert 'up' in gaps, "Missing up in gaps"
        assert 'down' in gaps, "Missing down in gaps"
        assert 'toTierS' in gaps, "Missing toTierS in gaps"
        
        print(f"✅ Gaps data validated: up={gaps.get('up')}, down={gaps.get('down')}, toTierS={gaps.get('toTierS')}")

    def test_neighbors_field_structure(self):
        """Test neighbors field has required data"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/compare")
        
        assert response.status_code == 200
        data = response.json()
        
        neighbors = data.get('neighbors', {})
        
        assert 'prev' in neighbors, "Missing prev in neighbors"
        assert 'next' in neighbors, "Missing next in neighbors"
        
        # If neighbor exists, should have required fields
        if neighbors.get('next'):
            neighbor = neighbors['next']
            assert 'username' in neighbor, "Missing username in neighbor"
            assert 'intelScore' in neighbor, "Missing intelScore in neighbor"
            assert 'tier' in neighbor, "Missing tier in neighbor"
            print(f"✅ Next neighbor validated: @{neighbor['username']} ({neighbor['tier']})")
        
        print(f"✅ Neighbors data validated")

    def test_peer_context_field_structure(self):
        """Test peerContext field has required data"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/compare")
        
        assert response.status_code == 200
        data = response.json()
        
        peer_context = data.get('peerContext', {})
        
        assert 'tier' in peer_context, "Missing tier in peerContext"
        assert 'peersInTier' in peer_context, "Missing peersInTier in peerContext"
        assert 'tierAverage' in peer_context, "Missing tierAverage in peerContext"
        assert 'vsAverage' in peer_context, "Missing vsAverage in peerContext"
        
        print(f"✅ Peer context validated: Tier {peer_context['tier']} ({peer_context['peersInTier']} peers, avg={peer_context['tierAverage']})")

    def test_alpha_channel_is_rank_1_tier_a(self):
        """Test alpha_channel has expected position (per context: rank #1/3, Tier A)"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/alpha_channel/compare")
        
        assert response.status_code == 200
        data = response.json()
        
        position = data.get('position', {})
        current = data.get('current', {})
        
        assert position['rank'] == 1, f"Expected rank 1, got {position['rank']}"
        assert current['tier'] == 'A', f"Expected tier A, got {current['tier']}"
        
        print(f"✅ alpha_channel is rank #{position['rank']}/{position['total']} and Tier {current['tier']}")

    def test_not_found_for_channel_without_ranking(self):
        """Test endpoint returns not_found for channel without intel ranking"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/durov/compare")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        assert data.get('ok') is False, "Expected ok=false for unranked channel"
        assert data.get('error') == 'not_found', f"Expected error='not_found', got {data.get('error')}"
        
        print("✅ Unranked channel returns ok=false, error='not_found'")

    def test_username_normalization(self):
        """Test username is normalized (lowercase, no @)"""
        response = requests.get(f"{BASE_URL}/api/telegram-intel/channel/ALPHA_CHANNEL/compare")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['username'] == 'alpha_channel', f"Username should be normalized, got {data['username']}"
        print("✅ Username normalization working for compare")


class TestIntegrationBothEndpoints:
    """Integration tests for both endpoints together"""

    def test_both_endpoints_return_consistent_username(self):
        """Test both endpoints return same normalized username"""
        channels = ['alpha_channel', 'ALPHA_CHANNEL', '@alpha_channel']
        
        for ch in channels:
            encoded = ch.replace('@', '')  # Don't send @ in URL
            evidence_resp = requests.get(f"{BASE_URL}/api/telegram-intel/channel/{encoded}/network-evidence")
            compare_resp = requests.get(f"{BASE_URL}/api/telegram-intel/channel/{encoded}/compare")
            
            assert evidence_resp.status_code == 200
            
            evidence_data = evidence_resp.json()
            
            assert evidence_data['username'] == 'alpha_channel', f"Evidence username mismatch for {ch}"
            
            if compare_resp.json().get('ok'):
                compare_data = compare_resp.json()
                assert compare_data['username'] == 'alpha_channel', f"Compare username mismatch for {ch}"
        
        print("✅ Both endpoints return consistent username")

    def test_nonexistent_channel_both_endpoints(self):
        """Test both endpoints handle non-existent channel gracefully"""
        channel = 'nonexistent_xyz_test_123'
        
        evidence_resp = requests.get(f"{BASE_URL}/api/telegram-intel/channel/{channel}/network-evidence")
        compare_resp = requests.get(f"{BASE_URL}/api/telegram-intel/channel/{channel}/compare")
        
        assert evidence_resp.status_code == 200, "Network evidence should return 200"
        assert compare_resp.status_code == 200, "Compare should return 200"
        
        evidence_data = evidence_resp.json()
        compare_data = compare_resp.json()
        
        # Network evidence returns empty response
        assert evidence_data['ok'] is True
        assert evidence_data['count'] == 0
        
        # Compare returns not_found
        assert compare_data['ok'] is False
        assert compare_data['error'] == 'not_found'
        
        print("✅ Non-existent channel handled gracefully by both endpoints")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
