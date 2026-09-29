#!/bin/bash
# Script untuk setup awal VPS Ubuntu 22.04 (Node.js & npm)

echo "Update paket sistem..."
sudo apt update && sudo apt upgrade -y

echo "Install Node.js (LTS)..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

echo "Verifikasi instalasi Node.js dan npm..."
node -v
npm -v

echo "Install PM2 secara global..."
sudo npm install -g pm2
pm2 startup
