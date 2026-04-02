#!/bin/bash
# DVT Talent AI — Universal VPS Setup Script
# Automates Docker & Security installation for fresh Linux (Ubuntu/Debian)

echo "🚀 Starting Universal VPS Setup for DVT Talent AI..."

# 1. Update System
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Dependencies
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# 3. Setup Docker Repository
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker Engine & Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 5. Verify Installation
sudo docker --version
sudo docker compose version

# 6. Setup Firewall (UFW)
echo "🛡️ Configuring Firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "✅ VPS Setup Complete! You are now ready to deploy DVT Talent AI."
echo "👉 Next Step: Upload your .env, Caddyfile, and docker-compose.prod.yml files."
