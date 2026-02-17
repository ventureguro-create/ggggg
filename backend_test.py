#!/usr/bin/env python3
"""
Telegram Discovery Module Backend API Tests
Tests all endpoints through the Python FastAPI proxy on port 8001
"""
import requests
import sys
import time
import json
from datetime import datetime

class TelegramDiscoveryTester:
    def __init__(self, base_url="http://localhost:8001"):
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
        if not headers:
            headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
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
        """Test basic proxy and backend connectivity"""
        print("🔍 Testing Basic Connectivity...")
        
        # Test proxy health
        success, data, _ = self.run_test("Proxy Health Check", "GET", "api/health")
        
        # Test telegram module health
        success, data, _ = self.run_test("Telegram Module Health Check", "GET", "api/telegram/health")
        
        return success

    def test_channels_api(self):
        """Test channels management APIs"""
        print("📡 Testing Channels API...")
        
        # Test getting channels list
        success, channels_data, _ = self.run_test("Get Channels List", "GET", "api/telegram/channels")
        
        # Test with query parameters
        success, filtered_data, _ = self.run_test("Get Channels with Filters", "GET", "api/telegram/channels?status=active&limit=10")
        
        # Test seeding a new channel
        seed_data = {
            "username": f"test_channel_{int(time.time())}",
            "title": "Test Channel for API Testing",
            "description": "This is a test channel created during API testing",
            "tags": ["test", "api"],
            "category": "testing"
        }
        
        success, seed_response, status_code = self.run_test("Seed New Channel", "POST", "api/telegram/channels/seed", 200, seed_data)
        
        # Store channelId for further tests
        self.test_channel_id = None
        if success and isinstance(seed_response, dict) and 'channelId' in seed_response:
            self.test_channel_id = seed_response['channelId']
            print(f"   Created channel ID: {self.test_channel_id}")
            
            # Test getting single channel details
            success, channel_detail, _ = self.run_test(
                "Get Single Channel Details", 
                "GET", 
                f"api/telegram/channels/{self.test_channel_id}"
            )
            
            # Test updating channel status
            status_update = {"status": "paused"}
            success, update_response, _ = self.run_test(
                "Update Channel Status", 
                "PATCH", 
                f"api/telegram/channels/{self.test_channel_id}/status",
                200,
                status_update
            )
        
        # Test getting non-existent channel (should return 404)
        success, error_response, status = self.run_test(
            "Get Non-existent Channel", 
            "GET", 
            "api/telegram/channels/nonexistent_channel_id",
            404
        )

    def test_discovery_api(self):
        """Test discovery statistics and candidates APIs"""
        print("🔍 Testing Discovery API...")
        
        # Test discovery stats
        success, stats_data, _ = self.run_test("Get Discovery Statistics", "GET", "api/telegram/discovery/stats")
        
        # Test getting discovery candidates
        success, candidates_data, _ = self.run_test("Get Discovery Candidates", "GET", "api/telegram/discovery/candidates")
        
        # Test candidates with filters
        success, filtered_candidates, _ = self.run_test(
            "Get Discovery Candidates with Filters", 
            "GET", 
            "api/telegram/discovery/candidates?limit=5&status=pending"
        )

    def test_rankings_api(self):
        """Test ranking calculation and retrieval APIs"""
        print("📊 Testing Rankings API...")
        
        # Test getting current rankings
        success, rankings_data, _ = self.run_test("Get Current Rankings", "GET", "api/telegram/rankings")
        
        # Test rankings with limit
        success, limited_rankings, _ = self.run_test("Get Limited Rankings", "GET", "api/telegram/rankings?limit=10")
        
        # Test triggering ranking calculation
        success, calc_response, _ = self.run_test("Trigger Ranking Calculation", "POST", "api/telegram/rankings/calculate")

    def test_fraud_detection_api(self):
        """Test fraud detection APIs"""
        print("🛡️ Testing Fraud Detection API...")
        
        # We need a channel ID for fraud analysis
        if hasattr(self, 'test_channel_id') and self.test_channel_id:
            success, fraud_data, _ = self.run_test(
                "Analyze Channel for Fraud", 
                "GET", 
                f"api/telegram/fraud/analyze/{self.test_channel_id}"
            )
        else:
            # Try with a seed channel (assuming they exist)
            success, fraud_data, _ = self.run_test(
                "Analyze Channel for Fraud (seed channel)", 
                "GET", 
                "api/telegram/fraud/analyze/seed_crypto_news"
            )

    def test_additional_endpoints(self):
        """Test additional endpoints mentioned in the routes"""
        print("🔧 Testing Additional Endpoints...")
        
        # Test metrics endpoint (if we have a channel ID)
        if hasattr(self, 'test_channel_id') and self.test_channel_id:
            success, metrics_data, _ = self.run_test(
                "Get Channel Metrics", 
                "GET", 
                f"api/telegram/metrics/{self.test_channel_id}"
            )
            
            success, metrics_calc, _ = self.run_test(
                "Calculate Channel Metrics", 
                "POST", 
                f"api/telegram/metrics/calculate/{self.test_channel_id}"
            )

    def run_comprehensive_tests(self):
        """Run all telegram discovery tests"""
        print("🚀 Starting Telegram Discovery Module API Tests...")
        print("=" * 60)
        
        # Test basic connectivity first
        if not self.test_basic_connectivity():
            print("❌ Basic connectivity failed. Backend may not be running properly.")
            return False
            
        # Continue with functional tests
        self.test_channels_api()
        self.test_discovery_api()
        self.test_rankings_api()
        self.test_fraud_detection_api()
        self.test_additional_endpoints()
        
        # Print summary
        print("=" * 60)
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
    print("Telegram Discovery Module - Backend API Testing")
    print("Testing through Python proxy on port 8001")
    print()
    
    tester = TelegramDiscoveryTester("http://localhost:8001")
    
    try:
        success = tester.run_comprehensive_tests()
        
        # Save detailed results for analysis
        with open('/app/telegram_test_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'tests_run': tester.tests_run,
                    'tests_passed': tester.tests_passed,
                    'success_rate': f"{(tester.tests_passed/tester.tests_run*100):.1f}%"
                },
                'failed_tests': tester.get_failed_tests(),
                'all_results': tester.test_results
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