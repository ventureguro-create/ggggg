#!/usr/bin/env python3
"""
Network Alpha Detection Backend API Tests
Tests the Node.js backend Network Alpha features through the public endpoint
"""
import requests
import sys
import time
import json
from datetime import datetime

class NetworkAlphaAPITester:
    def __init__(self, base_url="https://tg-backend-dev.preview.emergentagent.com"):
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
            print(f"   Response: {str(response_data)[:100]}{'...' if len(str(response_data)) > 100 else ''}")
        print()

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        
        # Handle both single expected status and list of acceptable statuses
        if isinstance(expected_status, list):
            expected_statuses = expected_status
        else:
            expected_statuses = [expected_status]
        
        try:
            if method == 'GET':
                response = requests.get(url, timeout=30)
            elif method == 'POST':
                if data is not None:
                    if not headers:
                        headers = {'Content-Type': 'application/json'}
                    response = requests.post(url, json=data, headers=headers, timeout=30)
                else:
                    # For POST with no body, don't set content-type to avoid the error
                    response = requests.post(url, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code in expected_statuses
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
                
            self.log_test(name, success, response.status_code, response_data)
            
            return success, response_data, response.status_code
            
        except requests.exceptions.ConnectionError as e:
            self.log_test(name, False, None, None, f"Connection error: {e}")
            return False, {}, None
        except requests.exceptions.Timeout as e:
            self.log_test(name, False, None, None, f"Timeout: {e}")
            return False, {}, None
        except Exception as e:
            self.log_test(name, False, None, None, f"Exception: {e}")
            return False, {}, None

    def test_basic_connectivity(self):
        """Test basic backend connectivity"""
        print("🔍 Testing Basic Backend Connectivity...")
        
        # Test health endpoint
        success, data, _ = self.run_test("Backend Health Check", "GET", "api/health")
        
        if not success:
            # Try alternative health endpoints
            success, data, _ = self.run_test("Alternative Health Check", "GET", "health")
            
        return success

    def test_network_alpha_computation(self):
        """Test Network Alpha computation API"""
        print("🧠 Testing Network Alpha Computation...")
        
        # Test network alpha computation trigger
        success, data, status = self.run_test(
            "Trigger Network Alpha Computation", 
            "POST", 
            "api/admin/telegram-intel/network-alpha/run",
            200
        )
        
        # Wait a moment for computation to process
        if success:
            print("   ⏳ Waiting for computation to process...")
            time.sleep(3)
            
        return success, data

    def test_network_alpha_leaderboard(self):
        """Test Network Alpha leaderboard API"""
        print("🏆 Testing Network Alpha Leaderboard...")
        
        # Test getting top channels by network alpha
        success, data, _ = self.run_test(
            "Get Network Alpha Top Channels", 
            "GET", 
            "api/telegram-intel/network-alpha/top"
        )
        
        # Test with limit parameter
        success, limited_data, _ = self.run_test(
            "Get Network Alpha Top Channels (Limited)", 
            "GET", 
            "api/telegram-intel/network-alpha/top?limit=10"
        )
        
        # Test with minimum score filter
        success, filtered_data, _ = self.run_test(
            "Get Network Alpha Top Channels (Min Score)", 
            "GET", 
            "api/telegram-intel/network-alpha/top?minScore=50"
        )
        
        return success, data

    def test_network_alpha_channel_details(self):
        """Test Network Alpha channel details API"""
        print("📊 Testing Network Alpha Channel Details...")
        
        # Test known channels mentioned in context (alpha_channel, gamma_channel)
        test_channels = ["alpha_channel", "gamma_channel", "durov"]
        
        for channel in test_channels:
            success, data, _ = self.run_test(
                f"Get Network Alpha Details for {channel}", 
                "GET", 
                f"api/telegram-intel/network-alpha/channel/{channel}"
            )
            
            if success and data and isinstance(data, dict) and 'doc' in data:
                print(f"   📈 {channel} Network Alpha Score: {data.get('doc', {}).get('networkAlphaScore', 'N/A')}")
                print(f"   🎯 {channel} Tier: {data.get('doc', {}).get('tier', 'N/A')}")

    def test_network_alpha_token_details(self):
        """Test Network Alpha token details API"""
        print("🪙 Testing Network Alpha Token Details...")
        
        # Test known tokens mentioned in context (ARB, OP)
        test_tokens = ["ARB", "OP", "ETH", "BTC"]
        
        for token in test_tokens:
            success, data, _ = self.run_test(
                f"Get Network Alpha Details for {token}", 
                "GET", 
                f"api/telegram-intel/network-alpha/token/{token}"
            )
            
            if success and data and isinstance(data, dict) and 'doc' in data:
                doc = data.get('doc', {})
                print(f"   🪙 {token} Mentions: {doc.get('mentionsCount', 'N/A')}")
                print(f"   📅 {token} First Mention: {doc.get('firstMentionAt', 'N/A')}")
                print(f"   📊 {token} Success: {doc.get('success', {}).get('qualified', 'N/A')}")

    def test_intel_score_integration(self):
        """Test IntelScore integration with Network Alpha"""
        print("🎯 Testing IntelScore Integration...")
        
        # Test channels that should have IntelScore with networkAlphaScore component
        test_channels = ["alpha_channel", "gamma_channel", "durov"]
        
        for channel in test_channels:
            # Use the correct endpoint from intel_ranking.routes.ts
            success, data, _ = self.run_test(
                f"Get IntelScore for {channel}", 
                "GET", 
                f"api/telegram-intel/intel/{channel}",
                expected_status=[200, 404]  # 404 is acceptable if channel doesn't exist
            )
            
            if success and data and isinstance(data, dict) and 'doc' in data:
                doc = data.get('doc', {})
                components = doc.get('components', {})
                explain = doc.get('explain', {})
                
                print(f"   📊 {channel} Intel Score: {doc.get('intelScore', 'N/A')}")
                print(f"   🧠 {channel} Network Alpha Score: {components.get('networkAlphaScore', 'N/A')}")
                print(f"   ✨ {channel} Network Alpha Effective: {explain.get('networkAlphaEffective', 'N/A')}")
                print(f"   🚪 {channel} Cred Gate: {explain.get('credGate', 'N/A')}")
            elif success and data and isinstance(data, dict) and data.get('ok') == False:
                print(f"   ℹ️  {channel} not found (expected for some channels)")
            else:
                print(f"   ⚠️  {channel} - unexpected response structure")

    def test_temporal_snapshots(self):
        """Test Temporal Snapshot functionality"""
        print("📸 Testing Temporal Snapshots...")
        
        # Test triggering daily snapshot
        success, data, _ = self.run_test(
            "Trigger Daily Temporal Snapshot", 
            "POST", 
            "api/admin/telegram-intel/temporal/snapshot/run"
        )
        
        # Wait for snapshot processing
        if success:
            print("   ⏳ Waiting for snapshot processing...")
            time.sleep(2)

    def test_temporal_history(self):
        """Test Temporal History API"""
        print("📈 Testing Temporal History...")
        
        # Test channels that should have temporal data
        test_channels = ["alpha_channel", "gamma_channel", "durov"]
        
        for channel in test_channels:
            success, data, _ = self.run_test(
                f"Get Temporal History for {channel}", 
                "GET", 
                f"api/telegram-intel/temporal/{channel}",
                expected_status=[200, 404]  # 404 acceptable if no data
            )
            
            if success and data and isinstance(data, dict) and data.get('ok'):
                print(f"   📊 {channel} has temporal data available: {data.get('count', 0)} snapshots")
            elif success and data and isinstance(data, dict) and data.get('error') == 'no_data':
                print(f"   ℹ️  {channel} has no temporal data (expected for some channels)")
            else:
                print(f"   ⚠️  {channel} - unexpected response")

    def test_admin_endpoints(self):
        """Test admin endpoints"""
        print("🔧 Testing Admin Endpoints...")
        
        # Test network alpha computation (already tested above but include in admin section)
        success, data, _ = self.run_test(
            "Admin Network Alpha Computation", 
            "POST", 
            "api/admin/telegram-intel/network-alpha/run"
        )
        
        # Test temporal snapshot (already tested above)
        success, data, _ = self.run_test(
            "Admin Temporal Snapshot", 
            "POST", 
            "api/admin/telegram-intel/temporal/snapshot/run"
        )

    def run_comprehensive_tests(self):
        """Run all Network Alpha tests"""
        print("🚀 Starting Network Alpha Detection API Tests...")
        print("=" * 70)
        
        # Test basic connectivity first
        if not self.test_basic_connectivity():
            print("❌ Basic connectivity failed. Backend may not be running properly.")
            return False
            
        # Test Network Alpha features
        self.test_network_alpha_computation()
        self.test_network_alpha_leaderboard()
        self.test_network_alpha_channel_details()
        self.test_network_alpha_token_details()
        
        # Test IntelScore integration
        self.test_intel_score_integration()
        
        # Test Temporal features
        self.test_temporal_snapshots()
        self.test_temporal_history()
        
        # Test admin endpoints
        self.test_admin_endpoints()
        
        # Print summary
        print("=" * 70)
        print(f"📊 Test Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} test(s) failed")
            return False

    def get_failed_tests(self):
        """Get list of failed tests for reporting"""
        return [test for test in self.test_results if not test['success']]

def main():
    """Main test execution"""
    print("Network Alpha Detection - Backend API Testing")
    print("Testing Node.js backend through public endpoint")
    print()
    
    tester = NetworkAlphaAPITester()
    
    try:
        success = tester.run_comprehensive_tests()
        
        # Save detailed results for analysis
        with open('/app/network_alpha_test_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'tests_run': tester.tests_run,
                    'tests_passed': tester.tests_passed,
                    'success_rate': f"{(tester.tests_passed/tester.tests_run*100):.1f}%"
                },
                'failed_tests': tester.get_failed_tests(),
                'all_results': tester.test_results,
                'timestamp': datetime.now().isoformat()
            }, f, indent=2)
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())