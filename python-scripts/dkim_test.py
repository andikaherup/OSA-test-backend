#!/usr/bin/env python3
from utils import get_domain_from_args, dns_lookup, output_result, handle_error
import base64
import re

def test_dkim(domain):
    result = init_dkim_result(domain)
    common_selectors = [
        'default', 'selector1', 'selector2', 'google', 'gmail',
        'mail', 'email', 'dkim', 'k1', 's1', 's2', 'mxvault',
        'mailo', 'mailgun', 'sendgrid', 'mandrill', 'amazonses'
    ]
    try:
        valid_count = process_selectors(domain, common_selectors, result)
        apply_scoring_and_recommendations(result, valid_count)
        return result
    except Exception as e:
        handle_error(f"DKIM test failed: {str(e)}", domain)

def init_dkim_result(domain):
    return {
        'domain': domain,
        'selectors_found': [],
        'selectors_tested': [],
        'valid_selectors': [],
        'invalid_selectors': [],
        'public_keys': {},
        'key_algorithms': {},
        'key_sizes': {},
        'issues': [],
        'recommendations': [],
        'score': 0
    }

def process_selectors(domain, selectors, result):
    valid_count = 0
    for selector in selectors:
        try:
            dkim_domain = f"{selector}._domainkey.{domain}"
            result['selectors_tested'].append(selector)
            dkim_records = dns_lookup(dkim_domain, 'TXT')
            if not dkim_records:
                continue
            dkim_record = ''.join(dkim_records)
            if not dkim_record or 'p=' not in dkim_record:
                continue
            result['selectors_found'].append(selector)
            parsed = parse_dkim_record(dkim_record)
            if parsed['public_key']:
                result['public_keys'][selector] = parsed['public_key'][:50] + '...'
                result['key_algorithms'][selector] = parsed.get('algorithm', 'rsa')
                if validate_dkim_key(parsed['public_key']):
                    result['valid_selectors'].append(selector)
                    valid_count += 1
                    handle_key_size_and_score(selector, parsed, result)
                else:
                    result['invalid_selectors'].append(selector)
                    result['issues'].append(f'Invalid public key for selector: {selector}')
        except Exception:
            continue
    return valid_count

def handle_key_size_and_score(selector, parsed, result):
    if parsed.get('algorithm', 'rsa') == 'rsa':
        key_size = get_rsa_key_size(parsed['public_key'])
        result['key_sizes'][selector] = key_size
        if key_size >= 2048:
            result['score'] += 10
        elif key_size >= 1024:
            result['score'] += 5
            result['recommendations'].append(f'Consider upgrading {selector} key to 2048+ bits')
        else:
            result['issues'].append(f'Weak key size for {selector}: {key_size} bits')

def apply_scoring_and_recommendations(result, valid_count):
    if valid_count == 0:
        result['issues'].append('No valid DKIM selectors found')
        result['recommendations'].extend([
            'Implement DKIM signing for outbound emails',
            'Configure DKIM records with appropriate selectors',
            'Use at least 2048-bit RSA keys for security',
            'Test common selectors: default, google, mail'
        ])
    else:
        result['score'] += 50 + (valid_count * 10)
        if valid_count == 1:
            result['recommendations'].append('Consider implementing multiple DKIM selectors for redundancy')
        if 'google' in result['valid_selectors'] or 'gmail' in result['valid_selectors']:
            result['score'] += 5
        if valid_count >= 2:
            result['score'] += 10
            result['recommendations'].append('Good: Multiple selectors configured for key rotation')


def parse_dkim_record(dkim_record):
    """Parse DKIM record and extract components"""
    parsed = {
        'version': None,
        'algorithm': 'rsa',
        'public_key': None,
        'key_type': 'rsa',
        'hash_algorithms': ['sha256'],
        'service_type': ['email'],
        'flags': []
    }
    
    # Remove spaces and split into tag-value pairs
    pairs = dkim_record.replace(' ', '').split(';')
    
    for pair in pairs:
        if '=' not in pair:
            continue
            
        tag, value = pair.split('=', 1)
        tag = tag.strip().lower()
        value = value.strip()
        
        if tag == 'v':
            parsed['version'] = value
        elif tag == 'k':
            parsed['key_type'] = value
            parsed['algorithm'] = value
        elif tag == 'p':
            parsed['public_key'] = value
        elif tag == 'h':
            parsed['hash_algorithms'] = value.split(':')
        elif tag == 's':
            parsed['service_type'] = value.split(':')
        elif tag == 't':
            parsed['flags'] = value.split(':')
    
    return parsed


def validate_dkim_key(public_key_b64):
    """Validate DKIM public key format"""
    try:
        if not public_key_b64:
            return False
        
        # Remove whitespace and decode base64
        public_key_b64 = re.sub(r'\s+', '', public_key_b64)
        public_key_der = base64.b64decode(public_key_b64)
        
        # Basic validation - if it decodes and has reasonable size
        if len(public_key_der) < 50:  # Too small to be a valid key
            return False
            
        return True
        
    except Exception:
        return False


def get_rsa_key_size(public_key_b64):
    """Estimate RSA key size (simplified version)"""
    try:
        public_key_b64 = re.sub(r'\s+', '', public_key_b64)
        public_key_der = base64.b64decode(public_key_b64)
        
        # Rough estimation based on DER size
        der_size = len(public_key_der)
        if der_size > 400:
            return 4096
        elif der_size > 250:
            return 2048
        elif der_size > 150:
            return 1024
        else:
            return 512
            
    except Exception:
        return 0


def main():
    domain = get_domain_from_args()
    result = test_dkim(domain)
    output_result(result)


if __name__ == "__main__":
    main()