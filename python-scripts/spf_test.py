#!/usr/bin/env python3
from utils import get_domain_from_args, dns_lookup, output_result, handle_error

def test_spf(domain):
    result = {
        'domain': domain,
        'record_found': False,
        'record': None,
        'score': 0
    }
    
    try:
        txt_records = dns_lookup(domain, 'TXT')
        
        for record in txt_records:
            if record.startswith('v=spf1'):
                result['record_found'] = True
                result['record'] = record
                result['score'] = 70
                break
        
        return result
        
    except Exception as e:
        handle_error(f"SPF test failed: {str(e)}", domain)

def main():
    domain = get_domain_from_args()
    result = test_spf(domain)
    output_result(result)

if __name__ == "__main__":
    main()