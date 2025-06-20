#!/usr/bin/env python3
"""
SPF (Sender Policy Framework) Test
Tests for SPF record presence and configuration
"""
import sys
from utils import (
    get_domain_from_args, dns_lookup, parse_spf_record, 
    output_result, handle_error
)


def get_spf_record(txt_records):
    spf_record = None
    spf_count = 0
    for record in txt_records:
        if record.startswith('v=spf1'):
            spf_record = record
            spf_count += 1
    return spf_record, spf_count

def check_spf_record_presence(result, spf_record, spf_count):
    if spf_count > 1:
        result['issues'].append('Multiple SPF records found (RFC violation)')
        result['recommendations'].append('Consolidate into a single SPF record')
    if not spf_record:
        result['issues'].append('No SPF record found')
        result['recommendations'].extend([
            'Create an SPF record to specify authorized mail servers',
            'Start with "v=spf1 include:_spf.google.com ~all" if using Google Workspace',
            'Use "v=spf1 mx ~all" if mail is sent from MX servers only',
            'Always end with an "all" mechanism'
        ])
        return False
    result['record_found'] = True
    result['record'] = spf_record
    result['score'] += 30
    return True

def score_all_mechanism(result, parsed):
    if not parsed['includes_all']:
        result['issues'].append('No "all" mechanism found')
        result['recommendations'].append('Add an "all" mechanism (e.g., "-all", "~all")')
    else:
        if parsed['all_mechanism'] == '-all':
            result['score'] += 40
        elif parsed['all_mechanism'] == '~all':
            result['score'] += 25
            result['recommendations'].append('Consider upgrading to "-all" for stricter policy')
        elif parsed['all_mechanism'] == '+all':
            result['score'] += 5
            result['issues'].append('"+all" allows any server to send mail')
            result['recommendations'].append('Change "+all" to "~all" or "-all"')
        elif parsed['all_mechanism'] == '?all':
            result['score'] += 10
            result['recommendations'].append('Consider changing "?all" to "~all" or "-all"')

def count_dns_lookups(mechanisms):
    count = 0
    for mechanism in mechanisms:
        if (mechanism.startswith('include:') or 
            mechanism.startswith('a') or 
            mechanism.startswith('mx') or 
            mechanism.startswith('exists:')):
            count += 1
    return count

def check_dns_lookup_limit(result, dns_lookup_count):
    if dns_lookup_count > 10:
        result['issues'].append(f'Too many DNS lookups ({dns_lookup_count}/10 limit)')
        result['recommendations'].append('Reduce DNS lookups to stay under RFC limit')
    elif dns_lookup_count > 8:
        result['recommendations'].append('Close to DNS lookup limit, consider optimization')
    else:
        result['score'] += 10

def score_mechanisms(result, parsed):
    has_mx = any(m.startswith('mx') for m in parsed['mechanisms'])
    has_include = len(parsed['includes']) > 0
    if has_mx:
        result['score'] += 5
    if has_include:
        result['score'] += 10

def score_trusted_includes(result, includes):
    trusted_includes = [
        '_spf.google.com',
        'spf.protection.outlook.com',
        'include.mailgun.org',
        'servers.mcsv.net',  # MailChimp
        '_spf.salesforce.com'
    ]
    for include in includes:
        if include in trusted_includes:
            result['score'] += 5
            break

def check_record_length(result, spf_record):
    if len(spf_record) > 255:
        result['issues'].append('SPF record exceeds 255 character limit')

def check_deprecated_mechanisms(result, mechanisms):
    deprecated_mechanisms = ['ptr']
    for mechanism in mechanisms:
        if any(mechanism.startswith(dep) for dep in deprecated_mechanisms):
            result['issues'].append(f'Deprecated mechanism found: {mechanism}')
            result['recommendations'].append('Remove deprecated "ptr" mechanism')

def validate_overall(result, spf_record, parsed, dns_lookup_count):
    if (spf_record.startswith('v=spf1') and 
        parsed['includes_all'] and
        dns_lookup_count <= 10):
        result['valid'] = True

def test_spf(domain: str) -> dict:
    """
    Test SPF configuration for the domain

    Args:
        domain: Domain to test

    Returns:
        Dictionary containing test results
    """
    result = {
        'domain': domain,
        'record_found': False,
        'record': None,
        'mechanisms': [],
        'includes': [],
        'all_mechanism': None,
        'includes_all': False,
        'valid': False,
        'issues': [],
        'recommendations': [],
        'score': 0,
        'dns_lookups': 0
    }

    try:
        txt_records = dns_lookup(domain, 'TXT')
        spf_record, spf_count = get_spf_record(txt_records)
        if not check_spf_record_presence(result, spf_record, spf_count):
            return result

        parsed = parse_spf_record(spf_record)
        result['mechanisms'] = parsed['mechanisms']
        result['includes'] = parsed['includes']
        result['all_mechanism'] = parsed['all_mechanism']
        result['includes_all'] = parsed['includes_all']

        score_all_mechanism(result, parsed)
        dns_lookup_count = count_dns_lookups(parsed['mechanisms'])
        result['dns_lookups'] = dns_lookup_count
        check_dns_lookup_limit(result, dns_lookup_count)
        score_mechanisms(result, parsed)
        score_trusted_includes(result, parsed['includes'])
        check_record_length(result, spf_record)
        check_deprecated_mechanisms(result, parsed['mechanisms'])
        validate_overall(result, spf_record, parsed, dns_lookup_count)

        return result

    except Exception as e:
        handle_error(f"SPF test failed: {str(e)}", domain)


def main():
    """Main function"""
    domain = get_domain_from_args()
    result = test_spf(domain)
    output_result(result)


if __name__ == "__main__":
    main()