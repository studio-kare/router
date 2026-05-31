# Kamal Deployment Guide for Farmer Router

## Prerequisites

### 1. Install Kamal (on your local machine)
```bash
gem install kamal
```

### 2. Server Setup (Linux, e.g., Ubuntu 22.04)
```bash
# SSH into your server
ssh root@1.2.3.4

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional)
sudo usermod -aG docker $USER

# Create app directory
mkdir -p /root/farmer
```

### 3. Docker Registry
- **Option A (Free):** Use Docker Hub
  - Create account at hub.docker.com
  - Create public repo: `yourusername/farmer`
  - Get credentials for `config/deploy.yml`

- **Option B (Private):** Use GitHub Container Registry (ghcr.io)
  - Create GitHub Personal Access Token (PAT) with `write:packages` scope
  - Use `ghcr.io/yourusername/farmer` as image

### 4. SSH Key Setup
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@1.2.3.4

# Verify SSH access
ssh root@1.2.3.4 "docker --version"
```

## Configuration

### 1. Update `config/deploy.yml`
```yaml
# Change these values:
service: farmer
image: yourusername/farmer  # Your Docker Hub username

servers:
  web:
    hosts:
      - 1.2.3.4  # Your server IP or domain

registry:
  server: docker.io
  username: yourusername
  password:
    - DOCKER_REGISTRY_PASSWORD  # Set in .env
```

### 2. Create `.env` file (local, NOT committed)
```bash
# .env (do NOT commit this!)
DOCKER_REGISTRY_PASSWORD=your_docker_hub_token
PUBLIC_API_KEY=sk_public_your_actual_key_here
PUBLIC_ADMIN_TOKEN=admin_your_actual_token_here
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENROUTER_API_KEY=sk-or-your-key-here
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
```

**In `.gitignore`:**
```
.env
.env.local
*.env
```

### 3. Initialize Kamal
```bash
kamal init
# Creates config/deploy.yml and .env files
```

## Deployment Workflow

### First Deploy
```bash
# Build Docker image and push to registry
kamal build push

# Deploy to server
kamal deploy

# Check status
kamal status

# View logs
kamal logs
```

### Updates (after code changes)
```bash
# Commit your changes
git add .
git commit -m "Your changes"
git push

# Build and deploy new version
kamal deploy

# Rollback if needed
kamal rollback
```

### Useful Commands
```bash
# SSH into server
kamal console

# Run commands on server
kamal exec 'df -h'

# Stop the app
kamal stop

# Start the app
kamal start

# Monitor logs in real-time
kamal logs -f

# Get deployment history
kamal version

# Remove everything
kamal remove
```

## Monitoring & Maintenance

### Check Server Health
```bash
# Container status
kamal status

# Docker logs
kamal logs

# Resource usage
kamal exec 'docker stats'
```

### Database Backups
```bash
# Backup SQLite database
kamal exec 'tar czf /tmp/farmer-backup.tar.gz /app/data/'

# Download backup
kamal exec 'cat /tmp/farmer-backup.tar.gz' > farmer-backup.tar.gz
```

### Update Secrets
```bash
# Edit .env file
nano .env

# Redeploy with new secrets
kamal deploy

# Kamal automatically rolls out new container with updated env vars
```

## DNS Setup

Once deployed, point your domain to the server:

```bash
# Get your server's public IP
ip addr show

# Add DNS record:
# Type: A
# Name: router (or @)
# Value: your.server.ip.address
# TTL: 3600
```

After DNS propagates (5-30 mins):
```bash
curl https://router.studiokare.nl/health
# Should return: {"status":"ok"}
```

## SSL/TLS (HTTPS)

Kamal doesn't automatically handle SSL. Use one of these:

### Option 1: Nginx Reverse Proxy on Server
```bash
# SSH to server
ssh root@1.2.3.4

# Install Nginx
apt-get update && apt-get install -y nginx certbot python3-certbot-nginx

# Configure Nginx for your domain
# (See Nginx config example below)

# Get Let's Encrypt cert
certbot certonly --nginx -d router.studiokare.nl
```

### Option 2: CloudFlare (Recommended)
1. Point DNS to CloudFlare
2. Enable "Flexible SSL" in CloudFlare dashboard
3. CloudFlare handles HTTPS automatically

### Option 3: HAProxy Container
Add to `config/deploy.yml`:
```yaml
accessories:
  proxy:
    image: haproxy:2.8
    roles:
      - web
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - proxy-config:/usr/local/etc/haproxy
```

## Nginx Config Example
```nginx
# /etc/nginx/sites-available/farmer
upstream farmer {
  server localhost:3000;
}

server {
  listen 80;
  server_name router.studiokare.nl;
  
  location / {
    proxy_pass http://farmer;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
  }
}

# Enable
ln -s /etc/nginx/sites-available/farmer /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL with certbot
certbot --nginx -d router.studiokare.nl
```

## Troubleshooting

### Container won't start
```bash
kamal logs
# Check the error message, usually missing env vars or port conflict
```

### SSH connection fails
```bash
# Verify SSH key
ssh -i ~/.ssh/id_ed25519 root@1.2.3.4

# Check server firewall
# Ensure port 22 (SSH) is open
```

### Health check failing
```bash
# Check if app is running inside container
kamal exec 'curl localhost:3000/health'

# Check Docker logs
kamal logs -f
```

### Secrets not updating
```bash
# Make sure you're editing .env locally
cat .env | grep PUBLIC_API_KEY

# Redeploy to apply new secrets
kamal deploy
```

## Performance Tips

1. **Use GitHub Actions to auto-deploy on push:**
   ```yaml
   # .github/workflows/deploy.yml
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: ruby/setup-ruby@v1
         - run: gem install kamal
         - run: kamal deploy
           env:
             KAMAL_REGISTRY_PASSWORD: ${{ secrets.DOCKER_REGISTRY_PASSWORD }}
   ```

2. **Monitor with health checks:**
   - Kamal pings `/health` automatically
   - Ensure it responds quickly
   - Set `interval: 10s` in deploy.yml

3. **Resource limits:**
   Add to `config/deploy.yml`:
   ```yaml
   resources:
     limits:
       cpus: '1'
       memory: '1g'
     reservations:
       cpus: '0.5'
       memory: '512m'
   ```

## Rollback Procedure

```bash
# View available versions
kamal version

# Rollback to previous version
kamal rollback

# Deploy specific version
kamal deploy --version abc123def456
```

## Security Checklist

- [ ] SSH key-only authentication (no password)
- [ ] `.env` file in `.gitignore` (never commit secrets)
- [ ] Firewall only allows ports 22, 80, 443
- [ ] Regular backups of SQLite database
- [ ] Monitor admin dashboard for suspicious IPs
- [ ] Keep Kamal and Docker updated

## Support

- **Kamal docs:** https://kamal-deploy.org
- **Docker docs:** https://docs.docker.com
- **Issues:** Check Kamal GitHub for help

You're ready to deploy! 🚀
