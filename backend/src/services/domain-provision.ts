import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import logger from './logger';

/** Run a command safely without shell interpolation */
function runCommand(cmd: string, args: string[], timeoutMs = 30000): string {
  const result = spawnSync(cmd, args, { timeout: timeoutMs, stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString() || `${cmd} failed with code ${result.status}`);
  }
  return result.stdout?.toString() || '';
}

/** Validate hostname format (defense-in-depth) */
function isValidHostname(hostname: string): boolean {
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname);
}

const NGINX_SITES_AVAILABLE = '/etc/nginx/sites-available';
const NGINX_SITES_ENABLED = '/etc/nginx/sites-enabled';
const SERVER_IP = config.serverIp;

/**
 * Check if the domain's A record points to our server.
 * Required for certbot HTTP-01 challenge.
 */
async function checkARecord(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.promises.resolve4(hostname);
    return addresses.includes(SERVER_IP);
  } catch {
    return false;
  }
}

/**
 * Check if a hostname resolves to any A record at all.
 */
async function hasARecord(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.promises.resolve4(hostname);
    return addresses.length > 0;
  } catch {
    return false;
  }
}

/**
 * Generate Nginx server block config for a custom domain.
 */
function generateNginxConfig(hostname: string, slug: string, ssl: boolean, includeWww = true): string {
  const siteRoot = `/var/www/vibe-hosting/sites/${slug}`;
  const wwwHostname = `www.${hostname}`;
  const serverNames = includeWww ? `${hostname} ${wwwHostname}` : hostname;

  if (!ssl) {
    // HTTP-only config for certbot challenge + serving site
    return `# Custom domain: ${hostname} -> ${slug}
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    root ${siteRoot};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html =404;
    }
}
`;
  }

  // Full HTTPS config with password protection
  const wwwBlock = includeWww ? `
# www -> non-www redirect (HTTPS)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${wwwHostname};

    ssl_certificate /etc/letsencrypt/live/${hostname}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${hostname}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://${hostname}$request_uri;
}
` : '';

  return `# Custom domain: ${hostname} -> ${slug}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${hostname};

    ssl_certificate /etc/letsencrypt/live/${hostname}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${hostname}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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
        return 302 https://hostingvibe.ru/api/site-gate/${slug};
    }

    root ${siteRoot};
    index index.html;

    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location ~* \\.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2|ttf|eot|css|js|pdf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "https://hostingvibe.ru" always;
    }

    location ~* \\.html$ {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html =404;
    }
}
${wwwBlock}
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://${hostname}$request_uri;
    }
}
`;
}

/**
 * Provision a custom domain: create Nginx config, issue SSL, update DB.
 */
export async function provisionDomain(domainId: string): Promise<{ success: boolean; error?: string }> {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: { project: { select: { slug: true } } },
  });

  if (!domain) return { success: false, error: 'Домен не найден' };
  if (!domain.verified) return { success: false, error: 'Домен не верифицирован' };

  const { hostname } = domain;
  const slug = domain.project.slug;

  // Defense-in-depth: validate hostname even though it was checked at API level
  if (!isValidHostname(hostname)) {
    return { success: false, error: 'Недопустимое имя домена' };
  }

  const confPath = path.join(NGINX_SITES_AVAILABLE, hostname);
  const enabledPath = path.join(NGINX_SITES_ENABLED, hostname);

  try {
    // Update status
    await prisma.domain.update({
      where: { id: domainId },
      data: { sslStatus: 'PROVISIONING' },
    });

    // Step 1: Check A record
    const aRecordOk = await checkARecord(hostname);
    if (!aRecordOk) {
      await prisma.domain.update({
        where: { id: domainId },
        data: { sslStatus: 'PENDING' },
      });
      return {
        success: false,
        error: `A-запись домена ${hostname} не указывает на ${SERVER_IP}. Обновите DNS.`,
      };
    }

    // Step 2: Write HTTP-only Nginx config (for certbot challenge + serving site)
    fs.writeFileSync(confPath, generateNginxConfig(hostname, slug, false, true));

    // Create symlink if not exists
    if (!fs.existsSync(enabledPath)) {
      fs.symlinkSync(confPath, enabledPath);
    }

    // Test and reload Nginx
    runCommand('nginx', ['-t']);
    runCommand('systemctl', ['reload', 'nginx']);

    // Step 3: Issue SSL certificate
    // Only include www subdomain if it resolves (many users don't configure www)
    const wwwResolves = await hasARecord(`www.${hostname}`);
    const certbotArgs = [
      '--nginx',
      '-d', hostname,
      ...(wwwResolves ? ['-d', `www.${hostname}`] : []),
      '--non-interactive',
      '--agree-tos',
      '--email', 'admin@hostingvibe.ru',
      '--redirect',
    ];
    logger.info(`Certbot for ${hostname} (www=${wwwResolves}):`, { args: certbotArgs });
    const certOutput = runCommand('certbot', certbotArgs, 120000);
    logger.info(`Certbot for ${hostname} done:`, { stdout: certOutput });

    // Step 4: Write full HTTPS config (overwrite certbot's version with ours)
    fs.writeFileSync(confPath, generateNginxConfig(hostname, slug, true, wwwResolves));

    // Test and reload
    runCommand('nginx', ['-t']);
    runCommand('systemctl', ['reload', 'nginx']);

    // Step 5: Update DB
    await prisma.domain.update({
      where: { id: domainId },
      data: {
        sslStatus: 'ACTIVE',
        sslExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // ~90 days
      },
    });

    logger.info(`Domain provisioned: ${hostname} -> ${slug}`);
    return { success: true };

  } catch (err) {
    const msg = (err as Error).message;
    logger.error(`Domain provisioning failed for ${hostname}:`, { error: msg });

    await prisma.domain.update({
      where: { id: domainId },
      data: { sslStatus: 'FAILED' },
    });

    // On SSL failure, keep HTTP config so the site still serves on port 80
    // (better than removing config and showing VibeHosting landing page)
    try {
      fs.writeFileSync(confPath, generateNginxConfig(hostname, slug, false, true));
      if (!fs.existsSync(enabledPath)) {
        fs.symlinkSync(confPath, enabledPath);
      }
      try { runCommand('nginx', ['-t']); runCommand('systemctl', ['reload', 'nginx']); } catch { /* ignore */ }
      logger.info(`Kept HTTP-only config for ${hostname} after SSL failure`);
    } catch { /* ignore cleanup errors */ }

    return { success: false, error: msg };
  }
}

/**
 * Remove Nginx config and optionally revoke cert for a domain.
 */
export async function deprovisionDomain(hostname: string): Promise<void> {
  const confPath = path.join(NGINX_SITES_AVAILABLE, hostname);
  const enabledPath = path.join(NGINX_SITES_ENABLED, hostname);

  try {
    if (fs.existsSync(enabledPath)) fs.unlinkSync(enabledPath);
    if (fs.existsSync(confPath)) fs.unlinkSync(confPath);
    runCommand('nginx', ['-t']);
    runCommand('systemctl', ['reload', 'nginx']);
    logger.info(`Domain deprovisioned: ${hostname}`);
  } catch (err) {
    logger.error(`Domain deprovision error for ${hostname}:`, { error: (err as Error).message });
  }
}
