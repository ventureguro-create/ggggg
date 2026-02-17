"""
Backend API Tests for Actor Details Modal Feature (Farm Network Graph Interactivity)

Tests the /api/connections/network/actor/:actorId endpoint and related APIs
"""

import pytest
import requests
import os

# Get the base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://narratives-hub-2.preview.emergentagent.com')

# Test actors from seed data
TEST_ACTORS = ['crypto_whale_alerts', 'moon_signals', 'gem_hunter_pro']


class TestFarmNetworkApi:
    """Test Farm Network API endpoints"""
    
    def test_farm_graph_returns_nodes_and_edges(self):
        """Test /api/connections/network/farm-graph returns nodes and edges"""
        response = requests.get(f"{BASE_URL}/api/connections/network/farm-graph?minScore=0.35&limit=200")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'nodes' in data, "Response should contain 'nodes'"
        assert 'edges' in data, "Response should contain 'edges'"
        assert isinstance(data['nodes'], list), "nodes should be a list"
        assert isinstance(data['edges'], list), "edges should be a list"
        assert len(data['nodes']) > 0, "Should have at least one node"
        assert len(data['edges']) > 0, "Should have at least one edge"
        
        # Check node structure
        node = data['nodes'][0]
        assert 'id' in node, "Node should have 'id'"
        assert 'type' in node, "Node should have 'type'"
        
        # Check edge structure
        edge = data['edges'][0]
        assert 'a' in edge, "Edge should have 'a' (actor A)"
        assert 'b' in edge, "Edge should have 'b' (actor B)"
        assert 'sharedSuspects' in edge, "Edge should have 'sharedSuspects'"
        assert 'overlapScore' in edge, "Edge should have 'overlapScore'"
        
        print(f"SUCCESS: Farm graph API returns {len(data['nodes'])} nodes and {len(data['edges'])} edges")


class TestActorDetailsApi:
    """Test Actor Details API endpoint"""
    
    def test_actor_details_returns_correct_structure(self):
        """Test /api/connections/network/actor/:actorId returns correct data structure"""
        actor_id = 'crypto_whale_alerts'
        response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Required fields
        assert 'actorId' in data, "Response should contain 'actorId'"
        assert data['actorId'] == actor_id, f"actorId should be {actor_id}"
        assert 'riskLevel' in data, "Response should contain 'riskLevel'"
        assert 'summary' in data, "Response should contain 'summary'"
        
        # Audience Quality
        assert 'audienceQuality' in data, "Response should contain 'audienceQuality'"
        if data['audienceQuality']:
            aq = data['audienceQuality']
            assert 'aqi' in aq, "audienceQuality should have 'aqi'"
            assert 'level' in aq, "audienceQuality should have 'level'"
            assert 'pctBot' in aq, "audienceQuality should have 'pctBot'"
            assert 'pctHuman' in aq, "audienceQuality should have 'pctHuman'"
            assert 'pctSuspicious' in aq, "audienceQuality should have 'pctSuspicious'"
            assert 'pctDormant' in aq, "audienceQuality should have 'pctDormant'"
            
        # Authenticity
        assert 'authenticity' in data, "Response should contain 'authenticity'"
        if data['authenticity']:
            auth = data['authenticity']
            assert 'score' in auth, "authenticity should have 'score'"
            assert 'label' in auth, "authenticity should have 'label'"
            assert 'breakdown' in auth, "authenticity should have 'breakdown'"
            
        # Farm Connections
        assert 'farmConnections' in data, "Response should contain 'farmConnections'"
        assert isinstance(data['farmConnections'], list), "farmConnections should be a list"
        
        # Bot Farms
        assert 'botFarms' in data, "Response should contain 'botFarms'"
        assert isinstance(data['botFarms'], list), "botFarms should be a list"
        
        print(f"SUCCESS: Actor details API returns correct structure for {actor_id}")
    
    def test_actor_details_risk_level_values(self):
        """Test that risk level is one of the valid values"""
        actor_id = 'crypto_whale_alerts'
        response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        valid_risk_levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        assert data['riskLevel'] in valid_risk_levels, f"riskLevel should be one of {valid_risk_levels}, got {data['riskLevel']}"
        
        print(f"SUCCESS: Risk level is valid: {data['riskLevel']}")
    
    def test_actor_details_farm_connections_structure(self):
        """Test farm connections have correct structure"""
        actor_id = 'crypto_whale_alerts'
        response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data['farmConnections']) > 0:
            conn = data['farmConnections'][0]
            assert 'connectedActor' in conn, "farmConnection should have 'connectedActor'"
            assert 'sharedSuspects' in conn, "farmConnection should have 'sharedSuspects'"
            assert 'overlapScore' in conn, "farmConnection should have 'overlapScore'"
            assert 'jaccard' in conn, "farmConnection should have 'jaccard'"
            
            # Verify values are numeric
            assert isinstance(conn['sharedSuspects'], int), "sharedSuspects should be int"
            assert isinstance(conn['overlapScore'], (int, float)), "overlapScore should be numeric"
            assert isinstance(conn['jaccard'], (int, float)), "jaccard should be numeric"
            
            print(f"SUCCESS: Farm connections structure correct, found {len(data['farmConnections'])} connections")
        else:
            print("WARNING: No farm connections found for this actor")
    
    def test_actor_details_bot_farms_structure(self):
        """Test bot farms have correct structure"""
        actor_id = 'crypto_whale_alerts'
        response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data['botFarms']) > 0:
            farm = data['botFarms'][0]
            assert 'farmId' in farm, "botFarm should have 'farmId'"
            assert 'actorIds' in farm, "botFarm should have 'actorIds'"
            assert 'botRatio' in farm, "botFarm should have 'botRatio'"
            assert 'confidence' in farm, "botFarm should have 'confidence'"
            assert 'sharedFollowers' in farm, "botFarm should have 'sharedFollowers'"
            
            assert isinstance(farm['actorIds'], list), "actorIds should be a list"
            
            print(f"SUCCESS: Bot farms structure correct, found {len(data['botFarms'])} farms")
        else:
            print("WARNING: No bot farms found for this actor")
    
    def test_multiple_actors(self):
        """Test actor details for multiple test actors"""
        for actor_id in TEST_ACTORS:
            response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
            
            assert response.status_code == 200, f"Failed for actor {actor_id}: {response.status_code}"
            
            data = response.json()
            assert data['actorId'] == actor_id
            assert 'riskLevel' in data
            assert 'summary' in data
            
            print(f"SUCCESS: Actor {actor_id} - Risk: {data['riskLevel']}")
    
    def test_non_existent_actor(self):
        """Test behavior for non-existent actor"""
        actor_id = 'this_actor_does_not_exist_12345'
        response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
        
        # Should return 200 with empty/default data, not 404
        assert response.status_code == 200
        
        data = response.json()
        assert data['actorId'] == actor_id
        # Risk level should be LOW for unknown actors
        assert data['riskLevel'] == 'LOW'
        
        print(f"SUCCESS: Non-existent actor returns default response")


