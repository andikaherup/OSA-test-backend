#!/usr/bin/env python3
from utils import get_domain_from_args, dns_lookup, output_result, handle_error

def test_dkim(domain):
    result = {
        'domain': domain,
        'selectors_found': [],
        'selectors_tested': [],
        'valid_selectors': [],
        'score': 0
    }
    
    # Common DKIM selectors to test
    common_selectors = ['default', 'selector1', 'selector2', 'google', 'mail', 'k1']
    
    try:
        for selector in common_selectors:
            dkim_domain = f"{selector}._domainkey.{domain}"
            result['selectors_tested'].append(selector)
            
            dkim_records = dns_lookup(dkim_domain, 'TXT')
            
            if dkim_records:
                dkim_record = ''.join(dkim_records)
                if 'p=' in dkim_record:
                    result['selectors_found'].append(selector)
                    result['valid_selectors'].append(selector)
        
        # Basic scoring
        if result['valid_selectors']:
            result['score'] = 60 + (len(result['valid_selectors']) * 10)
        
        return result
        
    except Exception as e:
        handle_error(f"DKIM test failed: {str(e)}", domain)

def main():
    domain = get_domain_from_args()
    result = test_dkim(domain)
    output_result(result)

if __name__ == "__main__":
    main()