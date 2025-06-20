import json
import sys
import dns.resolver

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