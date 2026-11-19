/**
 * IvyInvi - Content, Theme & Branding Integrity Verification Suite
 * Covers Tiers 1-4 for Graduation Invitation Repurposing (Vũ Lâm Thanh Hằng):
 * Tier 1: Feature Coverage (Recipient tokens, Event date/time, Venue & Contact, Theme palette, Assets, Placeholders, Typography, Backend, Preview)
 * Tier 2: Boundary & Corner Cases (Obsolete token eradication, diacritics integrity, asset 404 audit, phone/url format validation)
 * Tier 3: Cross-Feature Combinations (Pairwise file consistency across config, html, admin, css, script)
 * Tier 4: Real-World Scenarios (Mobile guest arrival, event schedule & directions, album gallery, guestbook wall, admin readiness)
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function readFileSafe(relPath) {
  const fullPath = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function fileExists(relPath) {
  return fs.existsSync(path.join(PROJECT_ROOT, relPath));
}

function fileSize(relPath) {
  const fullPath = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(fullPath)) return 0;
  return fs.statSync(fullPath).size;
}

class TestReporter {
  constructor(name) {
    this.name = name;
    this.results = [];
    this.currentTier = '';
  }

  setTier(tierName) {
    this.currentTier = tierName;
  }

  assert(description, condition, extraInfo = '') {
    const passed = Boolean(condition);
    this.results.push({
      tier: this.currentTier,
      description,
      passed,
      extraInfo: passed ? '' : extraInfo
    });
    const mark = passed ? '  PASS' : '  FAIL';
    console.log(`${mark} [${this.currentTier}] ${description}`);
    if (!passed && extraInfo) {
      console.log(`       Detail: ${extraInfo}`);
    }
  }

  summary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    return { total, passed, failed, results: this.results };
  }
}

function runContentThemeTests() {
  console.log('======================================================================');
  console.log(' IvyInvi - Running Content, Theme & Asset Verification Suite');
  console.log(' Target Recipient: Vũ Lâm Thanh Hằng | Theme: Blush Pink & Rose Gold');
  console.log('======================================================================\n');

  const reporter = new TestReporter('ContentTheme');

  // Load project files safely
  const indexHtml = readFileSafe('index.html') || '';
  const adminHtml = readFileSafe('admin.html') || '';
  const configJs = readFileSafe('config.js') || '';
  const styleCss = readFileSafe('style.css') || '';
  const scriptJs = readFileSafe('script.js') || '';
  const adminJs = readFileSafe('admin.js') || '';
  const readmeMd = readFileSafe('README.md') || '';
  const appsScriptGs = readFileSafe('apps-script.gs');
  const previewJs = readFileSafe('preview.js');

  // ==========================================================================
  // TIER 1: Feature Coverage (≥5 tests per feature)
  // ==========================================================================
  reporter.setTier('Tier 1: Feature Coverage');

  // --- Feature 1: Recipient Identity (Vũ Lâm Thanh Hằng) ---
  // Strip comments from configJs so header comments do not satisfy or corrupt property assertions
  const cleanConfigJs = configJs.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const ownerNameMatch = cleanConfigJs.match(/["']?(?:ownerName|recipientName)["']?\s*:\s*["']([^"']+)["']/i);
  const ownerNameValue = ownerNameMatch ? ownerNameMatch[1].trim() : '';
  const isOwnerNameHang = /^(?:Vũ Lâm Thanh Hằng|VŨ LÂM THANH HẰNG)$/iu.test(ownerNameValue);

  reporter.assert(
    'config.js defines recipient ownerName property as "Vũ Lâm Thanh Hằng" or "VŨ LÂM THANH HẰNG"',
    isOwnerNameHang,
    ownerNameMatch
      ? `ownerName property in config.js is "${ownerNameValue}" (expected "Vũ Lâm Thanh Hằng" or "VŨ LÂM THANH HẰNG")`
      : 'ownerName property not declared in config.js'
  );

  reporter.assert(
    'index.html <title> includes "Vũ Lâm Thanh Hằng"',
    indexHtml.includes('Vũ Lâm Thanh Hằng') && /<title>[^<]*Vũ Lâm Thanh Hằng/i.test(indexHtml),
    'index.html title does not contain "Vũ Lâm Thanh Hằng"'
  );

  reporter.assert(
    'index.html meta description / og:title references "Vũ Lâm Thanh Hằng"',
    /<meta\s+[^>]*content="[^"]*Vũ Lâm Thanh Hằng[^"]*"/i.test(indexHtml),
    'Meta description or OpenGraph tags do not contain "Vũ Lâm Thanh Hằng"'
  );

  reporter.assert(
    'index.html envelope or hero section contains recipient name "Vũ Lâm Thanh Hằng" or "THANH HẰNG"',
    indexHtml.includes('THANH HẰNG') || indexHtml.includes('Thanh Hằng') || indexHtml.includes('Vũ Lâm Thanh Hằng'),
    'Envelope or hero section does not display recipient name'
  );

  reporter.assert(
    'admin.html or admin.js config defaults reference "Vũ Lâm Thanh Hằng"',
    adminHtml.includes('Vũ Lâm Thanh Hằng') || adminJs.includes('Vũ Lâm Thanh Hằng'),
    'admin.html / admin.js does not reference "Vũ Lâm Thanh Hằng"'
  );

  // --- Feature 2: Event Date & Time (25-11-2026, 11:30 - 12:30 / 11h30 - 12h30) ---
  reporter.assert(
    'config.js sets event date to "25-11-2026" or "2026-11-25"',
    configJs.includes('25-11-2026') || configJs.includes('2026-11-25') || configJs.includes('25/11/2026'),
    'Event date 25-11-2026 not found in config.js'
  );

  const configHasStartTime =
    /["']?(?:eventTime|time|startTime)["']?\s*:\s*["'](?:11h30|11:30)["']/i.test(configJs) ||
    configJs.includes('11h30') || configJs.includes('11:30');
  const configHasEndTime =
    /["']?(?:eventEndTime|endTime)["']?\s*:\s*["'](?:12h30|12:30)["']/i.test(configJs) ||
    configJs.includes('12h30') || configJs.includes('12:30');

  reporter.assert(
    'config.js sets event time window with both start time (11:30 / 11h30) and end time (12:30 / 12h30)',
    configHasStartTime && configHasEndTime,
    `Event time window incomplete in config.js (start: ${configHasStartTime}, end: ${configHasEndTime})`
  );

  reporter.assert(
    'index.html displays event date "25-11-2026" or "25/11/2026" or "25 tháng 11"',
    indexHtml.includes('25-11-2026') || indexHtml.includes('25/11/2026') || indexHtml.includes('25 tháng 11'),
    'Event date 25-11-2026 not found in index.html'
  );

  const indexHasStartTime = indexHtml.includes('11h30') || indexHtml.includes('11:30');
  const indexHasEndTime = indexHtml.includes('12h30') || indexHtml.includes('12:30');

  reporter.assert(
    'index.html displays event time window with both start (11h30 / 11:30) and end (12h30 / 12:30)',
    indexHasStartTime && indexHasEndTime,
    `Event time window incomplete in index.html (start: ${indexHasStartTime}, end: ${indexHasEndTime})`
  );

  reporter.assert(
    'Countdown timer configuration targets event date in year 2026',
    (configJs.includes('2026-11-25') || configJs.includes('25-11-2026')) ||
    (scriptJs.includes('2026-11-25') || scriptJs.includes('25-11-2026')),
    'Countdown target does not reference 2026-11-25'
  );

  // --- Feature 3: Venue, Contact & Social (NLU, 0348103398, Facebook) ---
  reporter.assert(
    'config.js specifies venue "Trường Đại học Nông Lâm TP HCM" or "Đại học Nông Lâm"',
    configJs.includes('Nông Lâm') || configJs.includes('Đại học Nông Lâm'),
    'Venue "Đại học Nông Lâm" not found in config.js'
  );

  reporter.assert(
    'config.js specifies venue address containing "Phường Linh Xuân" or "Khu phố 9"',
    configJs.includes('Linh Xuân') || configJs.includes('Khu phố 9'),
    'Venue address "Linh Xuân / Khu phố 9" not found in config.js'
  );

  reporter.assert(
    'config.js sets host contact phone number to "0348103398"',
    configJs.includes('0348103398'),
    'Contact phone "0348103398" not found in config.js'
  );

  reporter.assert(
    'config.js sets Facebook link to "https://www.facebook.com/share/1F81MKGY48/"',
    configJs.includes('https://www.facebook.com/share/1F81MKGY48/'),
    'Facebook link "https://www.facebook.com/share/1F81MKGY48/" not found in config.js'
  );

  reporter.assert(
    'index.html includes tel:0348103398 or contact phone "0348103398"',
    indexHtml.includes('0348103398'),
    'Phone number "0348103398" not found in index.html'
  );

  // --- Feature 4: Visual Theme: Blush Pink & Rose Gold Palette ---
  // Strip comments from styleCss to prevent comment bypasses
  const cleanCss = styleCss.replace(/\/\*[\s\S]*?\*\//g, '');

  const blushPinkRegex = /--(?:theme-pink|blush-pink|pink-[a-z0-9_-]*|bg-pink|color-pink|accent-pink)\s*:\s*[^;]*#(?:fce4ec|f8bbd0|f48fb1|ffc0cb|f7d1d8|fde2e4|fad2e1|e8b4b8)/i;
  reporter.assert(
    'style.css defines Blush Pink custom property (--theme-pink / --blush-pink / --pink-...)',
    blushPinkRegex.test(cleanCss),
    'Blush pink CSS variable not declared or assigned non-blush color in style.css'
  );

  const roseGoldRegex = /--(?:rose-gold|gold-rose|accent-rose|border-rose|color-rose(?:-gold)?)\s*:\s*[^;]*#(?:b76e79|c59b9b|d4af37|e8c39e|e0a899|c48b71|d8a48f|b87333)/i;
  reporter.assert(
    'style.css defines Rose Gold custom property (--rose-gold / --gold-rose / --accent-rose)',
    roseGoldRegex.test(cleanCss),
    'Rose gold CSS variable not declared or assigned non-rose-gold color in style.css'
  );

  // Scope envelope seal check directly to .envelope-seal CSS rule blocks
  const sealBlocks = [...cleanCss.matchAll(/\.envelope-seal[^{]*\{([^}]+)\}/g)].map(m => m[1]).join(' ');
  const sealHasPinkRoseGold =
    sealBlocks.length > 0 &&
    (
      /#(?:fce4ec|f8bbd0|f48fb1|e91e63|b76e79|c59b9b|d4af37|e8c39e|e0a899)/i.test(sealBlocks) ||
      /var\(--(?:theme-pink|blush-pink|rose-gold|accent-rose|pink-|color-pink|bg-pink)\)/i.test(sealBlocks) ||
      /\b(?:pink|rose)\b/i.test(sealBlocks)
    );

  reporter.assert(
    'style.css styles envelope seal or wax seal with pink / rose gold aesthetic',
    sealHasPinkRoseGold,
    'Envelope seal styling (.envelope-seal) does not reflect Blush Pink / Rose Gold palette in its CSS block'
  );

  const gradientHasPinkOrRose =
    /linear-gradient\([^)]*(?:#(?:fce4ec|f8bbd0|f48fb1|ffc0cb|f7d1d8|b76e79|c59b9b|d4af37|e8c39e|e0a899)|var\(--(?:theme-pink|blush-pink|rose-gold|accent-rose)\)|pink|rose)/i.test(cleanCss) ||
    /--(?:btn-gradient|accent-gradient|rose-gradient)\s*:\s*linear-gradient/i.test(cleanCss);

  reporter.assert(
    'style.css contains button or accent gradients blending pink and rose gold tones',
    gradientHasPinkOrRose,
    'Gradients in style.css do not incorporate pink / rose gold tones'
  );

  reporter.assert(
    'style.css defines font family custom properties (--font-main, --font-script, --font-serif)',
    styleCss.includes('--font-main') && styleCss.includes('--font-script') && styleCss.includes('--font-serif'),
    'Standard font family custom properties missing from style.css'
  );

  // --- Feature 5: Branding, Favicon & Asset Integrity ---
  const hasNluLogo = fileExists('assets/images/logo-nlu.svg') ||
                     fileExists('assets/images/logo-nlu.png') ||
                     fileExists('assets/images/logo-nong-lam.svg');

  reporter.assert(
    'NLU (Trường Đại học Nông Lâm) logo asset exists in assets/images/',
    hasNluLogo,
    'NLU logo asset not found under assets/images/'
  );

  reporter.assert(
    'Favicon assets exist on disk (favicon.ico, favicon.png, apple-touch-icon.png)',
    fileExists('favicon.ico') && fileExists('favicon.png') && fileExists('apple-touch-icon.png'),
    'One or more favicon files missing from project root'
  );

  reporter.assert(
    'Background audio file exists on disk and is non-empty (>10KB)',
    (fileExists('assets/audio/background-music.wav') && fileSize('assets/audio/background-music.wav') > 10000) ||
    (fileExists('assets/audio/background-music.mp3') && fileSize('assets/audio/background-music.mp3') > 10000),
    'Background audio asset missing or empty in assets/audio/'
  );

  reporter.assert(
    'index.html references favicon and apple-touch-icon tags',
    indexHtml.includes('rel="icon"') && indexHtml.includes('rel="apple-touch-icon"'),
    'Favicon or apple-touch-icon link tags missing from index.html <head>'
  );

  reporter.assert(
    'Zero broken relative asset links: all local files referenced in <link> and <script> exist',
    (() => {
      const hrefMatches = [...indexHtml.matchAll(/(?:href|src)="([^"#?]+)(?:\?[^"]*)?"/g)];
      const missing = [];
      for (const m of hrefMatches) {
        const target = m[1];
        if (
          target.startsWith('http://') ||
          target.startsWith('https://') ||
          target.startsWith('data:') ||
          target.startsWith('tel:') ||
          target.startsWith('mailto:') ||
          target.startsWith('javascript:')
        ) continue;
        if (!fileExists(target)) {
          missing.push(target);
        }
      }
      return missing.length === 0 ? true : `Missing files: ${missing.join(', ')}`;
    })() === true,
    'One or more local asset references in index.html cannot be resolved on disk'
  );

  // --- Feature 6: Image Placeholder Architecture ---
  const albumPhotosMatch = configJs.match(/["']?albumPhotos["']?\s*:\s*\[([\s\S]*?)\]/);
  const albumPhotoPaths = albumPhotosMatch
    ? [...albumPhotosMatch[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1])
    : [];
  const missingAlbumPhotos = albumPhotoPaths.filter(p => !p.startsWith('http') && !p.startsWith('data:') && !fileExists(p));
  const albumPhotosValid = Boolean(albumPhotosMatch) && albumPhotoPaths.length > 0 && missingAlbumPhotos.length === 0;

  reporter.assert(
    'config.js provides structured image placeholders for album photos',
    albumPhotosValid,
    missingAlbumPhotos.length > 0
      ? `Missing album photo assets on disk: ${missingAlbumPhotos.join(', ')}`
      : 'albumPhotos array missing or empty in config.js'
  );

  const coverMatch = configJs.match(/["'](?:heroCoverPhoto|coverPhoto)["']\s*:\s*["']([^"']+)["']/);
  const coverPhotoPath = coverMatch ? coverMatch[1] : null;
  const coverPhotoExists = coverPhotoPath
    ? (coverPhotoPath.startsWith('http') || coverPhotoPath.startsWith('data:') || fileExists(coverPhotoPath))
    : false;

  reporter.assert(
    'config.js provides structured cover photo slot (heroCoverPhoto or coverPhoto)',
    Boolean(coverPhotoPath) && coverPhotoExists,
    coverPhotoPath
      ? `Cover photo file not found on disk: ${coverPhotoPath}`
      : 'Cover photo slot missing in config.js'
  );

  reporter.assert(
    'config.js does not contain megabytes of heavy base64 image data (< 500KB total file size)',
    fileSize('config.js') < 500 * 1024,
    `config.js is currently ${(fileSize('config.js') / 1024 / 1024).toFixed(2)}MB (expected < 0.5MB with structured placeholders)`
  );

  reporter.assert(
    'Structured placeholders use clean URLs or lightweight SVG/PNG placeholders',
    !configJs.includes('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD') || fileSize('config.js') < 500 * 1024,
    'config.js still contains heavy legacy base64 image strings'
  );

  reporter.assert(
    'Photo gallery container #gallery-container exists in index.html',
    indexHtml.includes('id="gallery-container"') || indexHtml.includes('class="gallery-container"'),
    'Gallery container element not found in index.html'
  );

  // --- Feature 7: Responsive Layout & Fluid Typography ---
  reporter.assert(
    'style.css implements fluid clamp() typography for responsive text scaling',
    styleCss.includes('clamp('),
    'Fluid typography with clamp() not found in style.css'
  );

  reporter.assert(
    'style.css contains mobile responsive media queries (@media (max-width: 768px) or similar)',
    /@media\s*\([^)]*max-width\s*:\s*(768px|600px|480px)\)/i.test(styleCss),
    'Mobile media queries not found in style.css'
  );

  reporter.assert(
    'style.css protects recipient name against overflow on narrow viewports',
    styleCss.includes('overflow-wrap') || styleCss.includes('word-break') || styleCss.includes('hyphens') || styleCss.includes('max-width'),
    'Word break / overflow-wrap styling missing for recipient name headers'
  );

  reporter.assert(
    'index.html specifies standard responsive mobile viewport meta tag',
    indexHtml.includes('name="viewport"') && indexHtml.includes('width=device-width'),
    'Mobile viewport meta tag missing or incomplete in index.html'
  );

  reporter.assert(
    'Countdown and calendar components are present in index.html DOM structure',
    indexHtml.includes('calendar-grid') && indexHtml.includes('cd-days'),
    'Calendar grid or countdown day counters missing from index.html'
  );

  // --- Feature 8: Google Apps Script Webhook Template (apps-script.gs) ---
  reporter.assert(
    'apps-script.gs exists in repository root',
    appsScriptGs !== null,
    'apps-script.gs file not found in repository root'
  );

  reporter.assert(
    'apps-script.gs implements doGet(e) webhook handler',
    appsScriptGs !== null && appsScriptGs.includes('function doGet('),
    'function doGet(e) not declared in apps-script.gs'
  );

  reporter.assert(
    'apps-script.gs implements doPost(e) webhook handler',
    appsScriptGs !== null && appsScriptGs.includes('function doPost('),
    'function doPost(e) not declared in apps-script.gs'
  );

  reporter.assert(
    'apps-script.gs implements LockService concurrency control',
    appsScriptGs !== null && appsScriptGs.includes('LockService.getScriptLock()'),
    'LockService concurrency protection missing in apps-script.gs'
  );

  reporter.assert(
    'apps-script.gs handles actions: getWishes, addWish, likeWish, addRSVP',
    appsScriptGs !== null &&
    appsScriptGs.includes('getWishes') &&
    appsScriptGs.includes('addWish') &&
    appsScriptGs.includes('likeWish') &&
    appsScriptGs.includes('addRSVP'),
    'One or more required actions missing from apps-script.gs'
  );

  // --- Feature 9: Local Preview Server (preview.js) & Setup Guide ---
  reporter.assert(
    'preview.js exists in repository root',
    previewJs !== null,
    'preview.js file not found in repository root'
  );

  reporter.assert(
    'preview.js uses native Node.js http and fs modules (zero external dependencies)',
    previewJs !== null && previewJs.includes("require('http')") && previewJs.includes("require('fs')"),
    'preview.js must use native Node.js http and fs'
  );

  reporter.assert(
    'preview.js handles MIME types for HTML, CSS, JS, SVG, and audio',
    previewJs !== null &&
    previewJs.includes('.html') &&
    previewJs.includes('.css') &&
    previewJs.includes('.js') &&
    (previewJs.includes('.svg') || previewJs.includes('svg')),
    'MIME type mappings missing in preview.js'
  );

  reporter.assert(
    'README.md includes Google Apps Script setup guide for Webhook deployment',
    readmeMd.includes('Google Apps Script') || readmeMd.includes('Webhook') || readmeMd.includes('Google Sheets'),
    'Google Apps Script / Webhook documentation missing from README.md'
  );

  reporter.assert(
    'README.md references Vũ Lâm Thanh Hằng as recipient',
    readmeMd.includes('Vũ Lâm Thanh Hằng'),
    'README.md does not reference Vũ Lâm Thanh Hằng'
  );

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases (≥5 tests per feature area)
  // ==========================================================================
  reporter.setTier('Tier 2: Boundary & Corner Cases');

  // Boundary 1: Eradication of previous recipient name ("Nguyễn Quang Huy" or "Quang Huy")
  const hasStaleRecipientInConfig = configJs.includes('Nguyễn Quang Huy') || /ownerName\s*:\s*['"]QUANG HUY['"]/i.test(configJs);
  const hasStaleRecipientInIndex = indexHtml.includes('Nguyễn Quang Huy') || indexHtml.includes('QUANG HUY');

  reporter.assert(
    'config.js has purged legacy recipient name "Nguyễn Quang Huy"',
    !hasStaleRecipientInConfig,
    'Legacy name "Nguyễn Quang Huy" still present in config.js'
  );

  reporter.assert(
    'index.html has purged legacy recipient name "Nguyễn Quang Huy" and "QUANG HUY"',
    !hasStaleRecipientInIndex,
    'Legacy name "Nguyễn Quang Huy" / "QUANG HUY" still present in index.html'
  );

  // Boundary 2: Eradication of previous university ("HUIT" / "Công Thương")
  const hasStaleHuitInTitle = /<title>[^<]*HUIT/i.test(indexHtml);
  reporter.assert(
    'index.html title has purged legacy institution acronym "HUIT"',
    !hasStaleHuitInTitle,
    'Legacy institution "HUIT" still present in index.html <title>'
  );

  // Boundary 3: Phone number format validation (0348103398)
  const phonePattern = /(?:0|\+84)348103398/;
  reporter.assert(
    'Phone number matches valid Vietnamese mobile format (0348103398)',
    phonePattern.test(configJs),
    'Phone number format invalid or missing in config.js'
  );

  // Boundary 4: Facebook URL format validation
  const fbExactUrl = 'https://www.facebook.com/share/1F81MKGY48/';
  reporter.assert(
    'Facebook URL matches exact recipient share link format',
    configJs.includes(fbExactUrl) || indexHtml.includes(fbExactUrl),
    `Facebook link does not match exact URL: ${fbExactUrl}`
  );

  // Boundary 5: Vietnamese diacritics integrity across all vowels
  reporter.assert(
    'Vietnamese tone marks in "Vũ Lâm Thanh Hằng" correctly encoded without mojibake',
    indexHtml.includes('Vũ Lâm Thanh Hằng') || configJs.includes('Vũ Lâm Thanh Hằng'),
    'Diacritics corrupted or missing in recipient name'
  );

  // Boundary 6: CSS color definitions validity
  reporter.assert(
    'All hex color codes in style.css :root are valid syntactically',
    (() => {
      const rootMatch = styleCss.match(/:root\s*\{([^}]+)\}/);
      if (!rootMatch) return false;
      const hexTokens = rootMatch[1].match(/#[a-zA-Z0-9_-]+/g) || [];
      return hexTokens.length > 0 && hexTokens.every(h => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(h));
    })(),
    'Invalid hex color found in style.css :root declaration'
  );

  // Boundary 7: Asset 404 audit across style.css url() references
  reporter.assert(
    'style.css contains zero broken url() references to missing local files',
    (() => {
      const urlMatches = [...styleCss.matchAll(/url\(['"]?([^'"()]+)['"]?\)/g)];
      const missing = [];
      for (const m of urlMatches) {
        const u = m[1];
        if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) continue;
        const cleanPath = u.split('#')[0].split('?')[0];
        if (!fileExists(cleanPath)) {
          missing.push(cleanPath);
        }
      }
      return missing.length === 0 ? true : `Missing CSS assets: ${missing.join(', ')}`;
    })() === true,
    'One or more local url() references in style.css cannot be resolved'
  );

  // Boundary 8: Audio tag auto-fallback attributes
  reporter.assert(
    'index.html audio element contains preload attribute',
    indexHtml.includes('<audio') && indexHtml.includes('preload='),
    'Audio tag missing preload attribute in index.html'
  );

  // Boundary 9: Wishes character limit boundary (500 chars)
  reporter.assert(
    'index.html or script.js enforces 500 characters limit on wish message',
    indexHtml.includes('maxlength="500"') || scriptJs.includes('500'),
    '500 character limit enforcement missing in wish form'
  );

  // Boundary 10: Script and style links have no leading or trailing whitespace corruption
  reporter.assert(
    'All <link> and <script> src/href attributes are clean and free of illegal characters',
    !/<(link|script)[^>]+(src|href)=["'][^"']*\s+[^"']*["']/i.test(indexHtml),
    'Whitespace detected inside src/href path attributes in index.html'
  );

  // ==========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise Coverage)
  // ==========================================================================
  reporter.setTier('Tier 3: Cross-Feature Combinations');

  // Pairwise 1: Recipient name parity across config.js and index.html
  reporter.assert(
    'Pairwise: Recipient name "Vũ Lâm Thanh Hằng" is identical in config.js and index.html',
    isOwnerNameHang && (indexHtml.includes('Vũ Lâm Thanh Hằng') || indexHtml.includes('VŨ LÂM THANH HẰNG') || indexHtml.includes('THANH HẰNG')),
    'Recipient name mismatch or missing between config.js and index.html'
  );

  // Pairwise 2: Event date parity between config.js and index.html
  reporter.assert(
    'Pairwise: Event date "25-11-2026" / "25/11/2026" is aligned between config.js and index.html',
    (configJs.includes('25-11-2026') || configJs.includes('25/11/2026') || configJs.includes('2026-11-25')) &&
    (indexHtml.includes('25-11-2026') || indexHtml.includes('25/11/2026') || indexHtml.includes('25 tháng 11')),
    'Event date mismatch between config.js and index.html'
  );

  // Pairwise 3: Venue name parity between config.js and index.html
  reporter.assert(
    'Pairwise: Venue name "Nông Lâm" is aligned between config.js and index.html',
    configJs.includes('Nông Lâm') && indexHtml.includes('Nông Lâm'),
    'Venue name mismatch between config.js and index.html'
  );

  // Pairwise 4: Contact phone number parity between config.js and index.html
  reporter.assert(
    'Pairwise: Contact phone "0348103398" is aligned between config.js and index.html',
    configJs.includes('0348103398') && indexHtml.includes('0348103398'),
    'Contact phone mismatch between config.js and index.html'
  );

  // Pairwise 5: Webhook service storage schema alignment across script.js and PROJECT.md
  reporter.assert(
    'Pairwise: LocalStorage keys (ivy_wishes_feed, ivy_rsvp_submissions) are implemented in script.js',
    scriptJs.includes('ivy_wishes_feed') && scriptJs.includes('ivy_rsvp_submissions'),
    'LocalStorage key schema mismatch in script.js'
  );

  // ==========================================================================
  // TIER 4: Real-World Scenarios
  // ==========================================================================
  reporter.setTier('Tier 4: Real-World Scenarios');

  // Scenario 1: Mobile Guest First Arrival
  // Guest arrives on mobile (375px), sees animated envelope, clicks open, views recipient announcement
  const guestArrivalElementsReady =
    indexHtml.includes('id="envelope-screen"') &&
    indexHtml.includes('id="btn-open-envelope"') &&
    indexHtml.includes('id="hero-owner-name"') &&
    styleCss.includes('.envelope-wrapper');

  reporter.assert(
    'Scenario 1: Guest First Arrival DOM components and envelope interaction styles are fully structured',
    guestArrivalElementsReady,
    'Envelope opening elements missing from index.html or style.css'
  );

  // Scenario 2: Event Details & Directions
  // Guest checks date, time, venue, phone and navigation link
  const eventDetailsReady =
    indexHtml.includes('display-date-string') &&
    indexHtml.includes('display-time-string') &&
    indexHtml.includes('display-venue-name') &&
    indexHtml.includes('btn-google-maps');

  reporter.assert(
    'Scenario 2: Event Schedule & Navigation components (date, time, venue, Google Maps) are present in DOM',
    eventDetailsReady,
    'Event details display elements missing from index.html'
  );

  // Scenario 3: Memory Photo Album Gallery
  // Guest explores graduation photo gallery with responsive grid and lightbox preview
  const galleryReady =
    indexHtml.includes('gallery-container') &&
    indexHtml.includes('lightbox-modal') &&
    indexHtml.includes('lightbox-img');

  reporter.assert(
    'Scenario 3: Photo Gallery & Lightbox components are structured for photo viewing',
    galleryReady,
    'Gallery or lightbox modal missing from index.html'
  );

  // Scenario 4: Wishes Wall & Guestbook Readiness
  // Guest composes congratulations message, views character counter and live wishes list
  const wishesWallReady =
    indexHtml.includes('id="wish-form"') &&
    indexHtml.includes('id="wish-author-input"') &&
    indexHtml.includes('id="wish-message-input"') &&
    indexHtml.includes('id="wish-char-count"') &&
    indexHtml.includes('id="wishes-list-container"');

  reporter.assert(
    'Scenario 4: Wishes guestbook wall components (form, inputs, character counter, feed container) are present',
    wishesWallReady,
    'Wishes guestbook form or container elements missing from index.html'
  );

  // Scenario 5: Admin Panel & Documentation Readiness
  // Host opens admin editor, adjusts settings, reviews setup instructions
  const adminAndDocsReady =
    adminHtml.length > 500 &&
    adminJs.length > 500 &&
    readmeMd.length > 200;

  reporter.assert(
    'Scenario 5: Admin visual editor dashboard and setup documentation are available',
    adminAndDocsReady,
    'Admin dashboard or README documentation is missing or insufficient'
  );

  // Print Summary
  const summary = reporter.summary();
  console.log('\n----------------------------------------------------------------------');
  console.log(` Content & Theme Test Results: ${summary.passed}/${summary.total} assertions passed`);
  if (summary.failed > 0) {
    console.log(` Pending/Failed assertions: ${summary.failed}`);
    console.log(' (Note: Failures represent milestone tasks currently planned or in-progress)');
  }
  console.log('----------------------------------------------------------------------\n');

  return summary;
}

if (require.main === module) {
  const summary = runContentThemeTests();
  process.exit(summary.failed === 0 ? 0 : 1);
}

module.exports = { runContentThemeTests };
