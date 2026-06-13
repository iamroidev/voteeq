#!/usr/bin/env bash
# VoteEQ API on EC2 (Amazon Linux 2023 / Ubuntu). Run as root on the instance.
set -euo pipefail

APP_DIR=/opt/voteeq
REPO_URL="${REPO_URL:-https://github.com/iamroidev/voteeq.git}"
BRANCH="${BRANCH:-main}"

echo "==> Installing Node.js 20, git, nginx..."
if command -v dnf &>/dev/null; then
  dnf install -y git nginx curl
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
elif command -v apt-get &>/dev/null; then
  apt-get update -y
  apt-get install -y git nginx curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "Unsupported OS. Install Node 20, git, and nginx manually."
  exit 1
fi

npm install -g pm2

echo "==> Cloning / updating VoteEQ..."
mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git fetch origin && git checkout "$BRANCH" && git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi

if [ -d "/home/ubuntu/deploy" ]; then
  echo "==> Restoring uploaded deploy folder..."
  cp -r /home/ubuntu/deploy "$APP_DIR/"
fi

if [ -f "/home/ubuntu/backend.env" ]; then
  echo "==> Restoring uploaded backend .env..."
  mkdir -p "$APP_DIR/backend"
  cp /home/ubuntu/backend.env "$APP_DIR/backend/.env"
fi

echo "==> Ensuring upload directories persist on disk..."
mkdir -p "$APP_DIR/backend/photos" "$APP_DIR/backend/banners"
chmod 755 "$APP_DIR/backend/photos" "$APP_DIR/backend/banners"

echo "==> Installing backend dependencies..."
cd "$APP_DIR/backend"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/deploy/ec2.env.example" "$APP_DIR/backend/.env"
  echo ""
  echo "!!! Edit $APP_DIR/backend/.env with production secrets, then run:"
  echo "    pm2 restart voteeq-api"
  echo ""
fi

echo "==> PM2 process..."
pm2 delete voteeq-api 2>/dev/null || true
cd "$APP_DIR/backend"
pm2 start server.js --name voteeq-api
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo "==> Nginx site for api.voteeq.online..."
NGINX_AVAIL=/etc/nginx/sites-available
NGINX_ENABLED=/etc/nginx/sites-enabled
if [ -d "$NGINX_AVAIL" ]; then
  cp "$APP_DIR/deploy/nginx-api.voteeq.online.conf" "$NGINX_AVAIL/voteeq-api"
  ln -sf "$NGINX_AVAIL/voteeq-api" "$NGINX_ENABLED/voteeq-api"
else
  cp "$APP_DIR/deploy/nginx-api.voteeq.online.conf" /etc/nginx/conf.d/voteeq-api.conf
fi
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "==> Bootstrap done."
echo "1. Set DNS: api.voteeq.online  A  ->  $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_ELASTIC_IP')"
echo "2. Edit:   $APP_DIR/backend/.env"
echo "3. SSL:    certbot --nginx -d api.voteeq.online   (install certbot if needed)"
echo "4. Test:   curl http://127.0.0.1:5000/health"
echo "5. Paystack webhook: https://api.voteeq.online/api/payment/webhook"
