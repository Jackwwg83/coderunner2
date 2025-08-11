#!/bin/bash

# CodeRunner v2.0 - SSL Certificate Setup Script
# Sets up SSL certificates for production deployment

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN=${1:-localhost}
SSL_DIR="./ssl"
CERT_FILE="$SSL_DIR/coderunner.crt"
KEY_FILE="$SSL_DIR/coderunner.key"

echo -e "${GREEN}🔒 CodeRunner SSL Certificate Setup${NC}"
echo "======================================="
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"

# Create SSL directory
mkdir -p $SSL_DIR

# Function to generate self-signed certificate
generate_self_signed() {
    echo -e "${YELLOW}📝 Generating self-signed certificate for ${DOMAIN}...${NC}"
    
    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout $KEY_FILE \
        -out $CERT_FILE \
        -subj "/C=US/ST=CA/L=San Francisco/O=CodeRunner/OU=IT/CN=${DOMAIN}/emailAddress=admin@${DOMAIN}" \
        -addext "subjectAltName=DNS:${DOMAIN},DNS:www.${DOMAIN},DNS:localhost,IP:127.0.0.1"
    
    echo -e "${GREEN}✅ Self-signed certificate generated${NC}"
    echo -e "${RED}⚠️  WARNING: Self-signed certificates are not suitable for production!${NC}"
    echo -e "${YELLOW}   For production, use Let's Encrypt or purchase a certificate from a CA${NC}"
}

# Function to setup Let's Encrypt certificate
setup_letsencrypt() {
    echo -e "${YELLOW}🔐 Setting up Let's Encrypt certificate for ${DOMAIN}...${NC}"
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${RED}❌ Certbot is not installed${NC}"
        echo "Install with: sudo apt-get install certbot python3-certbot-nginx"
        return 1
    fi
    
    # Generate certificate
    sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos \
        --email admin@$DOMAIN --http-01-port 80
    
    # Copy certificates to our SSL directory
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERT_FILE
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $KEY_FILE
    sudo chown $(whoami):$(whoami) $CERT_FILE $KEY_FILE
    
    echo -e "${GREEN}✅ Let's Encrypt certificate installed${NC}"
    
    # Setup auto-renewal
    setup_auto_renewal
}

# Function to setup certificate auto-renewal
setup_auto_renewal() {
    echo -e "${YELLOW}🔄 Setting up certificate auto-renewal...${NC}"
    
    # Create renewal script
    cat > scripts/renew-cert.sh << 'EOF'
#!/bin/bash
# Auto-renewal script for Let's Encrypt certificates

set -e

DOMAIN=$1
SSL_DIR="./ssl"
CERT_FILE="$SSL_DIR/coderunner.crt"
KEY_FILE="$SSL_DIR/coderunner.key"

# Renew certificate
sudo certbot renew --quiet

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERT_FILE
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $KEY_FILE
sudo chown $(whoami):$(whoami) $CERT_FILE $KEY_FILE

# Restart nginx to use new certificates
docker-compose -f docker-compose.prod.yml restart nginx

echo "Certificate renewed successfully"
EOF
    
    chmod +x scripts/renew-cert.sh
    
    # Add to crontab (check twice daily)
    (crontab -l 2>/dev/null; echo "0 */12 * * * $PWD/scripts/renew-cert.sh $DOMAIN") | crontab -
    
    echo -e "${GREEN}✅ Auto-renewal configured (runs twice daily)${NC}"
}

# Function to validate certificates
validate_certificates() {
    echo -e "${YELLOW}🔍 Validating certificates...${NC}"
    
    if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
        echo -e "${RED}❌ Certificate files not found${NC}"
        return 1
    fi
    
    # Check certificate validity
    if openssl x509 -in $CERT_FILE -text -noout > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Certificate file is valid${NC}"
        
        # Show certificate details
        echo -e "\n${BLUE}📋 Certificate Details:${NC}"
        openssl x509 -in $CERT_FILE -text -noout | grep -A 2 "Subject:"
        openssl x509 -in $CERT_FILE -text -noout | grep -A 2 "Not After"
        
        # Show SAN (Subject Alternative Names)
        echo -e "\n${BLUE}📋 Subject Alternative Names:${NC}"
        openssl x509 -in $CERT_FILE -text -noout | grep -A 1 "Subject Alternative Name" || echo "None found"
    else
        echo -e "${RED}❌ Certificate file is invalid${NC}"
        return 1
    fi
    
    # Check private key
    if openssl rsa -in $KEY_FILE -check > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Private key is valid${NC}"
    else
        echo -e "${RED}❌ Private key is invalid${NC}"
        return 1
    fi
    
    # Verify certificate and key match
    cert_hash=$(openssl x509 -in $CERT_FILE -pubkey -noout -outform pem | sha256sum)
    key_hash=$(openssl pkey -in $KEY_FILE -pubout -outform pem | sha256sum)
    
    if [ "$cert_hash" = "$key_hash" ]; then
        echo -e "${GREEN}✅ Certificate and private key match${NC}"
    else
        echo -e "${RED}❌ Certificate and private key do not match${NC}"
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [domain] [options]"
    echo ""
    echo "Options:"
    echo "  --self-signed    Generate self-signed certificate (default)"
    echo "  --letsencrypt    Use Let's Encrypt for certificate"
    echo "  --validate       Validate existing certificates"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 myapp.com --letsencrypt"
    echo "  $0 localhost --self-signed"
    echo "  $0 --validate"
}

# Parse command line arguments
case "${2:-self-signed}" in
    --self-signed|self-signed)
        generate_self_signed
        validate_certificates
        ;;
    --letsencrypt|letsencrypt)
        if [ "$DOMAIN" = "localhost" ]; then
            echo -e "${RED}❌ Cannot use Let's Encrypt with localhost${NC}"
            echo "Use --self-signed for localhost or specify a real domain"
            exit 1
        fi
        setup_letsencrypt
        validate_certificates
        ;;
    --validate|validate)
        validate_certificates
        ;;
    --help|help)
        show_usage
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Unknown option: ${2}${NC}"
        show_usage
        exit 1
        ;;
esac

# Set proper permissions
chmod 600 $KEY_FILE
chmod 644 $CERT_FILE

echo -e "\n${GREEN}📋 SSL Setup Complete!${NC}"
echo "================================"
echo -e "${YELLOW}Certificate:${NC} $CERT_FILE"
echo -e "${YELLOW}Private Key:${NC} $KEY_FILE"
echo -e "${YELLOW}Domain:${NC}      $DOMAIN"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Update your .env.production file with correct SSL paths"
echo "2. Ensure your domain points to this server's IP"
echo "3. Start the production deployment with: ./scripts/deploy-prod.sh"
echo ""

if [ "${2}" = "--self-signed" ] || [ "${2}" = "self-signed" ] || [ -z "${2}" ]; then
    echo -e "${RED}⚠️  Self-signed Certificate Warning:${NC}"
    echo "   - Browsers will show security warnings"
    echo "   - Not suitable for production environments"
    echo "   - Consider using Let's Encrypt for production"
fi