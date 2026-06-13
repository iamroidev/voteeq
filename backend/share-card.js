const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function escapeSvg(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadNomineePhotoBuffer(nominee, photosDir) {
  const localPath = path.join(photosDir, `${nominee.code}.jpg`);
  if (fs.existsSync(localPath)) {
    return sharp(localPath).rotate().toBuffer();
  }

  const url = nominee.photo_url;
  if (url && /^https?:\/\//i.test(url)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {
      console.warn('Share card: could not fetch nominee photo:', err.message);
    }
  }

  return null;
}

/**
 * 1200×630 PNG/JPEG card for WhatsApp/Facebook OG previews (SVG is not supported).
 */
async function generateShareCardImage(nominee, { photosDir, format = 'jpeg' } = {}) {
  const width = 1200;
  const height = 630;

  const composites = [];
  const photoBuf = await loadNomineePhotoBuffer(nominee, photosDir);
  if (photoBuf) {
    const portrait = await sharp(photoBuf)
      .resize(450, 530, { fit: 'cover' })
      .toBuffer();
    composites.push({ input: portrait, left: 50, top: 50 });
  }

  const name = escapeSvg((nominee.name || '').toUpperCase().slice(0, 48));
  const category = escapeSvg((nominee.category_name || '').toUpperCase().slice(0, 56));
  const code = escapeSvg(nominee.code || '');

  const overlaySvg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e0c0a"/>
      <stop offset="100%" stop-color="#241e18"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="47" y="47" width="456" height="536" rx="16" fill="none" stroke="#b8986c" stroke-width="4"/>
  <text x="560" y="110" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#b8986c" letter-spacing="3">OFFICIAL NOMINEE PROFILE</text>
  <text x="560" y="195" font-family="Georgia, serif" font-size="46" font-weight="700" fill="#ffffff">${name}</text>
  <text x="560" y="250" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="#8c8273" letter-spacing="2">CATEGORY</text>
  <text x="560" y="295" font-family="Georgia, serif" font-size="28" fill="#dfc49f">${category}</text>
  <rect x="560" y="360" width="550" height="150" rx="12" fill="#14110e" stroke="#b8986c" stroke-width="1.5"/>
  <text x="590" y="400" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#b8986c" letter-spacing="2">HOW TO VOTE</text>
  <text x="590" y="470" font-family="Courier New, monospace" font-size="34" font-weight="700" fill="#ffffff">*920*566*${code}#</text>
</svg>`);

  composites.push({ input: overlaySvg, left: 0, top: 0 });

  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 14, g: 12, b: 10 },
    },
  }).composite(composites);

  if (format === 'png') {
    return pipeline.png().toBuffer();
  }
  return pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

function resolveShareOgImage({ nominee, code, serverUrl, bannersDir, photosDir }) {
  const customBannerPath = path.join(bannersDir, `${code}.png`);
  if (fs.existsSync(customBannerPath)) {
    return { url: `${serverUrl}/banners/${code}.png`, type: 'image/png' };
  }

  const localPhoto = path.join(photosDir, `${code}.jpg`);
  if (fs.existsSync(localPhoto)) {
    return { url: `${serverUrl}/photos/${code}.jpg`, type: 'image/jpeg' };
  }

  if (nominee.photo_url && /^https?:\/\//i.test(nominee.photo_url)) {
    const lower = nominee.photo_url.toLowerCase();
    const type = lower.includes('.png') ? 'image/png' : 'image/jpeg';
    return { url: nominee.photo_url, type };
  }

  return { url: `${serverUrl}/api/nominees/share-card/${code}.jpg`, type: 'image/jpeg' };
}

module.exports = {
  generateShareCardImage,
  resolveShareOgImage,
};
