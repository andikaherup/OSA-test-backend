import json
import sys
import dns.resolver
import re

def output_result(result):
    print(json.dumps(result))

def handle_error(error_message, domain=""):
    error_result = {
        "error": True,
        "message": error_message,
        "domain": domain
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