#!/usr/bin/env node
const bcrypt = require('/root/vibecode/vibe-hosting/backend/node_modules/bcrypt');
const { Client } = require('/root/vibecode/vibe-hosting/backend/node_modules/pg');
const fs = require('fs');
const path = require('path');

const SITES_DIR = '/var/www/vibe-hosting/sites';
const CASES_DIR = '/root/vibecode/vibe-hosting/cases';

const cases = [
  { slug: 'case-marketing', title: 'SPARK Agency — Вебинар', dir: 'marketing' },
  { slug: 'case-design', title: 'Анна Смирнова — UX/UI Дизайнер', dir: 'design' },
  { slug: 'case-dev', title: 'Дмитрий Козлов — Разработчик', dir: 'dev' },
  { slug: 'case-student', title: 'Алексей Волков — Портфолио студента', dir: 'students' },
  { slug: 'case-coffee', title: 'Brew & Co. — Кофейня', dir: 'business' },
  { slug: 'case-freelance', title: 'Pixelcraft Studio', dir: 'freelance' },
  { slug: 'autopro', title: 'AutoPro — Автосервис', dir: 'autoservice' },
  { slug: 'khlebnydom', title: 'Хлебный Дом — Пекарня', dir: 'bakery' },
  { slug: 'dentaclinic', title: 'ДентаКлиника — Стоматология', dir: 'dental' },
  { slug: 'florika', title: 'Флорика — Цветочная мастерская', dir: 'flowers' },
  { slug: 'raduga', title: 'Радуга — Детский центр', dir: 'kids-center' },
  { slug: 'alinamorozova', title: 'Алина Морозова — Фотограф', dir: 'photographer' },
  { slug: 'blackchair', title: 'The Black Chair — Барбершоп', dir: 'premium-barber' },
  { slug: 'bereg', title: 'Берег — Ресторан', dir: 'restaurant' },
  { slug: 'vetdom', title: 'ВетДом — Ветклиника', dir: 'vetclinic' },
  { slug: 'prana', title: 'Прана — Йога-студия', dir: 'yoga' },
];

async function main() {
  const client = new Client({
    connectionString: 'postgresql://vibe_user:cmy0OubFdb95MvoVxeHLucGHbLucuB23WzbgdaP9c@localhost:5432/vibe_hosting'
  });
  await client.connect();

  // 1. Create or get demo user
  const email = 'cases@hostingvibe.ru';
  const pwHash = bcrypt.hashSync('CaseDemo2026!', 10);

  let userId;
  const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    userId = existingUser.rows[0].id;
    // Upgrade to PRO so they can have multiple projects
    await client.query("UPDATE users SET plan = 'PRO', storage_limit = 1073741824 WHERE id = $1", [userId]);
    console.log('User exists:', userId);
  } else {
    const cuid = 'cm_cases_' + Date.now().toString(36);
    const res = await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, plan, storage_limit, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'PRO', 1073741824, NOW(), NOW()) RETURNING id`,
      [cuid, email, pwHash, 'VibeHosting Cases']
    );
    userId = res.rows[0].id;
    console.log('Created user:', userId);
  }

  // 2. Create projects
  for (const c of cases) {
    const existing = await client.query('SELECT id FROM projects WHERE slug = $1', [c.slug]);
    if (existing.rows.length > 0) {
      console.log(`Project ${c.slug} exists:`, existing.rows[0].id);
      // Update status to LIVE
      await client.query("UPDATE projects SET status = 'LIVE', published_at = NOW(), updated_at = NOW() WHERE slug = $1", [c.slug]);
    } else {
      const projId = 'cm_' + c.slug.replace(/-/g, '_') + '_' + Date.now().toString(36);
      await client.query(
        `INSERT INTO projects (id, user_id, slug, title, status, is_public, published_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'LIVE', true, NOW(), NOW(), NOW())`,
        [projId, userId, c.slug, c.title]
      );
      console.log(`Created project ${c.slug}:`, projId);
    }

    // 3. Deploy files
    const siteDir = path.join(SITES_DIR, c.slug);
    const srcDir = path.join(CASES_DIR, c.dir);
    const srcFile = path.join(srcDir, 'index.html');

    if (!fs.existsSync(srcFile)) {
      console.log(`WARNING: ${srcFile} does not exist yet, skipping deploy`);
      continue;
    }

    fs.mkdirSync(siteDir, { recursive: true });
    fs.copyFileSync(srcFile, path.join(siteDir, 'index.html'));
    fs.chmodSync(siteDir, 0o755);
    fs.chmodSync(path.join(siteDir, 'index.html'), 0o644);
    console.log(`Deployed ${c.slug} -> ${siteDir}`);
  }

  await client.end();
  console.log('\nDone! All cases set up.');
}

main().catch(e => { console.error(e); process.exit(1); });
