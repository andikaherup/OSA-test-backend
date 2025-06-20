#!/usr/bin/env python3
"""
Test runner for email security tests
Can run individual tests or all tests for a domain
"""
import sys
import subprocess
import json
import time
from typing import Dict, Any, List
from utils import validate_domain, handle_error, output_result


def run_single_test(test_type: str, domain: str) -> Dict[str, Any]:
    """Run a single test type for the domain"""
    script_map = {
        'dmarc': 'dmarc_test.py',
        'spf': 'spf_test.py',
        'dkim': 'dkim_test.py',
        'mail_echo': 'mail_echo_test.py'
    }
    
    if test_type not in script_map:
        raise ValueError(f"Unknown test type: {test_type}")
    
    script_path = script_map[test_type]
    
    try:
        # Run the test script
        result = subprocess.run(
            [sys.executable, script_path, domain],
            capture_output=True,
            text=True,
            timeout=60,  # 60 second timeout per test
            cwd='/usr/src/app/python-scripts'
        )
        
        if result.returncode != 0:
            return {
                'test_type': test_type,
                'domain': domain,
                'error': True,
                'message': f"Test failed: {result.stderr}",
                'result': {}
            }
        
        # Parse JSON output
        test_result = json.loads(result.stdout)
        test_result['test_type'] = test_type
        test_result['domain'] = domain
        
        return test_result
        
    except subprocess.TimeoutExpired:
        return {
            'test_type': test_type,
            'domain': domain,
            'error': True,
            'message': 'Test timed out after 60 seconds',
            'result': {}
        }
    except json.JSONDecodeError as e:
        return {
            'test_type': test_type,
            'domain': domain,
            'error': True,
            'message': f"Failed to parse test output: {str(e)}",
            'result': {}
        }
    except Exception as e:
        return {
            'test_type': test_type,
            'domain': domain,
            'error': True,
            'message': f"Test execution failed: {str(e)}",
            'result': {}
        }


def run_all_tests(domain: str) -> Dict[str, Any]:
    """Run all tests for the domain"""
    test_types = ['dmarc', 'spf', 'dkim', 'mail_echo']
    results = {}
    
    start_time = time.time()
    
    for test_type in test_types:
        print(f"Running {test_type} test for {domain}...", file=sys.stderr)
        results[test_type] = run_single_test(test_type, domain)
    
    execution_time = time.time() - start_time
    
    # Calculate overall score
    total_score = 0
    valid_tests = 0
    
    for test_type, result in results.items():
        if not result.get('error', False) and 'score' in result:
            total_score += result['score']
            valid_tests += 1
    
    overall_score = total_score / valid_tests if valid_tests > 0 else 0
    
    return {
        'domain': domain,
        'execution_time': round(execution_time, 2),
        'overall_score': round(overall_score, 1),
        'tests': results,
        'summary': {
            'total_tests': len(test_types),
            'successful_tests': valid_tests,
            'failed_tests': len(test_types) - valid_tests
        }
    }


def main():
    """Main function"""
    if len(sys.argv) < 2:
        handle_error("Usage: python test_runner.py <domain> [test_type]")
    
    domain = sys.argv[1].strip().lower()
    
    if not validate_domain(domain):
        handle_error(f"Invalid domain format: {domain}")
    
    # Check if specific test type is requested
    if len(sys.argv) == 3:
        test_type = sys.argv[2].strip().lower()
        result = run_single_test(test_type, domain)
        output_result(result)
    else:
        # Run all tests
        result = run_all_tests(domain)
        output_result(result)


if __name__ == "__main__":
    main()