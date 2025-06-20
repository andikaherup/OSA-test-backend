import json
import sys
import dns.resolver
import re
from typing import Dict, List, Any

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


def _assign_dmarc_tag(policy_data: Dict[str, Any], tag: str, value: str) -> None:
    if tag == 'v':
        policy_data['version'] = value
    elif tag == 'p':
        policy_data['policy'] = value
    elif tag == 'sp':
        policy_data['subdomain_policy'] = value
    elif tag == 'pct':
        try:
            policy_data['percentage'] = int(value)
        except ValueError:
            pass
    elif tag == 'rua':
        policy_data['rua'] = [uri.strip() for uri in value.split(',')]
    elif tag == 'ruf':
        policy_data['ruf'] = [uri.strip() for uri in value.split(',')]
    elif tag == 'fo':
        policy_data['forensic_options'] = value
    elif tag == 'aspf':
        policy_data['alignment_spf'] = value
    elif tag == 'adkim':
        policy_data['alignment_dkim'] = value
    elif tag == 'ri':
        try:
            policy_data['report_interval'] = int(value)
        except ValueError:
            pass

def parse_dmarc_record(dmarc_record: str) -> Dict[str, Any]:
    """Parse DMARC record and extract policy information"""
    policy_data = {
        'version': None,
        'policy': None,
        'subdomain_policy': None,
        'percentage': 100,
        'rua': [],
        'ruf': [],
        'forensic_options': None,
        'alignment_spf': 'r',
        'alignment_dkim': 'r',
        'report_interval': 86400
    }

    # Split DMARC record into tag-value pairs
    pairs = dmarc_record.split(';')

    for pair in pairs:
        pair = pair.strip()
        if '=' not in pair:
            continue

        tag, value = pair.split('=', 1)
        tag = tag.strip().lower()
        value = value.strip()
        _assign_dmarc_tag(policy_data, tag, value)

    return policy_data

def get_mx_records(domain: str) -> List[Dict[str, Any]]:
    """Get MX records for domain"""
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 10
        
        mx_records = []
        answers = resolver.resolve(domain, 'MX')
        
        for mx in answers:
            mx_records.append({
                'priority': mx.preference,
                'exchange': str(mx.exchange).rstrip('.'),
            })
            
        # Sort by priority
        mx_records.sort(key=lambda x: x['priority'])
        return mx_records
        
    except dns.resolver.NXDOMAIN:
        return []
    except dns.resolver.NoAnswer:
        return []
    except Exception as e:
        raise Exception(f"Failed to get MX records for {domain}: {str(e)}")



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