# Deploy to Hostinger (permanent hosting) - step by step

Goal: run the site 24/7 at your own domain (e.g. mkt88.my) with admin panel,
live results and Google AdSense working permanently.

## 1) What to buy on Hostinger
- One DOMAIN: e.g. mkt88.my (annual ~)
- One hosting that runs Node.js (important):
  - RECOMMENDED: Hostinger VPS (KVM) - cheapest full control
  - or Hostinger Cloud Hosting / Business plan that supports Node.js apps
  (Plain "Web Hosting" is PHP-only and will NOT run this Next.js app.)

## 2) What I prepare for you (already in this repo)
- Next.js app (routes, admin panel, live results, PWA, AdSense)
- Node server start script
- This guide

## 3) Steps you do in Hostinger (I guide each)
1. Buy domain + VPS.
2. In hPanel, find your VPS IP.
3. Point domain DNS:  A record  @  ->  VPS_IP   (and www -> VPS_IP)
4. Connect to VPS (hPanel terminal or SSH/PuTTY).
5. Install Node 20+:
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
6. Install pnpm:   sudo npm i -g pnpm
7. Copy the project to the server:
   - easiest: zip project (excluding node_modules & .next) and upload via SFTP, then unzip
   - or: install git and `git clone <your repo>` if you push to GitHub
8. In project folder:
   pnpm install
   pnpm build
9. Start with a process manager so it never stops:
   npm i -g pm2
   ADMIN_USER=you ADMIN_PASSWORD='strong-pass' ADMIN_SECRET='long-random' pm2 start "pnpm start" --name mkt88
   pm2 save && pm2 startup
10. Reverse proxy + HTTPS on port 80/443 -> 8888:
    install nginx, then use certbot for free SSL:
    sudo apt-get install -y nginx certbot python3-certbot-nginx
    # nginx config proxy_pass http://127.0.0.1:8888;
    sudo certbot --nginx -d mkt88.my -d www.mkt88.my
11. Open firewall ports:  sudo ufw allow 80,443

After this your URL NEVER changes: https://mkt88.my

## 4) Then do
- Admin: https://mkt88.my/admin   (login = env you set)
- AdSense: verify domain (meta/HTML/DNS) -> approval -> ads show permanently
