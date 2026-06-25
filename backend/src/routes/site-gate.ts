import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import logger from '../services/logger';

// Cookie name prefix for password-protected sites
const COOKIE_PREFIX = 'vibe_access_';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function normalizeHost(host: string): string {
  return host.toLowerCase().trim().replace(/:\d+$/, '');
}

function isValidPublicHost(host: string): boolean {
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host);
}

/**
 * GET /api/site-auth
 * Called by Nginx auth_request for every file on *.hostingvibe.ru
 * Returns 200 if allowed, 401 if password needed
 */
export async function siteAuthHandler(req: Request, res: Response) {
  try {
    // Nginx forwards the original Host header
    const host = normalizeHost((req.headers['x-original-host'] || req.headers.host || '') as string);
    const match = host.match(/^([a-z0-9][-a-z0-9]*)\.hostingvibe\.ru/i);

    let slug: string;
    if (match) {
      slug = match[1].toLowerCase();
    } else {
      // Custom domain — look up by hostname
      const domain = await prisma.domain.findUnique({
        where: { hostname: host },
        select: { project: { select: { slug: true } } },
      });
      if (!domain) {
        res.status(200).send('ok');
        return;
      }
      slug = domain.project.slug;
    }

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { passwordEnabled: true, passwordHash: true },
    });

    if (!project || !project.passwordEnabled || !project.passwordHash) {
      res.status(200).send('ok');
      return;
    }

    // Check cookie
    const cookieName = COOKIE_PREFIX + slug;
    const token = parseCookies(req.headers.cookie || '')[cookieName];
    if (token) {
      // Verify token = HMAC(slug + passwordHash)
      const expected = crypto
        .createHmac('sha256', project.passwordHash)
        .update(slug)
        .digest('hex');
      const tokenBuf = Buffer.from(token, 'utf8');
      const expectedBuf = Buffer.from(expected, 'utf8');
      if (tokenBuf.length === expectedBuf.length && crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
        res.status(200).send('ok');
        return;
      }
      logger.info('site-auth cookie mismatch', { slug });
    }

    res.status(401).send('password required');
  } catch (err) {
    logger.error('site-auth error:', err);
    // Fail closed — deny access on error to protect password-gated sites
    res.status(401).send('error');
  }
}

/**
 * GET /api/site-context?host=example.com
 * Public host -> project mapping for cross-origin helper scripts on custom domains.
 */
export async function siteContextGet(req: Request, res: Response) {
  try {
    const rawHost = typeof req.query.host === 'string' ? req.query.host : '';
    const host = normalizeHost(rawHost);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (!host || !isValidPublicHost(host)) {
      res.status(400).json({ error: 'Некорректный host' });
      return;
    }

    const subdomainMatch = host.match(/^([a-z0-9][-a-z0-9]*)\.hostingvibe\.ru$/i);

    if (subdomainMatch) {
      const slug = subdomainMatch[1].toLowerCase();
      const project = await prisma.project.findUnique({
        where: { slug },
        select: {
          slug: true,
          status: true,
          metrikaId: true,
          domains: {
            where: { verified: true, sslStatus: 'ACTIVE' },
            select: { hostname: true },
            take: 1,
          },
        },
      });

      if (!project || project.status !== 'LIVE') {
        res.status(404).json({ error: 'Сайт не найден' });
        return;
      }

      res.json({
        slug: project.slug,
        metrikaId: project.metrikaId || null,
        primaryHost: project.domains[0]?.hostname || `${project.slug}.hostingvibe.ru`,
      });
      return;
    }

    const domain = await prisma.domain.findFirst({
      where: { hostname: host, verified: true },
      select: {
        project: {
          select: {
            slug: true,
            status: true,
            metrikaId: true,
            domains: {
              where: { verified: true, sslStatus: 'ACTIVE' },
              select: { hostname: true },
              take: 1,
            },
          },
        },
      },
    });

    const project = domain?.project;
    if (!project || project.status !== 'LIVE') {
      res.status(404).json({ error: 'Сайт не найден' });
      return;
    }

    res.json({
      slug: project.slug,
      metrikaId: project.metrikaId || null,
      primaryHost: project.domains[0]?.hostname || `${project.slug}.hostingvibe.ru`,
    });
  } catch (err) {
    logger.error('site-context error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * GET /api/site-gate/:slug
 * Serves the password entry form
 */
export async function siteGateGet(req: Request, res: Response) {
  const { slug } = req.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { title: true, passwordEnabled: true, domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 } },
  });

  // Determine the site host: custom domain or subdomain
  const siteHost = project?.domains[0]?.hostname || `${slug}.hostingvibe.ru`;

  if (!project || !project.passwordEnabled) {
    res.redirect(`https://${siteHost}`);
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(passwordPageHtml(slug, project.title));
}

/**
 * POST /api/site-gate/:slug
 * Verifies password and sets cookie
 */
export async function siteGatePost(req: Request, res: Response) {
  const { slug } = req.params;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'Пароль обязателен' });
    return;
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { passwordHash: true, passwordEnabled: true, domains: { where: { verified: true, sslStatus: 'ACTIVE' }, select: { hostname: true }, take: 1 } },
  });

  // Determine the site host: custom domain or subdomain
  const customDomain = project?.domains[0]?.hostname;
  const siteHost = customDomain || `${slug}.hostingvibe.ru`;

  if (!project || !project.passwordEnabled || !project.passwordHash) {
    res.redirect(`https://${siteHost}`);
    return;
  }

  const valid = await bcrypt.compare(password, project.passwordHash);
  if (!valid) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(passwordPageHtml(slug, null, true));
    return;
  }

  // Set access cookie
  const token = crypto
    .createHmac('sha256', project.passwordHash)
    .update(slug)
    .digest('hex');

  const cookieDomain = customDomain ? `Domain=${customDomain}` : 'Domain=.hostingvibe.ru';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_PREFIX}${slug}=${token}; Path=/; ${cookieDomain}; Max-Age=${COOKIE_MAX_AGE / 1000}; HttpOnly; Secure; SameSite=Lax`
  );
  res.redirect(`https://${siteHost}`);
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  });
  return cookies;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function passwordPageHtml(slug: string, title: string | null, error = false): string {
  const siteTitle = escapeHtml(title || slug);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Доступ к ${siteTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px; max-width: 400px; width: 90%; text-align: center; }
    .lock { width: 48px; height: 48px; margin: 0 auto 16px; background: #ecfdf5; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .lock svg { width: 24px; height: 24px; color: #10b981; }
    h1 { font-size: 20px; color: #111827; margin-bottom: 8px; }
    p { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
    .error { color: #ef4444; font-size: 13px; margin-bottom: 16px; }
    input[type=password] { width: 100%; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 15px; outline: none; transition: border-color 0.2s; }
    input[type=password]:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
    button { width: 100%; margin-top: 12px; padding: 12px; background: #10b981; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #059669; }
    .brand { margin-top: 24px; font-size: 12px; color: #d1d5db; }
    .brand a { color: #d1d5db; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="lock">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    </div>
    <h1>${siteTitle}</h1>
    <p>Этот сайт защищён паролем</p>
    ${error ? '<p class="error">Неверный пароль</p>' : ''}
    <form method="POST" action="https://hostingvibe.ru/api/site-gate/${slug}">
      <input type="password" name="password" placeholder="Введите пароль" autofocus required autocomplete="off">
      <button type="submit">Войти</button>
    </form>
    <p class="brand"><a href="https://hostingvibe.ru">VibeHosting</a></p>
  </div>
</body>
</html>`;
}
