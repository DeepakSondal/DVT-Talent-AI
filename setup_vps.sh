#!/bin/bash
# ============================================================
# DVT Talent AI — VPS Bootstrap Script
# Run this ONCE on a fresh Ubuntu 22.04 / Debian 12 server
# Usage: chmod +x setup_vps.sh && ./setup_vps.sh
# ============================================================
set -e

echo "🚀 DVT Talent AI — VPS Setup Starting..."

# ── 1. System Update ────────────────────────────────────────
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# ── 2. Base Dependencies ─────────────────────────────────────
sudo apt-get install -y \
    ca-certificates curl gnupg lsb-release \
    git ufw fail2ban htop unzip

# ── 3. Install Docker ────────────────────────────────────────
echo "🐳 Installing Docker..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

# Add current user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# ── 4. Verify Docker ─────────────────────────────────────────
sudo docker --version
sudo docker compose version

# ── 5. Firewall (UFW) ────────────────────────────────────────
echo "🛡️  Configuring Firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP  (Caddy → HTTPS redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 443/udp   # HTTP/3 (QUIC)
sudo ufw --force enable
sudo ufw status

# ── 6. Fail2Ban (SSH brute-force protection) ─────────────────
echo "🔒 Enabling Fail2Ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# ── 7. Create App Directory ──────────────────────────────────
echo "📁 Creating app directory..."
sudo mkdir -p /opt/dvt-talent-ai
sudo chown $USER:$USER /opt/dvt-talent-ai

# ── 8. Generate secure keys ──────────────────────────────────
echo ""
echo "🔑 IMPORTANT — Generating secure secrets for your .env file:"
echo "   SECRET_KEY: $(openssl rand -hex 32)"
echo "   DB_PASSWORD: $(openssl rand -base64 24 | tr -d '=+/' | head -c 24)"
echo ""
echo "   Copy these values into your backend/.env before launching!"
echo ""

echo "✅ VPS Setup Complete!"
echo ""
echo "📋 NEXT STEPS:"
echo "   1. Log out and back in so docker group takes effect"
echo "   2. Clone your repo: git clone <your-repo-url> /opt/dvt-talent-ai"
echo "   3. cd /opt/dvt-talent-ai"
echo "   4. Create backend/.env (see deployment guide)"
echo "   5. docker compose -f docker-compose.prod.yml up --build -d"
echo "   6. docker compose -f docker-compose.prod.yml exec api python scripts/pilot_seed.py"
echo ""
echo "🌍 Your site will be live at https://dvttalent.com once DNS propagates!"
