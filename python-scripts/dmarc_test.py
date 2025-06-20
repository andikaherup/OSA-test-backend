#!/usr/bin/env python3
"""
DMARC (Domain-based Message Authentication, Reporting, and Conformance) Test
Tests for DMARC policy presence and configuration
"""
import sys
from utils import (
    get_domain_from_args, dns_lookup, parse_dmarc_record, 
    output_result, handle_error
)


def get_dmarc_record(domain: str):
    """Retrieve the DMARC record for a domain."""
    dmarc_domain = f"_dmarc.{domain}"
    dmarc_records = dns_lookup(dmarc_domain, 'TXT')
    for record in dmarc_records:
        if record.startswith('v=DMARC1'):
            return record
    return None

def handle_no_dmarc_record(result, domain):
    """Handle the case where no DMARC record is found."""
    result['issues'].append('No DMARC record found')
    result['recommendations'].extend([
        f'Create a DMARC record at _dmarc.{domain}',
        'Start with a policy of "none" for monitoring',
        'Configure reporting addresses (rua/ruf)',
        'Gradually move to "quarantine" then "reject" policy'
    ])
    return result

def validate_version(parsed, result):
    if parsed['version'] != 'DMARC1':
        result['issues'].append(f"Invalid DMARC version: {parsed['version']}")
    else:
        result['score'] += 20

def score_policy(parsed, result):
    result['policy'] = parsed['policy']
    if not parsed['policy']:
        result['issues'].append('Missing policy (p) tag')
    elif parsed['policy'] == 'none':
        result['score'] += 10
        result['recommendations'].append('Consider upgrading policy to "quarantine" or "reject"')
    elif parsed['policy'] == 'quarantine':
        result['score'] += 25
        result['recommendations'].append('Consider upgrading policy to "reject" for maximum protection')
    elif parsed['policy'] == 'reject':
        result['score'] += 40
    else:
        result['issues'].append(f"Invalid policy value: {parsed['policy']}")

def score_subdomain_policy(parsed, result):
    result['subdomain_policy'] = parsed['subdomain_policy']
    if parsed['subdomain_policy']:
        result['score'] += 5

def score_percentage(parsed, result):
    result['percentage'] = parsed['percentage']
    if parsed['percentage'] == 100:
        result['score'] += 15
    elif parsed['percentage'] > 0:
        result['score'] += 10
        result['recommendations'].append('Consider increasing percentage to 100% for full coverage')
    else:
        result['issues'].append('Percentage set to 0%')

def check_reporting_addresses(parsed, result):
    result['rua_addresses'] = parsed['rua']
    result['ruf_addresses'] = parsed['ruf']

    if parsed['rua']:
        result['score'] += 10
    else:
        result['recommendations'].append('Add aggregate reporting address (rua)')

    if parsed['ruf']:
        result['score'] += 5
    else:
        result['recommendations'].append('Consider adding forensic reporting address (ruf)')

def check_alignment(parsed, result):
    result['alignment_spf'] = parsed['alignment_spf']
    result['alignment_dkim'] = parsed['alignment_dkim']

    if parsed['alignment_spf'] == 's':
        result['score'] += 5
    if parsed['alignment_dkim'] == 's':
        result['score'] += 5

def validate_overall(parsed, result):
    if (parsed['version'] == 'DMARC1' and 
        parsed['policy'] in ['none', 'quarantine', 'reject'] and
        parsed['percentage'] > 0):
        result['valid'] = True

def add_policy_recommendations(parsed, result):
    if parsed['policy'] in ['quarantine', 'reject'] and not parsed['rua']:
        result['recommendations'].append('Reporting addresses are crucial for quarantine/reject policies')

def score_dmarc(parsed, result):
    """Score and validate the DMARC record."""
    validate_version(parsed, result)
    score_policy(parsed, result)
    score_subdomain_policy(parsed, result)
    score_percentage(parsed, result)
    check_reporting_addresses(parsed, result)
    check_alignment(parsed, result)
    validate_overall(parsed, result)
    add_policy_recommendations(parsed, result)
    return result

def test_dmarc(domain: str) -> dict:
    """
    Test DMARC configuration for the domain

    Args:
        domain: Domain to test

    Returns:
        Dictionary containing test results
    """
    result = {
        'domain': domain,
        'record_found': False,
        'record': None,
        'policy': None,
        'subdomain_policy': None,
        'percentage': 0,
        'rua_addresses': [],
        'ruf_addresses': [],
        'alignment_spf': None,
        'alignment_dkim': None,
        'valid': False,
        'issues': [],
        'recommendations': [],
        'score': 0
    }

    try:
        dmarc_record = get_dmarc_record(domain)
        if not dmarc_record:
            return handle_no_dmarc_record(result, domain)

        result['record_found'] = True
        result['record'] = dmarc_record

        parsed = parse_dmarc_record(dmarc_record)
        result = score_dmarc(parsed, result)

        return result

    except Exception as e:
        handle_error(f"DMARC test failed: {str(e)}", domain)


def main():
    """Main function"""
    domain = get_domain_from_args()
    result = test_dmarc(domain)
    output_result(result)


if __name__ == "__main__":
    main()