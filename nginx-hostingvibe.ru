map $host $vibe_canonical_host {
    default "";
    include /etc/nginx/conf.d/vibe-canonical-hosts.map;
}

# VibeHosting — Main site HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name hostingvibe.ru www.hostingvibe.ru;

    location /.well-known/acme-challenge/ {
        root /root/vibecode/certbot_webroot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# VibeHosting — Main site HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hostingvibe.ru www.hostingvibe.ru;

    ssl_certificate /etc/letsencrypt/live/hostingvibe.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hostingvibe.ru/privkey.pem;

    # Hide tech stack headers
    proxy_hide_header X-Powered-By;
    more_clear_headers 'X-Powered-By' 'Server';

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:7001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_hide_header X-Powered-By;
        client_max_body_size 55m;
    }

    # Frontend proxy (Next.js serves /_next/static/ internally with immutable caching)
    location / {
        proxy_pass http://127.0.0.1:7002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_hide_header X-Powered-By;
    }
}

# VibeHosting — User sites (wildcard subdomains) — HTTP
server {
    listen 80;
    listen [::]:80;
    server_name *.hostingvibe.ru;

    if ($vibe_canonical_host != "") {
        return 301 https://$vibe_canonical_host$request_uri;
    }

    location /.well-known/acme-challenge/ {
        root /root/vibecode/certbot_webroot;
    }

    # Extract slug from subdomain
    set $slug "";
    if ($host ~* ^([a-z0-9][-a-z0-9]*)\.hostingvibe\.ru$) {
        set $slug $1;
    }

    # Block reserved slugs
    if ($slug ~* ^(www|api|admin|app|mail|ftp|static|cdn|billing|support|help|blog|docs|status|gallery|dashboard)$) {
        return 301 https://hostingvibe.ru;
    }

    # Serve static site
    root /var/www/vibe-hosting/sites/$slug;
    index index.html;

    # Placeholder for non-existent sites
    error_page 403 404 /placeholder.html;
    location = /placeholder.html {
        root /var/www/vibe-hosting;
        internal;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2|ttf|eot|css|js|pdf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML — no cache
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }

    # Try files, fallback to index.html (SPA support), then placeholder
    location / {
        try_files $uri $uri/ /index.html =404;
    }
}

# VibeHosting — User sites HTTPS (wildcard cert via DNS-01)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.hostingvibe.ru;

    if ($vibe_canonical_host != "") {
        return 301 https://$vibe_canonical_host$request_uri;
    }

    ssl_certificate /etc/ssl/acme/hostingvibe.ru-wildcard/fullchain.pem;
    ssl_certificate_key /etc/ssl/acme/hostingvibe.ru-wildcard/privkey.pem;

    # Extract slug from subdomain
    set $slug "";
    if ($host ~* ^([a-z0-9][-a-z0-9]*)\.hostingvibe\.ru$) {
        set $slug $1;
    }

    # Block reserved slugs
    if ($slug ~* ^(www|api|admin|app|mail|ftp|static|cdn|billing|support|help|blog|docs|status|gallery|dashboard)$) {
        return 301 https://hostingvibe.ru;
    }

    # Password protection via auth_request
    auth_request /___auth;
    error_page 401 = @password_gate;

    location = /___auth {
        internal;
        proxy_pass http://127.0.0.1:7001/api/site-auth;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-Host $host;
        proxy_set_header Cookie $http_cookie;
    }

    location @password_gate {
        return 302 https://hostingvibe.ru/api/site-gate/$slug;
    }

    # Serve static site (same as HTTP block)
    root /var/www/vibe-hosting/sites/$slug;
    index index.html;

    # Placeholder for non-existent sites
    error_page 403 404 /placeholder.html;
    location = /placeholder.html {
        root /var/www/vibe-hosting;
        internal;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Cache static assets — skip auth_request to avoid rate-limit 429s
    # (HTML pages still go through password check via server-level auth_request)
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2|ttf|eot|css|js|pdf)$ {
        auth_request off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html =404;
    }
}