class TestAudienceQualityData:
    """Test audience quality data values"""
    
    def test_aqi_in_valid_range(self):
        """Test AQI is within 0-100 range"""
        for actor_id in TEST_ACTORS:
            response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
            assert response.status_code == 200
            
            data = response.json()
            if data['audienceQuality']:
                aqi = data['audienceQuality']['aqi']
                assert 0 <= aqi <= 100, f"AQI should be 0-100, got {aqi} for {actor_id}"
        
        print("SUCCESS: All AQI values are in valid range")
    
    def test_percentages_sum_reasonable(self):
        """Test that bot/human/suspicious percentages are reasonable"""
        for actor_id in TEST_ACTORS:
            response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
            assert response.status_code == 200
            
            data = response.json()
            if data['audienceQuality']:
                aq = data['audienceQuality']
                pct_bot = aq['pctBot']
                pct_human = aq['pctHuman']
                pct_suspicious = aq['pctSuspicious']
                
                # Each should be 0-100
                assert 0 <= pct_bot <= 100
                assert 0 <= pct_human <= 100
                assert 0 <= pct_suspicious <= 100
        
        print("SUCCESS: All percentage values are reasonable")


class TestAuthenticityData:
    """Test authenticity score data"""
    
    def test_authenticity_score_in_range(self):
        """Test authenticity score is within 0-100 range"""
        for actor_id in TEST_ACTORS:
            response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
            assert response.status_code == 200
            
            data = response.json()
            if data['authenticity']:
                score = data['authenticity']['score']
                assert 0 <= score <= 100, f"Authenticity score should be 0-100, got {score}"
        
        print("SUCCESS: All authenticity scores are in valid range")
    
    def test_authenticity_label_valid(self):
        """Test authenticity label is valid"""
        valid_labels = ['ORGANIC', 'MIXED', 'SUSPICIOUS', 'FAKE']
        
        for actor_id in TEST_ACTORS:
            response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
            assert response.status_code == 200
            
            data = response.json()
            if data['authenticity']:
                label = data['authenticity']['label']
                assert label in valid_labels, f"Invalid label: {label}"
        
        print("SUCCESS: All authenticity labels are valid")
    
    def test_authenticity_breakdown(self):
        """Test authenticity breakdown has required fields"""
        for actor_id in TEST_ACTORS:
            response = requests.get(f"{BASE_URL}/api/connections/network/actor/{actor_id}")
            assert response.status_code == 200
            
            data = response.json()
            if data['authenticity'] and data['authenticity']['breakdown']:
                breakdown = data['authenticity']['breakdown']
                assert 'realFollowerRatio' in breakdown
                assert 'audienceQuality' in breakdown
                assert 'networkIntegrity' in breakdown
        
        print("SUCCESS: Authenticity breakdown structure correct")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
