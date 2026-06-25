import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://hostingvibe.ru';
const results = [];
let bugId = 0;
const bugs = [];

function log(section, msg) {
  const line = `[${section}] ${msg}`;
  console.log(line);
  results.push(line);
}

function bug(severity, where, title, expected, actual) {
  bugId++;
  const b = { id: `BUG-${String(bugId).padStart(2,'0')}`, severity, where, title, expected, actual };
  bugs.push(b);
  console.log(`  !!! ${b.id} [${severity}] ${title}`);
  return b;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Desktop context
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) QA-ManualTest/1.0'
  });

  // Mobile context
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) QA-ManualTest/1.0',
    isMobile: true,
    hasTouch: true
  });

  // ============================================================
  // 1. ГЛАВНАЯ СТРАНИЦА — Desktop
  // ============================================================
  log('MAIN-DESKTOP', '--- Тестирование главной страницы (Desktop 1440x900) ---');
  const mainPage = await desktopCtx.newPage();
  const mainResp = await mainPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  log('MAIN-DESKTOP', `HTTP Status: ${mainResp.status()}`);
  log('MAIN-DESKTOP', `Title: ${await mainPage.title()}`);

  // Check hero section
  const heroH1 = await mainPage.$eval('h1', el => el.textContent).catch(() => 'NOT FOUND');
  log('MAIN-DESKTOP', `Hero H1: "${heroH1}"`);

  // Check nav links
  const navLinks = await mainPage.$$eval('header a, header button, nav a', els =>
    els.map(el => ({ text: el.textContent.trim(), href: el.getAttribute('href') || 'button' }))
  );
  log('MAIN-DESKTOP', `Nav items: ${JSON.stringify(navLinks)}`);

  // Check all sections exist
  const sections = ['#features', '#how', '#pricing', '#faq'];
  for (const sel of sections) {
    const exists = await mainPage.$(sel) !== null;
    log('MAIN-DESKTOP', `Section ${sel}: ${exists ? 'OK' : 'MISSING'}`);
    if (!exists) bug('MEDIUM', 'Main page', `Section ${sel} not found`, `Section ${sel} should exist`, 'Element not found in DOM');
  }

  // Check pricing cards
  const pricingTexts = await mainPage.$$eval('#pricing *', els => {
    const texts = els.map(e => e.textContent).join(' ');
    return {
      hasFree: texts.includes('Бесплатн') || texts.includes('FREE') || texts.includes('0'),
      hasPro: texts.includes('PRO') || texts.includes('386'),
    };
  }).catch(() => ({ hasFree: false, hasPro: false }));
  log('MAIN-DESKTOP', `Pricing FREE: ${pricingTexts.hasFree}, PRO: ${pricingTexts.hasPro}`);

  // Check footer
  const footerLinks = await mainPage.$$eval('footer a', els =>
    els.map(el => ({ text: el.textContent.trim().substring(0,40), href: el.getAttribute('href') }))
  );
  log('MAIN-DESKTOP', `Footer links: ${JSON.stringify(footerLinks)}`);

  // Check cookie banner
  const cookieBanner = await mainPage.$('text=Cookie-файлы');
  log('MAIN-DESKTOP', `Cookie banner visible: ${cookieBanner !== null}`);

  // Check console errors
  const consoleErrors = [];
  mainPage.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await mainPage.waitForTimeout(2000);
  log('MAIN-DESKTOP', `Console errors on main: ${consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors)}`);

  // Screenshot
  await mainPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/01-main-desktop.png', fullPage: true });
  log('MAIN-DESKTOP', 'Screenshot saved');

  // ============================================================
  // 2. ГЛАВНАЯ — Mobile
  // ============================================================
  log('MAIN-MOBILE', '--- Тестирование главной страницы (Mobile 390x844) ---');
  const mobilePage = await mobileCtx.newPage();
  const mobileErrors = [];
  mobilePage.on('console', msg => {
    if (msg.type() === 'error') mobileErrors.push(msg.text());
  });
  await mobilePage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  log('MAIN-MOBILE', `Title: ${await mobilePage.title()}`);

  // Check mobile menu / burger
  const burger = await mobilePage.$('button[aria-label*="menu"], button[aria-label*="Menu"], header button');
  log('MAIN-MOBILE', `Burger menu button: ${burger ? 'FOUND' : 'NOT FOUND'}`);

  // Cookie banner on mobile - check if it blocks CTA
  const mobileCookie = await mobilePage.$('text=Cookie-файлы');
  if (mobileCookie) {
    log('MAIN-MOBILE', 'Cookie banner present on mobile');
    // Check if login button is clickable
    const loginBtn = await mobilePage.$('a[href="/login"]');
    if (loginBtn) {
      const box = await loginBtn.boundingBox();
      log('MAIN-MOBILE', `Login button position: y=${box?.y}, height=${box?.height}`);
    }

    // Check cookie banner z-index and position
    const bannerInfo = await mobilePage.$eval('[class*="fixed"][class*="bottom"]', el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return { top: rect.top, height: rect.height, zIndex: style.zIndex };
    }).catch(() => null);
    if (bannerInfo) {
      log('MAIN-MOBILE', `Cookie banner: top=${bannerInfo.top}, height=${bannerInfo.height}, z-index=${bannerInfo.zIndex}`);
      if (bannerInfo.top < 600) {
        bug('HIGH', 'Mobile main', 'Cookie banner may overlap key content on mobile',
          'Cookie banner should not block page interaction',
          `Banner starts at y=${bannerInfo.top} covering significant viewport area`);
      }
    }
  }

  await mobilePage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/02-main-mobile.png', fullPage: true });

  // ============================================================
  // 3. LOGIN PAGE
  // ============================================================
  log('LOGIN', '--- Тестирование страницы входа ---');
  const loginPage = await desktopCtx.newPage();
  const loginErrors = [];
  loginPage.on('console', msg => {
    if (msg.type() === 'error') loginErrors.push(msg.text());
  });
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  log('LOGIN', `Title: ${await loginPage.title()}`);
  log('LOGIN', `URL: ${loginPage.url()}`);

  // Check form elements
  const emailInput = await loginPage.$('input[type="email"], input[name="email"]');
  const passwordInput = await loginPage.$('input[type="password"], input[name="password"]');
  const submitBtn = await loginPage.$('button[type="submit"]');
  log('LOGIN', `Email input: ${emailInput ? 'OK' : 'MISSING'}`);
  log('LOGIN', `Password input: ${passwordInput ? 'OK' : 'MISSING'}`);
  log('LOGIN', `Submit button: ${submitBtn ? 'OK' : 'MISSING'}`);

  if (!emailInput || !passwordInput) {
    bug('HIGH', '/login', 'Login form fields not rendered',
      'Email and password inputs should be visible',
      'One or more form fields missing from DOM');
  }

  // Check links to register and forgot-password
  const registerLink = await loginPage.$('a[href*="register"]');
  const forgotLink = await loginPage.$('a[href*="forgot"]');
  log('LOGIN', `Register link: ${registerLink ? 'OK' : 'MISSING'}`);
  log('LOGIN', `Forgot password link: ${forgotLink ? 'OK' : 'MISSING'}`);

  // Try submitting empty form
  if (submitBtn) {
    await submitBtn.click();
    await loginPage.waitForTimeout(1500);
    const errorMsg = await loginPage.$eval('[class*="error"], [class*="alert"], [role="alert"]', el => el.textContent).catch(() => 'none');
    log('LOGIN', `Empty submit error: "${errorMsg}"`);
  }

  // Try invalid credentials
  if (emailInput && passwordInput && submitBtn) {
    await emailInput.fill('invalid@doesnotexist.dev');
    await passwordInput.fill('WrongPass123!');
    await submitBtn.click();
    await loginPage.waitForTimeout(2000);
    const loginError = await loginPage.$eval('[class*="error"], [class*="alert"], [role="alert"], [class*="red"]', el => el.textContent).catch(() => 'none');
    log('LOGIN', `Wrong creds error: "${loginError}"`);
  }

  await loginPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/03-login.png' });
  log('LOGIN', `Console errors: ${loginErrors.length === 0 ? 'NONE' : JSON.stringify(loginErrors)}`);

  // ============================================================
  // 4. REGISTER PAGE
  // ============================================================
  log('REGISTER', '--- Тестирование страницы регистрации ---');
  const regPage = await desktopCtx.newPage();
  const regErrors = [];
  regPage.on('console', msg => {
    if (msg.type() === 'error') regErrors.push(msg.text());
  });
  await regPage.goto(`${BASE}/register`, { waitUntil: 'networkidle', timeout: 30000 });
  log('REGISTER', `Title: ${await regPage.title()}`);

  const regEmail = await regPage.$('input[type="email"], input[name="email"]');
  const regPass = await regPage.$('input[type="password"], input[name="password"]');
  const regName = await regPage.$('input[name="name"], input[placeholder*="имя"], input[placeholder*="Имя"]');
  const regSubmit = await regPage.$('button[type="submit"]');
  log('REGISTER', `Email: ${regEmail ? 'OK' : 'MISSING'}`);
  log('REGISTER', `Password: ${regPass ? 'OK' : 'MISSING'}`);
  log('REGISTER', `Name: ${regName ? 'OK' : 'MISSING'}`);
  log('REGISTER', `Submit: ${regSubmit ? 'OK' : 'MISSING'}`);

  // Check terms/privacy links
  const termsLink = await regPage.$('a[href*="terms"]');
  const privacyLink = await regPage.$('a[href*="privacy"]');
  log('REGISTER', `Terms link: ${termsLink ? 'OK' : 'MISSING'}`);
  log('REGISTER', `Privacy link: ${privacyLink ? 'OK' : 'MISSING'}`);

  await regPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/04-register.png' });
  log('REGISTER', `Console errors: ${regErrors.length === 0 ? 'NONE' : JSON.stringify(regErrors)}`);

  // ============================================================
  // 5. FORGOT PASSWORD
  // ============================================================
  log('FORGOT', '--- Тестирование восстановления пароля ---');
  const forgotPage = await desktopCtx.newPage();
  await forgotPage.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle', timeout: 30000 });
  log('FORGOT', `Title: ${await forgotPage.title()}`);

  const forgotEmail = await forgotPage.$('input[type="email"], input[name="email"]');
  const forgotSubmit = await forgotPage.$('button[type="submit"]');
  log('FORGOT', `Email input: ${forgotEmail ? 'OK' : 'MISSING'}`);
  log('FORGOT', `Submit button: ${forgotSubmit ? 'OK' : 'MISSING'}`);

  await forgotPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/05-forgot-password.png' });

  // ============================================================
  // 6. GALLERY
  // ============================================================
  log('GALLERY', '--- Тестирование галереи ---');
  const galleryPage = await desktopCtx.newPage();
  await galleryPage.goto(`${BASE}/gallery`, { waitUntil: 'networkidle', timeout: 30000 });
  log('GALLERY', `Title: ${await galleryPage.title()}`);

  // Check gallery cards
  const galleryCards = await galleryPage.$$('[class*="card"], [class*="project"], a[href*=".hostingvibe.ru"]');
  log('GALLERY', `Project cards found: ${galleryCards.length}`);

  // Check sorting tabs
  const tabs = await galleryPage.$$eval('button, [role="tab"]', els =>
    els.map(e => e.textContent.trim()).filter(t => ['Новые','Популярные','Просмотры'].some(k => t.includes(k)))
  );
  log('GALLERY', `Sorting tabs: ${JSON.stringify(tabs)}`);

  await galleryPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/06-gallery.png' });

  // ============================================================
  // 7. DOCS
  // ============================================================
  log('DOCS', '--- Тестирование документации ---');
  const docsPage = await desktopCtx.newPage();
  await docsPage.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 30000 });
  log('DOCS', `Title: ${await docsPage.title()}`);

  const docsHeadings = await docsPage.$$eval('h1, h2, h3', els => els.map(e => e.textContent.trim()));
  log('DOCS', `Headings: ${JSON.stringify(docsHeadings.slice(0, 15))}`);

  await docsPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/07-docs.png', fullPage: true });

  // ============================================================
  // 8. AI PAGE
  // ============================================================
  log('AI', '--- Тестирование страницы AI ---');
  const aiPage = await desktopCtx.newPage();
  await aiPage.goto(`${BASE}/ai`, { waitUntil: 'networkidle', timeout: 30000 });
  log('AI', `Title: ${await aiPage.title()}`);

  // Check copy prompt button
  const copyBtn = await aiPage.$('button:has-text("Скопировать"), button:has-text("копировать"), button:has-text("Копировать")');
  log('AI', `Copy prompt button: ${copyBtn ? 'OK' : 'MISSING'}`);

  await aiPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/08-ai.png', fullPage: true });

  // ============================================================
  // 9. TERMS / PRIVACY / OFFER
  // ============================================================
  for (const p of ['terms', 'privacy', 'offer']) {
    log(p.toUpperCase(), `--- Тестирование /${p} ---`);
    const pg = await desktopCtx.newPage();
    await pg.goto(`${BASE}/${p}`, { waitUntil: 'networkidle', timeout: 30000 });
    log(p.toUpperCase(), `Title: ${await pg.title()}`);
    const headings = await pg.$$eval('h1, h2', els => els.map(e => e.textContent.trim()).slice(0, 5));
    log(p.toUpperCase(), `Headings: ${JSON.stringify(headings)}`);
    const textLength = await pg.$eval('body', el => el.innerText.length);
    log(p.toUpperCase(), `Content length: ${textLength} chars`);
    await pg.close();
  }

  // ============================================================
  // 10. REAL REGISTRATION + LOGIN FLOW
  // ============================================================
  log('AUTH-FLOW', '--- Тестирование реального флоу регистрации ---');
  const authPage = await desktopCtx.newPage();
  const authErrors = [];
  authPage.on('console', msg => {
    if (msg.type() === 'error') authErrors.push(msg.text());
  });

  await authPage.goto(`${BASE}/register`, { waitUntil: 'networkidle', timeout: 30000 });

  const ts = Date.now();
  const testEmail = `qa-browser-${ts}@testmail.dev`;
  const testPass = 'BrowserTest2026!';

  // Fill registration form
  const rEmail = await authPage.$('input[type="email"], input[name="email"]');
  const rPass = await authPage.$('input[type="password"], input[name="password"]');
  const rName = await authPage.$('input[name="name"], input[placeholder*="имя"], input[placeholder*="Имя"]');
  const rBtn = await authPage.$('button[type="submit"]');

  if (rEmail && rPass && rBtn) {
    if (rName) await rName.fill('QA Browser Tester');
    await rEmail.fill(testEmail);
    await rPass.fill(testPass);

    await authPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/09-register-filled.png' });

    // Submit
    const [response] = await Promise.all([
      authPage.waitForResponse(r => r.url().includes('/api/auth/register'), { timeout: 10000 }).catch(() => null),
      rBtn.click()
    ]);

    await authPage.waitForTimeout(3000);
    log('AUTH-FLOW', `After register URL: ${authPage.url()}`);
    log('AUTH-FLOW', `Register API response: ${response ? response.status() : 'no response caught'}`);

    // Check if redirected to projects
    if (authPage.url().includes('/projects')) {
      log('AUTH-FLOW', 'Redirected to /projects after registration: OK');
    } else {
      log('AUTH-FLOW', `Unexpected redirect: ${authPage.url()}`);
    }

    // Check for welcome modal
    const welcomeModal = await authPage.$('[class*="modal"], [role="dialog"]');
    log('AUTH-FLOW', `Welcome modal after registration: ${welcomeModal ? 'SHOWN' : 'NOT SHOWN'}`);
    if (!welcomeModal) {
      bug('MEDIUM', 'Post-registration', 'Welcome onboarding modal not shown after registration',
        'New user should see welcome modal / onboarding after first registration',
        'User lands on /projects without any onboarding guidance');
    }

    await authPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/10-after-register.png' });

    // Check cookie flags
    const cookies = await authPage.context().cookies();
    const vibeCookie = cookies.find(c => c.name === 'vibe_token');
    if (vibeCookie) {
      log('AUTH-FLOW', `Cookie vibe_token: httpOnly=${vibeCookie.httpOnly}, secure=${vibeCookie.secure}, sameSite=${vibeCookie.sameSite}`);
      if (!vibeCookie.httpOnly) bug('HIGH', 'Auth cookie', 'vibe_token not HttpOnly', 'Cookie should be HttpOnly', `HttpOnly=${vibeCookie.httpOnly}`);
      if (!vibeCookie.secure) bug('HIGH', 'Auth cookie', 'vibe_token not Secure', 'Cookie should be Secure', `Secure=${vibeCookie.secure}`);
    } else {
      log('AUTH-FLOW', 'vibe_token cookie NOT FOUND');
    }
  } else {
    bug('CRITICAL', '/register', 'Registration form fields missing', 'Form should have email, password, submit', 'Fields not found in DOM');
  }

  log('AUTH-FLOW', `Console errors: ${authErrors.length === 0 ? 'NONE' : JSON.stringify(authErrors)}`);

  // ============================================================
  // 11. DASHBOARD — after login
  // ============================================================
  log('DASHBOARD', '--- Тестирование кабинета ---');

  // Navigate to project sections
  for (const path of ['/projects', '/projects/new', '/domains', '/billing', '/settings']) {
    const pg = await authPage.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => null);
    log('DASHBOARD', `${path}: ${pg ? pg.status() : 'FAILED'} | Title: ${await authPage.title()}`);
    await authPage.screenshot({ path: `/root/vibecode/vibe-hosting/qa-screenshots/11-dashboard${path.replace(/\//g, '-')}.png` });
  }

  // ============================================================
  // 12. CREATE PROJECT FLOW
  // ============================================================
  log('PROJECT', '--- Тестирование создания проекта ---');
  await authPage.goto(`${BASE}/projects/new`, { waitUntil: 'networkidle', timeout: 15000 });

  const titleInput = await authPage.$('input[name="title"], input[placeholder*="название"], input[placeholder*="Название"]');
  const slugInput = await authPage.$('input[name="slug"], input[placeholder*="slug"]');
  log('PROJECT', `Title input: ${titleInput ? 'OK' : 'MISSING'}`);
  log('PROJECT', `Slug input: ${slugInput ? 'OK' : 'MISSING'}`);

  // Test slug validation - enter short slug
  if (slugInput) {
    await slugInput.fill('ab');
    await authPage.waitForTimeout(1500);
    const slugStatus = await authPage.$eval('[class*="slug"] [class*="status"], [class*="slug"] span, input[name="slug"] + *',
      el => el.textContent).catch(() => 'no status element');
    log('PROJECT', `Short slug 'ab' status: "${slugStatus}"`);

    if (slugStatus.includes('Занят')) {
      bug('LOW', '/projects/new', 'Short slug shows "Занят" instead of validation error',
        'Should show "Slug must be at least 3 characters"',
        `Shows "${slugStatus}" for 2-char slug`);
    }
  }

  await authPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/12-project-new.png' });

  // ============================================================
  // 13. MOBILE LOGIN FLOW
  // ============================================================
  log('MOBILE-LOGIN', '--- Тестирование мобильного логина ---');
  const mLoginPage = await mobileCtx.newPage();
  await mLoginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });

  // Check if cookie banner blocks login button
  const mLoginBtn = await mLoginPage.$('button[type="submit"]');
  if (mLoginBtn) {
    const btnBox = await mLoginBtn.boundingBox();
    log('MOBILE-LOGIN', `Login button position: y=${btnBox?.y}`);

    // Check cookie banner overlap
    const mBanner = await mLoginPage.$('[class*="fixed"][class*="bottom"]');
    if (mBanner) {
      const bannerBox = await mBanner.boundingBox();
      log('MOBILE-LOGIN', `Cookie banner: y=${bannerBox?.y}, height=${bannerBox?.height}`);
      if (btnBox && bannerBox && btnBox.y + btnBox.height > bannerBox.y) {
        bug('HIGH', 'Mobile /login', 'Cookie banner overlaps login button on mobile',
          'Cookie banner should not block login CTA',
          `Login btn at y=${btnBox.y}, banner at y=${bannerBox.y}`);
      }
    }
  }

  await mLoginPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/13-mobile-login.png' });

  // ============================================================
  // 14. 404 PAGE
  // ============================================================
  log('404', '--- Тестирование 404 страницы ---');
  const notFoundPage = await desktopCtx.newPage();
  const resp404 = await notFoundPage.goto(`${BASE}/nonexistent-page`, { waitUntil: 'networkidle', timeout: 15000 });
  log('404', `Status: ${resp404.status()}`);
  log('404', `Title: ${await notFoundPage.title()}`);

  const has404Text = await notFoundPage.$('text=404');
  const hasHomeLink = await notFoundPage.$('a[href="/"]');
  log('404', `404 text visible: ${has404Text !== null}`);
  log('404', `Home link: ${hasHomeLink !== null}`);

  await notFoundPage.screenshot({ path: '/root/vibecode/vibe-hosting/qa-screenshots/14-404.png' });

  // ============================================================
  // 15. ANCHOR NAVIGATION ON MAIN PAGE
  // ============================================================
  log('ANCHORS', '--- Тестирование якорной навигации ---');
  const anchorPage = await desktopCtx.newPage();
  await anchorPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  for (const anchor of ['#features', '#how', '#pricing', '#faq']) {
    const link = await anchorPage.$(`a[href="${anchor}"]`);
    if (link) {
      await link.click();
      await anchorPage.waitForTimeout(800);
      const scrollY = await anchorPage.evaluate(() => window.scrollY);
      log('ANCHORS', `${anchor}: clicked, scrollY=${scrollY} ${scrollY > 100 ? 'OK' : 'DID NOT SCROLL'}`);
    } else {
      log('ANCHORS', `${anchor}: link not found`);
    }
  }

  // ============================================================
  // 16. CHECK ALL INTERNAL LINKS FOR BROKEN ONES
  // ============================================================
  log('LINKS', '--- Проверка всех внутренних ссылок на главной ---');
  const allLinks = await anchorPage.$$eval('a[href]', els =>
    [...new Set(els.map(e => e.getAttribute('href')).filter(h => h && h.startsWith('/') && !h.startsWith('//')))
  ]);
  log('LINKS', `Unique internal paths: ${allLinks.length}`);

  for (const link of allLinks) {
    try {
      const r = await anchorPage.goto(`${BASE}${link}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const status = r ? r.status() : 'FAIL';
      if (status !== 200 && status !== 308) {
        log('LINKS', `BROKEN: ${link} -> ${status}`);
        bug('MEDIUM', 'Internal links', `Broken link: ${link} returns ${status}`,
          'All internal links should return 200', `${link} -> ${status}`);
      } else {
        log('LINKS', `OK: ${link} -> ${status}`);
      }
    } catch(e) {
      log('LINKS', `ERROR: ${link} -> ${e.message}`);
    }
  }

  // ============================================================
  // WRITE REPORT
  // ============================================================
  await browser.close();

  // Write results
  let report = `# QA Report - VibeHosting Manual Browser Testing\n`;
  report += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  report += `**URL:** ${BASE}\n`;
  report += `**Tool:** Playwright + Chromium (headless)\n`;
  report += `**Viewports:** Desktop 1440x900, Mobile 390x844\n\n`;

  report += `---\n\n## Bug Summary\n\n`;
  report += `**Total bugs found:** ${bugs.length}\n\n`;

  if (bugs.length > 0) {
    report += `| ID | Severity | Where | Title |\n|---|---|---|---|\n`;
    for (const b of bugs) {
      report += `| ${b.id} | ${b.severity} | ${b.where} | ${b.title} |\n`;
    }
    report += `\n`;

    for (const b of bugs) {
      report += `### ${b.id}: ${b.title}\n`;
      report += `- **Severity:** ${b.severity}\n`;
      report += `- **Where:** ${b.where}\n`;
      report += `- **Expected:** ${b.expected}\n`;
      report += `- **Actual:** ${b.actual}\n\n`;
    }
  }

  report += `---\n\n## Full Test Log\n\n`;
  report += '```\n' + results.join('\n') + '\n```\n';

  fs.writeFileSync('/root/vibecode/vibe-hosting/qa-browser-results.json', JSON.stringify({ results, bugs }, null, 2));
  fs.writeFileSync('/root/vibecode/vibe-hosting/QA_BROWSER_REPORT.md', report);

  console.log('\n\n=== DONE ===');
  console.log(`Bugs found: ${bugs.length}`);
  for (const b of bugs) {
    console.log(`  ${b.id} [${b.severity}] ${b.title}`);
  }
})();
