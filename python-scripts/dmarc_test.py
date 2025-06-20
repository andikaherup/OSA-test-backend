#!/usr/bin/env python3
from utils import get_domain_from_args, dns_lookup, output_result, handle_error

def test_dmarc(domain):
    result = {
        'domain': domain,
        'record_found': False,
        'record': None,
        'policy': None,
        'score': 0
    }
    
    try:
        dmarc_domain = f"_dmarc.{domain}"
        dmarc_records = dns_lookup(dmarc_domain, 'TXT')
        
        for record in dmarc_records:
            if record.startswith('v=DMARC1'):
                result['record_found'] = True
                result['record'] = record
                result['score'] = 50
                
                # Basic policy extraction
                if 'p=reject' in record:
                    result['policy'] = 'reject'
                    result['score'] = 90
                elif 'p=quarantine' in record:
                    result['policy'] = 'quarantine'
                    result['score'] = 70
                elif 'p=none' in record:
                    result['policy'] = 'none'
                    result['score'] = 50
                break
        
        return result
        
    except Exception as e:
        handle_error(f"DMARC test failed: {str(e)}", domain)

def main():
    domain = get_domain_from_args()
    result = test_dmarc(domain)
    output_result(result)

if __name__ == "__main__":
    main()