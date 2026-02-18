#!/usr/bin/env python3
"""
Telegram Intelligence Platform Backend API Tests
Tests Alpha Scoring v2, Credibility, Intel Ranking, Governance, and Explainability APIs
"""
import requests
import sys
import time
import json
from datetime import datetime

class TelegramIntelTester:
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
            print(f"   Response: {str(response_data)[:100]}{'...' if len(str(response_data)) > 100 else ''}")
        print()

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if not headers:
            headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, timeout=30)
            elif method == 'POST':
                if data is not None:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
                else:
                    response = requests.post(url, headers=headers, timeout=30)
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
        """Test basic backend connectivity"""
        print("🔍 Testing Basic Connectivity...")
        
        # Test basic health check
        success, data, _ = self.run_test("Backend Health Check", "GET", "api/health")
        return success

    def test_alpha_scoring_v2(self):
        """Test Alpha Scoring v2 APIs (Institutional Grade)"""
        print("🏆 Testing Alpha Scoring v2 APIs...")
        
        # Test compute alpha for specific channel (alpha_channel - good performance)
        channel_data = {"username": "alpha_channel"}
        success, alpha_response, _ = self.run_test(
            "Compute Alpha v2 for alpha_channel", 
            "POST", 
            "api/admin/telegram-intel/alpha/v2/compute/channel",
            200,
            channel_data
        )
        
        # Test compute alpha for beta_channel (bad performance)
        beta_data = {"username": "beta_channel"}
        success, beta_response, _ = self.run_test(
            "Compute Alpha v2 for beta_channel", 
            "POST", 
            "api/admin/telegram-intel/alpha/v2/compute/channel",
            200,
            beta_data
        )
        
        # Test batch alpha compute
        batch_data = {"limit": 10, "days": 90}
        success, batch_response, _ = self.run_test(
            "Batch Alpha v2 Compute", 
            "POST", 
            "api/admin/telegram-intel/alpha/v2/compute/batch",
            200,
            batch_data
        )
        
        # Test alpha leaderboard
        success, leaderboard_data, _ = self.run_test(
            "Alpha v2 Leaderboard", 
            "GET", 
            "api/admin/telegram-intel/alpha/v2/leaderboard"
        )
        
        # Test error handling - missing username
        success, error_response, _ = self.run_test(
            "Alpha v2 Compute - Missing Username", 
            "POST", 
            "api/admin/telegram-intel/alpha/v2/compute/channel",
            400,
            {}
        )

    def test_credibility_scoring(self):
        """Test Credibility Scoring APIs"""
        print("🛡️ Testing Credibility Scoring APIs...")
        
        # Test compute credibility for alpha_channel
        cred_data = {"username": "alpha_channel"}
        success, cred_response, _ = self.run_test(
            "Compute Credibility for alpha_channel", 
            "POST", 
            "api/admin/telegram-intel/credibility/channel",
            200,
            cred_data
        )
        
        # Test compute credibility for beta_channel
        beta_cred_data = {"username": "beta_channel"}
        success, beta_cred_response, _ = self.run_test(
            "Compute Credibility for beta_channel", 
            "POST", 
            "api/admin/telegram-intel/credibility/channel",
            200,
            beta_cred_data
        )
        
        # Test get credibility details for alpha_channel
        success, alpha_cred_details, _ = self.run_test(
            "Get Credibility Details for alpha_channel", 
            "GET", 
            "api/admin/telegram-intel/credibility/alpha_channel"
        )
        
        # Test get credibility details for beta_channel
        success, beta_cred_details, _ = self.run_test(
            "Get Credibility Details for beta_channel", 
            "GET", 
            "api/admin/telegram-intel/credibility/beta_channel"
        )
        
        # Test non-existent channel
        success, not_found, _ = self.run_test(
            "Get Credibility for Non-existent Channel", 
            "GET", 
            "api/admin/telegram-intel/credibility/nonexistent_channel",
            404
        )

    def test_intel_ranking(self):
        """Test Intel Ranking APIs (Unified Scoring)"""
        print("📊 Testing Intel Ranking APIs...")
        
        # Test compute unified intel score for alpha_channel
        intel_data = {"username": "alpha_channel"}
        success, intel_response, _ = self.run_test(
            "Compute Intel Score for alpha_channel", 
            "POST", 
            "api/admin/telegram-intel/intel/compute/channel",
            200,
            intel_data
        )
        
        # Test compute unified intel score for beta_channel (should be 0 if BLOCKLISTED)
        beta_intel_data = {"username": "beta_channel"}
        success, beta_intel_response, _ = self.run_test(
            "Compute Intel Score for beta_channel (BLOCKLIST test)", 
            "POST", 
            "api/admin/telegram-intel/intel/compute/channel",
            200,
            beta_intel_data
        )
        
        # Verify beta_channel has intelScore=0 due to BLOCKLIST
        if success and beta_intel_response and isinstance(beta_intel_response, dict):
            intel_score = beta_intel_response.get('intelScore', -1)
            if intel_score == 0:
                print(f"   ✅ BLOCKLIST verification: beta_channel intelScore = {intel_score} (correct)")
            else:
                print(f"   ❌ BLOCKLIST verification failed: beta_channel intelScore = {intel_score} (should be 0)")
        
        # Test public intel leaderboard (top channels)
        success, top_intel, _ = self.run_test(
            "Intel Leaderboard (Public)", 
            "GET", 
            "api/telegram-intel/intel/top"
        )
        
        # Test get intel details for specific channel (public API)
        success, alpha_intel_details, _ = self.run_test(
            "Get Intel Details for alpha_channel (Public)", 
            "GET", 
            "api/telegram-intel/intel/alpha_channel"
        )
        
        # Test get intel details for beta_channel (should show intelScore=0)
        success, beta_intel_details, _ = self.run_test(
            "Get Intel Details for beta_channel (Public)", 
            "GET", 
            "api/telegram-intel/intel/beta_channel"
        )

    def test_governance(self):
        """Test Governance APIs (Config & Overrides)"""
        print("⚖️ Testing Governance APIs...")
        
        # Test get active scoring config
        success, config_data, _ = self.run_test(
            "Get Active Scoring Config", 
            "GET", 
            "api/admin/telegram-intel/governance/config/active"
        )
        
        # Verify config structure
        if success and config_data and isinstance(config_data, dict):
            if 'weights' in config_data and 'fraud' in config_data and 'tiers' in config_data:
                print(f"   ✅ Config structure valid: weights, fraud, tiers present")
            else:
                print(f"   ❌ Config structure invalid: missing required fields")
        
        # Test setting BLOCKLIST override for beta_channel
        blocklist_data = {
            "username": "beta_channel",
            "status": "BLOCKLIST",
            "reason": "Test blocklist for beta_channel"
        }
        success, blocklist_response, _ = self.run_test(
            "Set BLOCKLIST Override for beta_channel", 
            "POST", 
            "api/admin/telegram-intel/governance/override",
            200,
            blocklist_data
        )
        
        # Test setting ALLOWLIST override for alpha_channel
        allowlist_data = {
            "username": "alpha_channel", 
            "status": "ALLOWLIST",
            "reason": "Test allowlist for alpha_channel"
        }
        success, allowlist_response, _ = self.run_test(
            "Set ALLOWLIST Override for alpha_channel", 
            "POST", 
            "api/admin/telegram-intel/governance/override",
            200,
            allowlist_data
        )
        
        # Test setting forced tier override
        forced_tier_data = {
            "username": "alpha_channel",
            "forcedTier": "A",
            "reason": "Force A tier for testing"
        }
        success, tier_response, _ = self.run_test(
            "Set Forced Tier Override", 
            "POST", 
            "api/admin/telegram-intel/governance/override",
            200,
            forced_tier_data
        )

    def test_explainability(self):
        """Test Explainability APIs"""
        print("📖 Testing Explainability APIs...")
        
        # Test human-readable explanation for alpha_channel
        success, alpha_explain, _ = self.run_test(
            "Get Explanation for alpha_channel", 
            "GET", 
            "api/telegram-intel/intel/explain/alpha_channel"
        )
        
        # Verify explanation structure
        if success and alpha_explain and isinstance(alpha_explain, dict):
            if 'explanation' in alpha_explain and isinstance(alpha_explain['explanation'], list):
                explanations = alpha_explain['explanation']
                print(f"   ✅ Explanation contains {len(explanations)} bullet points")
                for i, bullet in enumerate(explanations[:3]):  # Show first 3 bullets
                    print(f"   • {bullet}")
            else:
                print(f"   ❌ Explanation structure invalid")
        
        # Test explanation for beta_channel (should explain BLOCKLIST)
        success, beta_explain, _ = self.run_test(
            "Get Explanation for beta_channel (BLOCKLIST)", 
            "GET", 
            "api/telegram-intel/intel/explain/beta_channel"
        )
        
        # Verify BLOCKLIST is mentioned in explanation
        if success and beta_explain and isinstance(beta_explain, dict):
            explanation_text = str(beta_explain.get('explanation', []))
            if 'BLOCKLIST' in explanation_text:
                print(f"   ✅ BLOCKLIST correctly mentioned in explanation")
            else:
                print(f"   ❌ BLOCKLIST not found in explanation")
        
        # Test explanation for non-existent channel
        success, not_found_explain, _ = self.run_test(
            "Get Explanation for Non-existent Channel", 
            "GET", 
            "api/telegram-intel/intel/explain/nonexistent_channel",
            404
        )

    def test_integration_flow(self):
        """Test complete integration flow"""
        print("🔄 Testing Integration Flow...")
        
        # Complete flow: Alpha → Credibility → Intel → Explain
        test_channel = "integration_test_channel"
        
        # 1. Compute Alpha
        alpha_data = {"username": test_channel}
        success_alpha, _, _ = self.run_test(
            "Flow Step 1: Compute Alpha for integration test", 
            "POST", 
            "api/admin/telegram-intel/alpha/v2/compute/channel",
            200,
            alpha_data
        )
        
        # 2. Compute Credibility
        cred_data = {"username": test_channel}
        success_cred, _, _ = self.run_test(
            "Flow Step 2: Compute Credibility for integration test", 
            "POST", 
            "api/admin/telegram-intel/credibility/channel",
            200,
            cred_data
        )
        
        # 3. Compute Intel Score
        intel_data = {"username": test_channel}
        success_intel, _, _ = self.run_test(
            "Flow Step 3: Compute Intel Score for integration test", 
            "POST", 
            "api/admin/telegram-intel/intel/compute/channel",
            200,
            intel_data
        )
        
        # 4. Get Explanation
        success_explain, _, _ = self.run_test(
            "Flow Step 4: Get Explanation for integration test", 
            "GET", 
            f"api/telegram-intel/intel/explain/{test_channel}"
        )
        
        if success_alpha and success_cred and success_intel and success_explain:
            print(f"   ✅ Complete integration flow successful")
        else:
            print(f"   ❌ Integration flow failed at some step")

    def run_comprehensive_tests(self):
        """Run all telegram intelligence platform tests"""
        print("🚀 Starting Telegram Intelligence Platform API Tests...")
        print("=" * 70)
        
        # Test basic connectivity first
        if not self.test_basic_connectivity():
            print("❌ Basic connectivity failed. Backend may not be running properly.")
            return False
            
        # Run all feature tests
        self.test_alpha_scoring_v2()
        self.test_credibility_scoring()
        self.test_governance()  # Test governance first to set up overrides
        self.test_intel_ranking()  # Test intel ranking after overrides are set
        self.test_explainability()
        self.test_integration_flow()
        
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
    print("Telegram Intelligence Platform - Backend API Testing")
    print("Testing Alpha v2, Credibility, Intel Ranking, Governance & Explainability")
    print()
    
    tester = TelegramIntelTester("https://crypto-alpha.preview.emergentagent.com")
    
    try:
        success = tester.run_comprehensive_tests()
        
        # Save detailed results for analysis
        with open('/app/telegram_intel_test_results.json', 'w') as f:
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