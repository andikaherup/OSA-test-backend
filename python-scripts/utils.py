import json
import sys
import dns.resolver
import re
from typing import Dict, Any

def output_result(result: Dict[str, Any]) -> None:
    """Output test result as JSON to stdout"""
    try:
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:
        error_result = {
            "error": True,
            "message": f"Failed to serialize result: {str(e)}",
            "result": {}
        }
        print(json.dumps(error_result))

def handle_error(error_message: str, domain: str = "") -> None:
    """Handle and output error in standard format"""
    error_result = {
        "error": True,
        "message": error_message,
        "domain": domain,
        "result": {}
    }
    output_result(error_result)
    sys.exit(1)

def validate_domain(domain: str) -> bool:
    """Validate domain name format"""
    if not domain or len(domain) > 253:
        return False
    
    # Basic domain regex
    domain_pattern = re.compile(
        r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?'
        r'(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
    )
    
    return bool(domain_pattern.match(domain))

def parse_spf_record(spf_record: str) -> Dict[str, Any]:
    """Parse SPF record and extract mechanisms"""
    mechanisms = []
    includes = []
    all_mechanism = None
    
    # Split SPF record into parts
    parts = spf_record.split()
    
    for part in parts:
        part = part.strip()
        
        if part.startswith('v=spf1'):
            continue
        elif part.startswith('include:'):
            includes.append(part[8:])
            mechanisms.append(part)
        elif part.startswith(('a', 'mx', 'ip4:', 'ip6:', 'exists:')):
            mechanisms.append(part)
        elif part in ['-all', '~all', '+all', '?all']:
            all_mechanism = part
            mechanisms.append(part)
        else:
            mechanisms.append(part)
    
    return {
        'mechanisms': mechanisms,
        'includes': includes,
        'all_mechanism': all_mechanism,
        'includes_all': all_mechanism is not None
    }


def dns_lookup(domain, record_type):
    try:
        answers = dns.resolver.resolve(domain, record_type)
        return [str(answer).strip('"') for answer in answers]
    except:
        return []

def get_domain_from_args():
    if len(sys.argv) != 2:
        handle_error("Usage: python script.py <domain>")
    return sys.argv[1].strip().lower()