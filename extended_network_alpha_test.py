#!/usr/bin/env python3
"""
Additional Network Alpha Tests - Extended Coverage
"""
import requests
import sys
import json
from datetime import datetime

class ExtendedNetworkAlphaTests:
    def __init__(self, base_url="https://crypto-alpha.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, name, success, status_code=None, response_data=None, error=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "name": name,
            "success": success,
            "status_code": status_code,
            "timestamp": datetime.now().isoformat(),
        }
        
        if error:
            result["error"] = error
        if response_data:
            result["response_sample"] = str(response_data)[:200] + "..." if len(str(response_data)) > 200 else str(response_data)
            
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {name}")
        if status_code:
            print(f"   Status: {status_code}")
        if error:
            print(f"   Error: {error}")
        if success and response_data:
            print(f"   Response: {str(response_data)[:150]}{'...' if len(str(response_data)) > 150 else ''}")
        print()

    def run_test(self, name, method, endpoint, expected_status=200, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method == 'GET':
                response = requests.get(url, timeout=30)
            elif method == 'POST':
                if data is not None:
                    response = requests.post(url, json=data, timeout=30)
                else:
                    response = requests.post(url, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
                
            self.log_test(name, success, response.status_code, response_data)
            
            return success, response_data, response.status_code
            
        except Exception as e:
            self.log_test(name, False, None, None, f"Exception: {e}")
            return False, {}, None

    def test_advanced_network_alpha_features(self):
        """Test advanced Network Alpha features"""
        print("🔬 Testing Advanced Network Alpha Features...")
        
        # Test leaderboard with various parameters
        success, data, _ = self.run_test(
            "Get Network Alpha Top with Tier A",
            "GET",
            "api/telegram-intel/network-alpha/top?minScore=85&limit=5"
        )
        
        if success and data:
            count = data.get('count', 0)
            print(f"   Found {count} channels with score >= 85")
        
        # Test Intel score top performers
        success, data, _ = self.run_test(
            "Get Intel Score Top Channels",
            "GET", 
            "api/telegram-intel/intel/top?limit=10"
        )
        
        if success and data:
            items = data.get('items', [])
            print(f"   Found {len(items)} channels with Intel scores")
            for item in items[:3]:  # Show top 3
                username = item.get('username', 'unknown')
                intel_score = item.get('intelScore', 0)
                network_alpha = item.get('components', {}).get('networkAlphaScore', 0)
                print(f"   📊 {username}: Intel={intel_score:.1f}, NetAlpha={network_alpha:.1f}")

    def test_temporal_features(self):
        """Test temporal trending features"""
        print("📈 Testing Temporal Trending Features...")
        
        # Test top movers
        success, data, _ = self.run_test(
            "Get Top Movers (7 days)",
            "GET",
            "api/telegram-intel/temporal/top-movers?days=7&metric=intelScore&limit=10"
        )
        
        if success and data:
            movers = data.get('movers', [])
            print(f"   Found {len(movers)} top movers in last 7 days")

    def test_score_integration_validation(self):
        """Test that Network Alpha is properly integrated into IntelScore"""
        print("🔗 Testing Score Integration Validation...")
        
        # Get alpha_channel details from both endpoints to compare
        success1, net_alpha_data, _ = self.run_test(
            "Get alpha_channel Network Alpha",
            "GET",
            "api/telegram-intel/network-alpha/channel/alpha_channel"
        )
        
        success2, intel_data, _ = self.run_test(
            "Get alpha_channel Intel Score",
            "GET",
            "api/telegram-intel/intel/alpha_channel"
        )
        
        if success1 and success2 and net_alpha_data and intel_data:
            net_alpha_score = net_alpha_data.get('doc', {}).get('networkAlphaScore', 0)
            intel_net_alpha = intel_data.get('doc', {}).get('components', {}).get('networkAlphaScore', 0)
            
            print(f"   🔍 Network Alpha Score: {net_alpha_score:.2f}")
            print(f"   🔍 Intel Component Score: {intel_net_alpha:.2f}")
            
            if abs(net_alpha_score - intel_net_alpha) < 0.01:
                print("   ✅ Network Alpha properly integrated into IntelScore")
            else:
                print("   ⚠️  Network Alpha scores don't match between endpoints")
            
            # Check if effective network alpha shows credibility gating
            effective = intel_data.get('doc', {}).get('explain', {}).get('networkAlphaEffective', 0)
            cred_gate = intel_data.get('doc', {}).get('explain', {}).get('credGate', 0)
            
            print(f"   🔍 Network Alpha Effective: {effective:.2f}")
            print(f"   🔍 Credibility Gate: {cred_gate:.2f}")
            
            if effective < net_alpha_score:
                print("   ✅ Credibility gating is working (effective < raw score)")
            else:
                print("   ⚠️  Credibility gating may not be working properly")

    def test_computation_parameters(self):
        """Test computation with different parameters"""
        print("⚙️ Testing Computation Parameters...")
        
        # Test with custom lookback days
        success, data, _ = self.run_test(
            "Compute Network Alpha with Custom Lookback",
            "POST",
            "api/admin/telegram-intel/network-alpha/run",
            data={"lookbackDays": 60}
        )
        
        if success and data:
            qualified_tokens = data.get('qualifiedTokens', 0)
            channels = data.get('channels', 0)
            print(f"   📊 60-day lookback: {qualified_tokens} tokens, {channels} channels")

    def run_all_tests(self):
        """Run all extended tests"""
        print("🚀 Starting Extended Network Alpha Tests...")
        print("=" * 60)
        
        self.test_advanced_network_alpha_features()
        self.test_temporal_features() 
        self.test_score_integration_validation()
        self.test_computation_parameters()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Extended Test Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = ExtendedNetworkAlphaTests()
    success = tester.run_all_tests()
    
    # Save results
    with open('/app/extended_network_alpha_results.json', 'w') as f:
        json.dump({
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': f"{(tester.tests_passed/tester.tests_run*100):.1f}%"
            },
            'all_results': tester.test_results,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())