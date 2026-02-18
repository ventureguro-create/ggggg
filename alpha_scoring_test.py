#!/usr/bin/env python3
"""
Alpha Scoring Engine Backend API Tests
Phase 3 Step 3: Tests all alpha scoring endpoints

Endpoints tested:
- POST /api/admin/telegram-intel/alpha/score/channel - calculate alpha score for single channel  
- POST /api/admin/telegram-intel/alpha/score/batch - batch calculate for all channels
- GET /api/admin/telegram-intel/alpha/leaderboard - top channels by alpha score
- GET /api/admin/telegram-intel/alpha/score/:username - channel alpha details
- GET /api/admin/telegram-intel/alpha/scoring-stats - overall scoring statistics

Test data: alpha_channel (4 mentions, good returns) and beta_channel (3 mentions, bad returns)
"""
import requests
import sys
import json
import time
from datetime import datetime

class AlphaScoringTester:
    def __init__(self, base_url="https://crypto-alpha.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, name, success, status_code=None, response_data=None, error=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({
                "name": name,
                "error": error,
                "status_code": status_code
            })
            
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

    def run_test(self, name, method, endpoint, expected_status=200, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
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

    def test_score_single_channel(self):
        """Test POST /api/admin/telegram-intel/alpha/score/channel"""
        print("🔍 Testing Single Channel Alpha Score Calculation...")
        
        # Test with alpha_channel (should have good returns)
        success, data, status = self.run_test(
            "Calculate Alpha Score for alpha_channel",
            "POST",
            "api/admin/telegram-intel/alpha/score/channel",
            200,
            {"username": "alpha_channel", "windowDays": 90}
        )
        
        if success and isinstance(data, dict):
            if data.get("ok"):
                metrics = data.get("metrics", {})
                expected_fields = ["successRate", "avgReturn7d", "earlynessFactor", "consistency", "alphaScore", 
                                "totalMentions", "evaluatedMentions", "bestMention"]
                for field in expected_fields:
                    if field not in metrics:
                        self.log_test(f"Alpha channel missing field: {field}", False, status, data, f"Missing field: {field}")
                        return
                
                # Verify alpha score is between 0-100
                alpha_score = metrics.get("alphaScore", -1)
                if 0 <= alpha_score <= 100:
                    print(f"   ✅ Alpha score within range: {alpha_score}")
                else:
                    print(f"   ❌ Alpha score out of range: {alpha_score}")
            else:
                print(f"   ⚠️ Calculation failed: {data.get('error', 'unknown')}")
        
        # Test with beta_channel (should have poor returns)
        success, data, status = self.run_test(
            "Calculate Alpha Score for beta_channel",
            "POST", 
            "api/admin/telegram-intel/alpha/score/channel",
            200,
            {"username": "beta_channel", "windowDays": 90}
        )
        
        # Test username normalization with @ prefix
        success, data, status = self.run_test(
            "Channel Score with @ prefix normalization",
            "POST",
            "api/admin/telegram-intel/alpha/score/channel", 
            200,
            {"username": "@alpha_channel"}
        )
        
        # Test missing username (should return 400)
        success, data, status = self.run_test(
            "Channel Score missing username",
            "POST",
            "api/admin/telegram-intel/alpha/score/channel",
            400,
            {}
        )
        
        # Test non-existent channel
        success, data, status = self.run_test(
            "Channel Score for non-existent channel",
            "POST",
            "api/admin/telegram-intel/alpha/score/channel",
            200,
            {"username": "nonexistent_channel_xyz123"}
        )

    def test_batch_calculate(self):
        """Test POST /api/admin/telegram-intel/alpha/score/batch"""
        print("🔍 Testing Batch Alpha Score Calculation...")
        
        # Test default batch calculation
        success, data, status = self.run_test(
            "Batch Calculate Alpha Scores (default params)",
            "POST",
            "api/admin/telegram-intel/alpha/score/batch",
            200,
            {}
        )
        
        if success and isinstance(data, dict):
            expected_fields = ["ok", "processed", "calculated", "skipped"]
            for field in expected_fields:
                if field not in data:
                    self.log_test(f"Batch response missing field: {field}", False, status, data, f"Missing field: {field}")
                    return
            
            processed = data.get("processed", 0)
            calculated = data.get("calculated", 0) 
            skipped = data.get("skipped", 0)
            print(f"   📊 Batch results: processed={processed}, calculated={calculated}, skipped={skipped}")
        
        # Test with custom parameters
        success, data, status = self.run_test(
            "Batch Calculate with custom params",
            "POST",
            "api/admin/telegram-intel/alpha/score/batch",
            200,
            {"limit": 10, "windowDays": 30}
        )

    def test_leaderboard(self):
        """Test GET /api/admin/telegram-intel/alpha/leaderboard"""
        print("🔍 Testing Alpha Score Leaderboard...")
        
        # Test default leaderboard
        success, data, status = self.run_test(
            "Get Alpha Score Leaderboard (default)",
            "GET",
            "api/admin/telegram-intel/alpha/leaderboard",
            200
        )
        
        if success and isinstance(data, dict):
            if data.get("ok"):
                channels = data.get("channels", [])
                if channels:
                    # Verify leaderboard structure
                    first_channel = channels[0]
                    expected_fields = ["username", "alphaScore", "successRate", "avgReturn7d", 
                                     "consistency", "totalMentions", "lastCalculated"]
                    for field in expected_fields:
                        if field not in first_channel:
                            self.log_test(f"Leaderboard missing field: {field}", False, status, data, f"Missing field: {field}")
                            return
                    
                    # Verify scores are sorted (highest first)
                    if len(channels) > 1:
                        first_score = channels[0].get("alphaScore", 0)
                        second_score = channels[1].get("alphaScore", 0)
                        if first_score >= second_score:
                            print(f"   ✅ Leaderboard sorted correctly: {first_score} >= {second_score}")
                        else:
                            print(f"   ❌ Leaderboard not sorted: {first_score} < {second_score}")
                    
                    print(f"   📊 Found {len(channels)} channels in leaderboard")
                else:
                    print("   ⚠️ Empty leaderboard (no scored channels)")
            else:
                print(f"   ❌ Leaderboard failed: {data}")
        
        # Test with custom limit
        success, data, status = self.run_test(
            "Get Leaderboard with limit=5",
            "GET", 
            "api/admin/telegram-intel/alpha/leaderboard?limit=5",
            200
        )

    def test_channel_alpha_details(self):
        """Test GET /api/admin/telegram-intel/alpha/score/:username"""
        print("🔍 Testing Channel Alpha Score Details...")
        
        # First ensure we have calculated alpha scores
        requests.post(
            f"{self.base_url}/api/admin/telegram-intel/alpha/score/channel",
            json={"username": "alpha_channel"},
            timeout=30
        )
        
        # Test getting alpha_channel details
        success, data, status = self.run_test(
            "Get alpha_channel details", 
            "GET",
            "api/admin/telegram-intel/alpha/score/alpha_channel",
            200
        )
        
        if success and isinstance(data, dict):
            if data.get("ok"):
                alpha = data.get("alpha", {})
                if alpha:
                    expected_fields = ["username", "alphaScore", "successRate", "avgReturn7d", 
                                     "consistency", "totalMentions", "evaluatedMentions"]
                    missing_fields = [field for field in expected_fields if field not in alpha]
                    if missing_fields:
                        print(f"   ❌ Missing fields: {missing_fields}")
                    else:
                        print(f"   ✅ All required fields present")
                        print(f"   📊 Alpha: {alpha.get('alphaScore', 'N/A')}, Success: {alpha.get('successRate', 'N/A')}")
                else:
                    print("   ❌ Empty alpha data")
            else:
                print(f"   ❌ Failed to get details: {data}")
        
        # Test username normalization with @ prefix
        success, data, status = self.run_test(
            "Get channel details with @ prefix",
            "GET",
            "api/admin/telegram-intel/alpha/score/@alpha_channel",
            200
        )
        
        # Test non-existent channel (should return 404)
        success, data, status = self.run_test(
            "Get non-existent channel details",
            "GET", 
            "api/admin/telegram-intel/alpha/score/nonexistent_channel_xyz",
            404
        )

    def test_scoring_stats(self):
        """Test GET /api/admin/telegram-intel/alpha/scoring-stats"""
        print("🔍 Testing Alpha Scoring Statistics...")
        
        success, data, status = self.run_test(
            "Get Alpha Scoring Statistics",
            "GET",
            "api/admin/telegram-intel/alpha/scoring-stats",
            200
        )
        
        if success and isinstance(data, dict):
            expected_fields = ["totalChannels", "avgAlphaScore", "topScore", "avgSuccessRate"]
            missing_fields = [field for field in expected_fields if field not in data]
            
            if missing_fields:
                self.log_test(f"Stats missing fields: {missing_fields}", False, status, data, f"Missing fields: {missing_fields}")
            else:
                print(f"   ✅ All required fields present")
                print(f"   📊 Stats: {data.get('totalChannels')} channels, avg score: {data.get('avgAlphaScore')}")
                print(f"   📊 Top score: {data.get('topScore')}, avg success rate: {data.get('avgSuccessRate')}%")

    def test_error_scenarios(self):
        """Test various error scenarios"""
        print("🔍 Testing Error Scenarios...")
        
        # Test invalid JSON
        try:
            response = requests.post(
                f"{self.base_url}/api/admin/telegram-intel/alpha/score/channel",
                data="invalid json",
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            if response.status_code == 400:
                print("   ✅ Invalid JSON properly rejected")
            else:
                print(f"   ❌ Invalid JSON returned: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error testing invalid JSON: {e}")
        
        # Test empty username string
        success, data, status = self.run_test(
            "Empty username string",
            "POST",
            "api/admin/telegram-intel/alpha/score/channel",
            400,
            {"username": ""}
        )
        
        # Test whitespace-only username
        success, data, status = self.run_test(
            "Whitespace-only username",
            "POST", 
            "api/admin/telegram-intel/alpha/score/channel",
            400,
            {"username": "   "}
        )

    def run_comprehensive_tests(self):
        """Run all alpha scoring tests"""
        print("🚀 Starting Alpha Scoring Engine API Tests...")
        print("=" * 60)
        print(f"🌐 Testing endpoint: {self.base_url}")
        print()
        
        # Run all test suites
        self.test_score_single_channel()
        self.test_batch_calculate() 
        self.test_leaderboard()
        self.test_channel_alpha_details()
        self.test_scoring_stats()
        self.test_error_scenarios()
        
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
            print("\n❌ Failed tests:")
            for failed in self.failed_tests:
                print(f"   - {failed['name']}: {failed['error']} (status: {failed['status_code']})")
            return False

    def get_test_summary(self):
        """Get test summary for reporting"""
        return {
            "summary": f"Alpha Scoring Engine API testing completed. {self.tests_passed}/{self.tests_run} tests passed.",
            "tests_run": self.tests_run,
            "tests_passed": self.tests_passed,
            "success_rate": f"{(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%",
            "failed_tests": self.failed_tests,
            "all_results": self.test_results
        }

def main():
    """Main test execution"""
    print("Alpha Scoring Engine - Backend API Testing")
    print("Testing Node.js backend via public endpoint")
    print()
    
    # Use public endpoint from frontend .env
    base_url = "https://crypto-alpha.preview.emergentagent.com"
    tester = AlphaScoringTester(base_url)
    
    try:
        success = tester.run_comprehensive_tests()
        
        # Save detailed results for analysis
        with open('/app/alpha_scoring_test_results.json', 'w') as f:
            json.dump(tester.get_test_summary(), f, indent=2)
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())