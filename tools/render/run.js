// Render asset 3D -> public/assets (chạy: npm run render-assets [temple|sprites])
const path = require('path');
const fs = require('fs');
const express = require('express');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'public', 'assets');
// job: temple (cảnh 3D) | sprites:3d (người cho cảnh 3D, nhìn xuống 38°) | sprites:ai (người cho nền AI, nhìn xuống 20°)
const jobs = process.argv.slice(2).length ? process.argv.slice(2) : ['temple', 'sprites:3d', 'sprites:ai'];
const SPRITE_PITCH = { '3d': 38, ai: 20 };

function saveDataUrl(file, url) {
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('  wrote', path.relative(ROOT, file));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = express();
  app.use('/three', express.static(path.join(ROOT, 'node_modules', 'three')));
  app.use('/', express.static(__dirname));
  const server = app.listen(0);
  const port = server.address().port;

  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const job of jobs) {
      console.log(`[render] ${job}...`);
      const t0 = Date.now();
      const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [page]', m.text()); });
      page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
      const [name, variant = '3d'] = job.split(':');
      const outDir = path.join(OUT, name === 'temple' ? '3d' : variant);
      fs.mkdirSync(outDir, { recursive: true });
      await page.goto(`http://localhost:${port}/index.html?job=${name}&pitch=${SPRITE_PITCH[variant] || 38}`);
      await page.waitForFunction(() => window.__done === true, null, { timeout: 30 * 60 * 1000, polling: 500 });
      const err = await page.evaluate(() => window.__error);
      if (err) throw new Error(err);
      const res = await page.evaluate(() => window.__result);
      if (name === 'temple') {
        saveDataUrl(path.join(outDir, 'background.png'), res.png);
        fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify(res.layout, null, 1));
        
      } else if (name === 'sprites') {
        res.sheets.forEach((url, i) => saveDataUrl(path.join(outDir, `people_${i}.png`), url));
        fs.writeFileSync(path.join(outDir, 'sprites.json'), JSON.stringify(res.meta, null, 1));
        
      }
      console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
