#!/usr/bin/env python3
"""
Mail Server Echo Test
Tests mail server connectivity, SMTP capabilities, and security features
"""
import sys
import socket
import ssl
import smtplib
from email.mime.text import MIMEText
from utils import (
    get_domain_from_args, get_mx_records, output_result, handle_error
)


def test_mail_echo(domain: str) -> dict:
    """
    Test mail server connectivity and capabilities
    
    Args:
        domain: Domain to test
        
    Returns:
        Dictionary containing test results
    """
    result = {
        'domain': domain,
        'mx_records': [],
        'smtp_connection_successful': False,
        'supports_tls': False,
        'supports_starttls': False,
        'smtp_banner': None,
        'supported_extensions': [],
        'connection_details': {},
        'security_features': {},
        'issues': [],
        'recommendations': [],
        'score': 0
    }
    
    try:
        # Get MX records
        mx_records = get_mx_records(domain)
        result['mx_records'] = mx_records
        
        if not mx_records:
            result['issues'].append('No MX records found')
            result['recommendations'].extend([
                'Configure MX records to enable mail delivery',
                'Ensure MX records point to valid mail servers',
                'Consider using multiple MX records for redundancy'
            ])
            return result
        
        result['score'] += 20
        
        if len(mx_records) > 1:
            result['score'] += 10
            result['recommendations'].append('Good: Multiple MX records configured for redundancy')
        
        # Test connection to primary MX server
        primary_mx = mx_records[0]['exchange']
        
        connection_result = test_smtp_connection(primary_mx, 25)
        result.update(connection_result)
        
        if result['smtp_connection_successful']:
            result['score'] += 30
            
            # Test TLS capabilities
            tls_result = test_tls_capabilities(primary_mx)
            result.update(tls_result)
            
            if result['supports_tls']:
                result['score'] += 20
            elif result['supports_starttls']:
                result['score'] += 15
                result['recommendations'].append('Consider enabling implicit TLS on port 465')
            else:
                result['issues'].append('No TLS support detected')
                result['recommendations'].append('Enable TLS/STARTTLS for secure mail transmission')
            
            # Test additional security features
            security_result = test_security_features(primary_mx)
            result['security_features'].update(security_result)
            
            # Scoring for security features
            if security_result.get('supports_auth', False):
                result['score'] += 5
            
            if security_result.get('supports_submission', False):
                result['score'] += 5
            
        else:
            result['issues'].append(f'Cannot connect to primary MX server: {primary_mx}')
            result['recommendations'].extend([
                'Verify mail server is running and accessible',
                'Check firewall rules for SMTP ports (25, 587, 465)',
                'Ensure DNS resolution is working correctly'
            ])
        
        return result
        
    except Exception as e:
        handle_error(f"Mail echo test failed: {str(e)}", domain)


def test_smtp_connection(server: str, port: int = 25, timeout: int = 10) -> dict:
    """Test SMTP connection to server"""
    result = {
        'smtp_connection_successful': False,
        'smtp_banner': None,
        'supported_extensions': [],
        'connection_details': {
            'server': server,
            'port': port,
            'timeout': timeout
        }
    }
    
    try:
        # Create SMTP connection
        smtp = smtplib.SMTP(timeout=timeout)
        smtp.connect(server, port)
        
        result['smtp_connection_successful'] = True
        result['smtp_banner'] = smtp.getwelcome()
        
        # Get EHLO response for extensions
        ehlo_response = smtp.ehlo()
        if ehlo_response[0] == 250:
            result['supported_extensions'] = list(smtp.esmtp_features.keys())
        
        smtp.quit()
        
    except socket.timeout:
        result['connection_details']['error'] = 'Connection timeout'
    except socket.gaierror as e:
        result['connection_details']['error'] = f'DNS resolution failed: {str(e)}'
    except ConnectionRefusedError:
        result['connection_details']['error'] = 'Connection refused'
    except Exception as e:
        result['connection_details']['error'] = f'Connection failed: {str(e)}'
    
    return result


def test_tls_capabilities(server: str) -> dict:
    """Test TLS capabilities of mail server"""
    result = {
        'supports_tls': False,
        'supports_starttls': False,
        'tls_versions': [],
        'cipher_suites': []
    }
    
    # Test STARTTLS on port 25
    try:
        smtp = smtplib.SMTP(server, 25, timeout=10)
        smtp.ehlo()
        
        if smtp.has_extn('STARTTLS'):
            result['supports_starttls'] = True
            try:
                smtp.starttls()
                result['supports_tls'] = True
                
                # Get TLS info if available
                if hasattr(smtp.sock, 'version'):
                    result['tls_versions'].append(smtp.sock.version())
                
            except Exception:
                pass
        
        smtp.quit()
        
    except Exception:
        pass
    
    # Test implicit TLS on port 465
    try:
        smtp = smtplib.SMTP_SSL(server, 465, timeout=10)
        smtp.ehlo()
        result['supports_tls'] = True
        
        # Get TLS info
        if hasattr(smtp.sock, 'version'):
            tls_version = smtp.sock.version()
            if tls_version not in result['tls_versions']:
                result['tls_versions'].append(tls_version)
        
        smtp.quit()
        
    except Exception:
        pass
    
    # Test submission port 587
    try:
        smtp = smtplib.SMTP(server, 587, timeout=10)
        smtp.ehlo()
        
        if smtp.has_extn('STARTTLS'):
            smtp.starttls()
            if not result['supports_tls']:
                result['supports_tls'] = True
        
        smtp.quit()
        
    except Exception:
        pass
    
    return result


def test_security_features(server: str) -> dict:
    """Test additional security features"""
    result = {
        'supports_auth': False,
        'supports_submission': False,
        'auth_methods': [],
        'submission_port_open': False
    }
    
    # Test authentication support
    try:
        smtp = smtplib.SMTP(server, 25, timeout=10)
        smtp.ehlo()
        
        if smtp.has_extn('AUTH'):
            result['supports_auth'] = True
            auth_methods = smtp.esmtp_features.get('auth', '').split()
            result['auth_methods'] = auth_methods
        
        smtp.quit()
        
    except Exception:
        pass
    
    # Test submission port (587)
    try:
        smtp = smtplib.SMTP(server, 587, timeout=5)
        smtp.ehlo()
        result['submission_port_open'] = True
        result['supports_submission'] = True
        smtp.quit()
        
    except Exception:
        pass
    
    return result


def main():
    """Main function"""
    domain = get_domain_from_args()
    result = test_mail_echo(domain)
    output_result(result)


if __name__ == "__main__":
    main()