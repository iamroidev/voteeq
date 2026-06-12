import { useState, useRef, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { BRANDING, getNomineeVoteUrl, formatVotePricingLine } from '../branding';

const WHATSAPP_STATUS_W = 1080;
const WHATSAPP_STATUS_H = 1920;

function drawPhotoAreaWatermark(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(w * 0.085)}px "Space Grotesk", sans-serif`;
  ctx.translate(x + w * 0.5, y + h * 0.4);
  ctx.rotate(-Math.PI / 7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(BRANDING.platformName.toUpperCase(), 0, 0);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(x + 20, y + h - 54, 210, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Powered by ${BRANDING.platformName}`, x + 32, y + h - 35);
  ctx.restore();
}

function loadCoverPhoto(ctx, photoUrl, imgOffset, photoFilter, x, y, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const imgRatio = img.width / img.height;
      const targetRatio = w / h;
      let drawW = w * imgOffset.scale;
      let drawH = h * imgOffset.scale;
      if (imgRatio > targetRatio) {
        drawW = h * imgRatio * imgOffset.scale;
      } else {
        drawH = (w / imgRatio) * imgOffset.scale;
      }
      const cx = x + w / 2 + imgOffset.x;
      const cy = y + h / 2 + imgOffset.y;
      if (photoFilter === 'grayscale') ctx.filter = 'grayscale(100%) contrast(1.15)';
      else if (photoFilter === 'sepia') ctx.filter = 'sepia(80%) contrast(1.05)';
      else ctx.filter = 'none';
      ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
      ctx.filter = 'none';
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = photoUrl;
  });
}

async function buildWhatsAppStatusCanvas({ photoUrl, imgOffset, photoFilter, nominee, accent, bgStyle, backgroundOptions, shareUrl }) {
  const canvas = document.createElement('canvas');
  canvas.width = WHATSAPP_STATUS_W;
  canvas.height = WHATSAPP_STATUS_H;
  const ctx = canvas.getContext('2d');
  const activeBg = backgroundOptions.find((b) => b.id === bgStyle) || backgroundOptions[0];
  const photoH = Math.round(WHATSAPP_STATUS_H * 0.58);
  const panelY = photoH;

  ctx.fillStyle = '#141312';
  ctx.fillRect(0, 0, WHATSAPP_STATUS_W, photoH);
  if (photoUrl) {
    await loadCoverPhoto(ctx, photoUrl, imgOffset, photoFilter, 0, 0, WHATSAPP_STATUS_W, photoH);
    drawPhotoAreaWatermark(ctx, 0, 0, WHATSAPP_STATUS_W, photoH);
  } else {
    ctx.fillStyle = '#2a2927';
    ctx.fillRect(0, 0, WHATSAPP_STATUS_W, photoH);
    ctx.fillStyle = '#8c8273';
    ctx.font = '400 28px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.fillText('UPLOAD PORTRAIT PHOTO', WHATSAPP_STATUS_W / 2, photoH / 2);
    ctx.textAlign = 'left';
  }

  const fade = ctx.createLinearGradient(0, photoH - 140, 0, photoH);
  fade.addColorStop(0, 'transparent');
  fade.addColorStop(1, activeBg.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, photoH - 140, WHATSAPP_STATUS_W, 140);

  ctx.fillStyle = activeBg.bg;
  ctx.fillRect(0, panelY, WHATSAPP_STATUS_W, WHATSAPP_STATUS_H - panelY);

  const { text: textPrimary, secondaryText: textSecondary } = activeBg;

  ctx.fillStyle = accent;
  ctx.fillRect(48, panelY + 32, 100, 5);

  ctx.fillStyle = textSecondary;
  ctx.font = '700 20px "Space Grotesk", sans-serif';
  ctx.fillText(`${BRANDING.eventTitle.toUpperCase()} // OFFICIAL NOMINEE`, 48, panelY + 76);

  ctx.fillStyle = textPrimary;
  ctx.font = '400 68px "Playfair Display", serif';
  const name = nominee.name.toUpperCase();
  ctx.fillText(name.length > 16 ? `${name.slice(0, 14)}…` : name, 48, panelY + 158);

  ctx.fillStyle = textSecondary;
  ctx.font = '700 18px "Space Grotesk", sans-serif';
  ctx.fillText('CATEGORY', 48, panelY + 204);
  ctx.fillStyle = accent;
  ctx.font = '400 34px "Playfair Display", serif';
  let cat = (nominee.category_name || 'Award category').toUpperCase();
  if (cat.length > 30) cat = `${cat.slice(0, 28)}…`;
  ctx.fillText(cat, 48, panelY + 248);

  ctx.fillStyle = activeBg.cardBg;
  ctx.fillRect(48, panelY + 278, WHATSAPP_STATUS_W - 96, 188);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, panelY + 278, WHATSAPP_STATUS_W - 96, 188);

  ctx.fillStyle = textSecondary;
  ctx.font = '700 17px "Space Grotesk", sans-serif';
  ctx.fillText('DIAL TO VOTE', 72, panelY + 316);
  ctx.fillStyle = textPrimary;
  ctx.font = '900 52px "Space Grotesk", sans-serif';
  ctx.fillText(`*920*566*${nominee.code}#`, 72, panelY + 378);
  ctx.fillStyle = textSecondary;
  ctx.font = '700 14px "Space Grotesk", sans-serif';
  ctx.fillText(formatVotePricingLine(), 72, panelY + 412);
  ctx.font = '700 15px "Space Grotesk", sans-serif';
  const linkDisplay = shareUrl.replace(/^https?:\/\//i, '');
  ctx.fillText(`OR VOTE · ${linkDisplay}`, 72, panelY + 448);

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(WHATSAPP_STATUS_W - 96, panelY + 372, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = '900 13px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(BRANDING.platformName.toUpperCase(), WHATSAPP_STATUS_W - 96, panelY + 364);
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillText('OFFICIAL', WHATSAPP_STATUS_W - 96, panelY + 382);
  ctx.fillText('★', WHATSAPP_STATUS_W - 96, panelY + 398);
  ctx.restore();

  ctx.fillStyle = textSecondary;
  ctx.font = '700 17px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`CODE ${nominee.code} · ${BRANDING.eventYear}`, 48, WHATSAPP_STATUS_H - 64);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = textPrimary;
  ctx.font = '700 88px "Space Grotesk", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(BRANDING.platformName.toUpperCase(), WHATSAPP_STATUS_W - 36, WHATSAPP_STATUS_H - 40);
  ctx.restore();

  return canvas;
}

const accentColors = [
  { name: 'Brushed Gold', value: '#b8986c' },
  { name: 'Dark Burgundy', value: '#6a2e2e' },
  { name: 'Slate Onyx', value: '#2a2b2d' },
  { name: 'Sage Green', value: '#606f5c' },
  { name: 'Warm Ivory', value: '#e2dcd0' },
  { name: 'Nordic Blue', value: '#5d8aa8' },
  { name: 'Tuscan Amber', value: '#dca134' },
  { name: 'Terracotta', value: '#c05a3e' }
];

const backgroundOptions = [
  { id: 'black', name: 'STARK ONYX', bg: '#0a0a0a', text: '#ffffff', secondaryText: '#8c8273', cardBg: '#141414', isDark: true },
  { id: 'white', name: 'IVORY WHITE', bg: '#ffffff', text: '#000000', secondaryText: '#555555', cardBg: '#faf8f5', isDark: false },
  { id: 'gray', name: 'SLATE CHARCOAL', bg: '#1c1c1c', text: '#ffffff', secondaryText: '#9da3ab', cardBg: '#2a2b2d', isDark: true },
  { id: 'cream', name: 'WARM CREAM', bg: '#f9f6f0', text: '#1a1a1a', secondaryText: '#878070', cardBg: '#ffffff', isDark: false },
  { id: 'sand', name: 'DESERT SAND', bg: '#e5ded0', text: '#1a1a1a', secondaryText: '#70695d', cardBg: '#faf8f5', isDark: false },
  { id: 'sage', name: 'MUTED SAGE', bg: '#e0e5de', text: '#1e261f', secondaryText: '#748075', cardBg: '#fafcfa', isDark: false },
  { id: 'navy', name: 'MIDNIGHT NAVY', bg: '#0d1527', text: '#ffffff', secondaryText: '#929cb3', cardBg: '#17223b', isDark: true },
  { id: 'forest', name: 'DEEP FOREST', bg: '#0c1611', text: '#ffffff', secondaryText: '#8a9b91', cardBg: '#16281e', isDark: true },
  { id: 'burgundy', name: 'BORDEAUX WINE', bg: '#1a0606', text: '#ffffff', secondaryText: '#b39595', cardBg: '#2d0f0f', isDark: true }
];

export default function BannerGenerator({ nominee, token, onSaveSuccess }) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const handleSaveBanner = async () => {
    if (!token) return;
    setSaving(true);
    setSaveStatus('');
    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png');
      const response = await fetch(`${API_BASE_URL}/api/nominees/save-banner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: nominee.code, image: dataUrl })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save banner to server');
      }
      setSaveStatus('Campaign banner saved successfully! Social shares will preview this poster.');
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaveStatus(''), 5000);
    } catch (err) {
      console.error(err);
      setSaveStatus(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  const canvasRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0, scale: 1 });
  const [accent, setAccent] = useState('#b8986c'); // Default Gold
  const [bgStyle, setBgStyle] = useState('black'); // Background theme key
  const [photoFilter, setPhotoFilter] = useState('none'); // 'none', 'grayscale', 'sepia'
  const [borderWidth, setBorderWidth] = useState(1); // 1, 2, 4, 0
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [template, setTemplate] = useState('classic'); // 'classic', 'aura', 'glass'

  const drawPosterDetails = useCallback((ctx, canvas) => {
    const shareUrl = getNomineeVoteUrl(nominee.code);
    const shareUrlDisplay = shareUrl.replace(/^https?:\/\//i, '').toUpperCase();
    const activeBg = backgroundOptions.find(b => b.id === bgStyle) || backgroundOptions[0];
    const rightBg = activeBg.bg;
    const textPrimaryColor = activeBg.text;
    const textSecondaryColor = activeBg.secondaryText;
    const cardBg = activeBg.cardBg;

    // Helper: Dynamic metallic foil gradient to match active accent color
    const getFoilGradient = (x1, y1, x2, y2) => {
      let stops = ['#fceea7', '#dcb775', '#b8986c', '#8e714b', '#dcb775', '#fceea7'];
      
      if (accent === '#6a2e2e') { // Burgundy
        stops = ['#ff9999', '#c06c6c', '#8b3a3a', '#541212', '#c06c6c', '#ff9999'];
      } else if (accent === '#2a2b2d') { // Slate Onyx
        stops = ['#e0e0e0', '#9e9e9e', '#616161', '#212121', '#9e9e9e', '#e0e0e0'];
      } else if (accent === '#606f5c') { // Sage Green
        stops = ['#dce6db', '#a3bfa2', '#728c71', '#415440', '#a3bfa2', '#dce6db'];
      } else if (accent === '#5d8aa8') { // Nordic Blue
        stops = ['#bce0fd', '#7cb2d6', '#4a82a6', '#204d6e', '#7cb2d6', '#bce0fd'];
      } else if (accent === '#dca134') { // Amber
        stops = ['#ffe18a', '#e8b855', '#c98a22', '#8c5905', '#e8b855', '#ffe18a'];
      } else if (accent === '#c05a3e') { // Terracotta
        stops = ['#ffd2c5', '#e38b73', '#b8543b', '#7a2814', '#e38b73', '#ffd2c5'];
      } else if (accent === '#e2dcd0') { // Warm Ivory
        stops = ['#ffffff', '#ebe6dc', '#d2c9b6', '#a1957f', '#ebe6dc', '#ffffff'];
      }

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, stops[0]);
      grad.addColorStop(0.2, stops[1]);
      grad.addColorStop(0.4, stops[2]);
      grad.addColorStop(0.6, stops[3]);
      grad.addColorStop(0.8, stops[4]);
      grad.addColorStop(1, stops[5]);
      return grad;
    };

    // Helper: Draw procedural visual mock QR code
    const drawMockQRCode = (x, y, size) => {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // White base card
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, size, size);

      // Fine outer border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, size, size);

      const locSize = Math.floor(size * 0.22);
      const drawLocator = (lx, ly) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(lx, ly, locSize, locSize);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx + 1.5, ly + 1.5, locSize - 3, locSize - 3);
        ctx.fillStyle = '#000000';
        ctx.fillRect(lx + 3.5, ly + 3.5, locSize - 7, locSize - 7);
      };

      // Draw locators (Top-Left, Top-Right, Bottom-Left)
      drawLocator(x + 3, y + 3);
      drawLocator(x + size - locSize - 3, y + 3);
      drawLocator(x + 3, y + size - locSize - 3);

      // Bottom-Right sub-locator
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + size - 12, y + size - 12, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + size - 10, y + size - 10, 2, 2);

      // Seeded random dots
      let seed = 9876;
      const pseudoRandom = () => {
        const val = Math.sin(seed++) * 10000;
        return val - Math.floor(val);
      };

      const cellSize = 7;
      ctx.fillStyle = '#000000';
      for (let px = x + 3; px < x + size - 3; px += cellSize) {
        for (let py = y + 3; py < y + size - 3; py += cellSize) {
          // Avoid locator overlaps
          const inTopLeft = (px < x + locSize + 5 && py < y + locSize + 5);
          const inTopRight = (px > x + size - locSize - 5 && py < y + locSize + 5);
          const inBottomLeft = (px < x + locSize + 5 && py > y + size - locSize - 5);
          if (inTopLeft || inTopRight || inBottomLeft) continue;

          if (pseudoRandom() > 0.45) {
            ctx.fillRect(px, py, Math.ceil(cellSize), Math.ceil(cellSize));
          }
        }
      }
      ctx.restore();
    };

    // Helper: Draw sleek L-shaped gold photo corner brackets
    const drawCornerBrackets = (x, y, w, h, len = 25, thickness = 3) => {
      ctx.save();
      ctx.strokeStyle = getFoilGradient(x, y, x + w, y + h);
      ctx.lineWidth = thickness;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Top-Left
      ctx.beginPath(); ctx.moveTo(x + len, y); ctx.lineTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
      // Top-Right
      ctx.beginPath(); ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len); ctx.stroke();
      // Bottom-Left
      ctx.beginPath(); ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len); ctx.stroke();
      // Bottom-Right
      ctx.beginPath(); ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len); ctx.stroke();
      ctx.restore();
    };

    // Helper: Draw premium official gold star stamp seal watermark
    const drawOfficialStamp = (cx, cy) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Outer gold foil ring
      ctx.strokeStyle = getFoilGradient(cx - 30, cy - 30, cx + 30, cy + 30);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.stroke();

      // Inner dashed ring
      ctx.strokeStyle = getFoilGradient(cx - 25, cy - 25, cx + 25, cy + 25);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Star & Logo Seals
      ctx.fillStyle = getFoilGradient(cx - 20, cy - 20, cx + 20, cy + 20);
      ctx.font = '900 9px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VOTEEQ', cx, cy - 7);
      ctx.fillText('OFFICIAL', cx, cy + 7);
      ctx.font = '11px "Space Grotesk", sans-serif';
      ctx.fillText('★', cx, cy);
      ctx.restore();
    };

    if (template === 'classic') {
      ctx.fillStyle = rightBg;
      ctx.fillRect(600, 0, 600, canvas.height);

      // Subtle diagonal card background textures
      ctx.save();
      ctx.strokeStyle = activeBg.isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)';
      ctx.lineWidth = 1;
      for (let offset = -canvas.height; offset < canvas.width; offset += 24) {
        ctx.beginPath();
        ctx.moveTo(600 + offset, 0);
        ctx.lineTo(600 + offset + canvas.height, canvas.height);
        ctx.stroke();
      }
      ctx.restore();

      // Left-to-right boundary line
      ctx.strokeStyle = activeBg.isDark ? getFoilGradient(600, 0, 600, canvas.height) : '#1c1c1c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(600, 0);
      ctx.lineTo(600, canvas.height);
      ctx.stroke();

      // Draw Photo Corner brackets on the left panel (0 to 600px)
      drawCornerBrackets(30, 30, 540, canvas.height - 60, 30, 4);

      // 1. Tag Ribbon
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = getFoilGradient(640, 60, 1160, 108);
      ctx.fillRect(640, 60, 520, 48);
      ctx.restore();
      
      ctx.fillStyle = '#000000'; // black text over shiny gold foil looks incredibly crisp!
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText(`${BRANDING.eventTitle.toUpperCase()} // OFFICIAL NOMINEE`, 670, 92);

      // 2. Nominee Name Header
      ctx.save();
      ctx.fillStyle = textPrimaryColor;
      ctx.font = '400 68px "Playfair Display", serif';
      ctx.shadowColor = activeBg.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      let nameText = nominee.name.toUpperCase();
      ctx.fillText(nameText, 640, 210);
      ctx.restore();

      // 3. Divider Line
      ctx.strokeStyle = getFoilGradient(640, 260, 1160, 260);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(640, 260);
      ctx.lineTo(1160, 260);
      ctx.stroke();

      // 4. Category Details
      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText('CATEGORY', 640, 300);
      
      ctx.save();
      ctx.fillStyle = getFoilGradient(640, 315, 1160, 355);
      ctx.font = '400 36px "Playfair Display", serif';
      let catName = nominee.category_name || 'ARTIST OF THE YEAR';
      if (catName.length > 24) catName = catName.substring(0, 22) + '...';
      ctx.fillText(catName.toUpperCase(), 640, 345);
      ctx.restore();

      // 5. Voting Instructions Card block
      ctx.save();
      ctx.fillStyle = cardBg;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 10;
      ctx.fillRect(640, 410, 520, 230);
      ctx.restore();

      if (borderWidth > 0) {
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = getFoilGradient(640, 410, 1160, 640);
        ctx.strokeRect(640, 410, 520, 230);
      }

      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 15px "Space Grotesk", sans-serif';
      ctx.fillText('DIAL MOBILE SHORTCODE TO VOTE', 670, 460);
      
      ctx.save();
      ctx.fillStyle = activeBg.isDark ? getFoilGradient(670, 480, 980, 560) : '#000000';
      ctx.font = '900 48px "Space Grotesk", sans-serif';
      ctx.fillText(`*920*566*${nominee.code}#`, 670, 530);
      ctx.restore();

      ctx.fillStyle = textPrimaryColor;
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.fillText(formatVotePricingLine(), 670, 585);

      // Draw procedural QR Code inside voting card
      drawMockQRCode(1005, 455, 120);

      // 6. Online Voting Instructions block
      ctx.save();
      ctx.fillStyle = cardBg;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 10;
      ctx.fillRect(640, 670, 520, 160);
      ctx.restore();

      if (borderWidth > 0) {
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = getFoilGradient(640, 670, 1160, 830);
        ctx.strokeRect(640, 670, 520, 160);
      }

      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 15px "Space Grotesk", sans-serif';
      ctx.fillText('OR VOTE ONLINE DIRECTLY AT', 670, 720);
      
      ctx.save();
      ctx.fillStyle = activeBg.isDark ? getFoilGradient(670, 740, 980, 790) : '#000000';
      ctx.font = '700 22px "Space Grotesk", sans-serif';
      ctx.fillText(shareUrlDisplay, 670, 780);
      ctx.restore();

      // Draw dynamic official stamp seal
      drawOfficialStamp(1065, 750);

      // 7. Footer metadata
      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText('OFFICIAL CAMPAIGN POSTER', 640, 960);
      ctx.fillText(`NOMINEE CODE: ${nominee.code}`, 640, 995);

      // Simple geometric decoration
      ctx.fillStyle = getFoilGradient(1120, 940, 1160, 1000);
      ctx.fillRect(1120, 940, 40, 60);

      // Outer frame border
      ctx.strokeStyle = getFoilGradient(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    } else if (template === 'aura') {
      // 1. Fill background with vignette overlay
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, 'rgba(10, 10, 10, 0.15)');
      grad.addColorStop(0.4, 'rgba(10, 10, 10, 0.65)');
      grad.addColorStop(1, 'rgba(10, 10, 10, 0.96)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Glowing radial ambient aura
      const radialGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.7, 50, canvas.width / 2, canvas.height * 0.7, 550);
      radialGrad.addColorStop(0, `${accent}55`);
      radialGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Photo Corner brackets around full canvas boundaries
      drawCornerBrackets(30, 30, canvas.width - 60, canvas.height - 60, 35, 4);

      ctx.save();
      ctx.textAlign = 'center';

      // 2. Tagline
      ctx.fillStyle = getFoilGradient(canvas.width / 2 - 200, 190, canvas.width / 2 + 200, 230);
      ctx.font = '700 20px "Space Grotesk", sans-serif';
      ctx.fillText(`${BRANDING.eventTitle.toUpperCase()} // OFFICIAL NOMINEE`, canvas.width / 2, 220);

      // 3. Nominee Name
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 96px "Playfair Display", serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillText(nominee.name.toUpperCase(), canvas.width / 2, 350);
      ctx.restore(); // restore shadows

      ctx.save();
      ctx.textAlign = 'center';

      // 4. Category
      ctx.fillStyle = getFoilGradient(canvas.width / 2 - 250, 390, canvas.width / 2 + 250, 430);
      ctx.font = '700 18px "Space Grotesk", sans-serif';
      ctx.fillText('CATEGORY: ' + (nominee.category_name || 'ARTIST OF THE YEAR').toUpperCase(), canvas.width / 2, 420);

      // 5. Divider
      ctx.strokeStyle = getFoilGradient(canvas.width / 2 - 180, 480, canvas.width / 2 + 180, 480);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 180, 480);
      ctx.lineTo(canvas.width / 2 + 180, 480);
      ctx.stroke();

      // 6. Floating USSD card container
      const cardW = 680;
      const cardH = 280;
      const cardX = canvas.width / 2 - cardW / 2;
      const cardY = 560;

      ctx.fillStyle = 'rgba(15, 14, 13, 0.92)';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = getFoilGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      ctx.lineWidth = borderWidth || 2;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      ctx.restore(); // restore to draw left-aligned texts in card

      ctx.save();
      // QR Code inside card
      drawMockQRCode(cardX + 495, cardY + 75, 130);

      ctx.fillStyle = '#8c8273';
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText('DIAL MOBILE SHORTCODE TO VOTE', cardX + 50, cardY + 65);

      ctx.fillStyle = getFoilGradient(cardX + 50, cardY + 90, cardX + 450, cardY + 160);
      ctx.font = '900 52px "Space Grotesk", sans-serif';
      ctx.fillText(`*920*566*${nominee.code}#`, cardX + 50, cardY + 145);

      ctx.fillStyle = '#c8bfb0';
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.fillText(formatVotePricingLine(), cardX + 50, cardY + 178);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText('OR VOTE ONLINE AT', cardX + 50, cardY + 200);

      ctx.fillStyle = getFoilGradient(cardX + 50, cardY + 215, cardX + 450, cardY + 250);
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText(shareUrlDisplay, cardX + 50, cardY + 230);
      ctx.restore();

      // Official Seal stamp at bottom left
      drawOfficialStamp(140, 1050);

      // 7. Footer metadata
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8c8273';
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText(`NOMINEE CODE: ${nominee.code} // VERIFIED LIVE STANDINGS`, canvas.width / 2 + 60, 1060);
      ctx.restore();

      // Outer gold border frame
      ctx.strokeStyle = getFoilGradient(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    } else if (template === 'glass') {
      // Dark dimmer overlay
      ctx.fillStyle = 'rgba(10, 10, 10, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Photo Corner brackets around full canvas boundaries
      drawCornerBrackets(30, 30, canvas.width - 60, canvas.height - 60, 35, 4);

      // Glassmorphic Card panel layout at the bottom third
      const cardX = 80;
      const cardY = 540;
      const cardW = 1040;
      const cardH = 560;

      ctx.fillStyle = activeBg.isDark ? 'rgba(16, 15, 14, 0.9)' : 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(cardX, cardY, cardW, cardH);

      // Gold styling borders
      ctx.strokeStyle = getFoilGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      ctx.lineWidth = borderWidth || 3;
      ctx.strokeRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = activeBg.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12);

      // Tag ribbon in glass card
      ctx.save();
      ctx.fillStyle = getFoilGradient(cardX + 50, cardY + 50, cardX + 450, cardY + 94);
      ctx.fillRect(cardX + 50, cardY + 50, 400, 44);
      ctx.restore();
      
      ctx.fillStyle = '#000000';
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText('VOTEEQ OFFICIAL NOMINEE PROFILE', cardX + 70, cardY + 77);

      // Nominee Code top right inside card
      ctx.fillStyle = textPrimaryColor;
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText(`CODE: ${nominee.code}`, cardX + cardW - 160, cardY + 77);

      // Nominee Name
      ctx.save();
      ctx.fillStyle = textPrimaryColor;
      ctx.font = '700 72px "Playfair Display", serif';
      ctx.shadowColor = activeBg.isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(nominee.name.toUpperCase(), cardX + 50, cardY + 185);
      ctx.restore();

      // Category Details
      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText('CATEGORY', cardX + 50, cardY + 245);
      
      ctx.save();
      ctx.fillStyle = getFoilGradient(cardX + 50, cardY + 255, cardX + 500, cardY + 310);
      ctx.font = '500 32px "Playfair Display", serif';
      ctx.fillText((nominee.category_name || 'ARTIST OF THE YEAR').toUpperCase(), cardX + 50, cardY + 290);
      ctx.restore();

      // Divider
      ctx.strokeStyle = getFoilGradient(cardX + 50, cardY + 340, cardX + cardW - 50, cardY + 340);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + 50, cardY + 340);
      ctx.lineTo(cardX + cardW - 50, cardY + 340);
      ctx.stroke();

      // Voting Panel inside glass card
      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText('DIAL MOBILE SHORTCODE TO VOTE', cardX + 50, cardY + 390);

      ctx.save();
      ctx.fillStyle = getFoilGradient(cardX + 50, cardY + 410, cardX + 450, cardY + 480);
      ctx.font = '900 58px "Space Grotesk", sans-serif';
      ctx.fillText(`*920*566*${nominee.code}#`, cardX + 50, cardY + 460);
      ctx.restore();

      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText('OR VOTE ONLINE DIRECTLY AT', cardX + 540, cardY + 390);

      ctx.save();
      ctx.fillStyle = textPrimaryColor;
      ctx.font = '700 24px "Space Grotesk", sans-serif';
      ctx.fillText(shareUrlDisplay, cardX + 540, cardY + 445);
      ctx.restore();

      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 12px "Space Grotesk", sans-serif';
      ctx.fillText(formatVotePricingLine(), cardX + 540, cardY + 480);

      // Draw vector QR code in glass card (top right area of layout details)
      drawMockQRCode(cardX + cardW - 190, cardY + 145, 140);

      // Draw official stamp seal
      drawOfficialStamp(cardX + cardW - 270, cardY + cardH - 100);

      // Footer metadata
      ctx.fillStyle = textSecondaryColor;
      ctx.font = '700 14px "Space Grotesk", sans-serif';
      ctx.fillText(`${BRANDING.organizerName} · ${BRANDING.university} · ${BRANDING.eventYear}`, 80, 1150);

      // Outer gold border frame
      ctx.strokeStyle = getFoilGradient(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    }
  }, [bgStyle, accent, borderWidth, nominee, template]);

  const drawBanner = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isFull = template === 'aura' || template === 'glass';
    const targetW = isFull ? canvas.width : 600;
    const targetH = canvas.height;

    ctx.fillStyle = '#181715';
    ctx.fillRect(0, 0, targetW, canvas.height);

    if (photoUrl) {
      const img = new Image();
      img.src = photoUrl;
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, targetW, canvas.height);
        ctx.clip();

        const imgRatio = img.width / img.height;
        const targetRatio = targetW / targetH;

        let drawW = targetW * imgOffset.scale;
        let drawH = targetH * imgOffset.scale;

        if (imgRatio > targetRatio) {
          drawW = targetH * imgRatio * imgOffset.scale;
        } else {
          drawH = (targetW / imgRatio) * imgOffset.scale;
        }

        const cx = targetW / 2 + imgOffset.x;
        const cy = targetH / 2 + imgOffset.y;

        // Apply HTML5 canvas filter variables
        if (photoFilter === 'grayscale') {
          ctx.filter = 'grayscale(100%) contrast(1.15)';
        } else if (photoFilter === 'sepia') {
          ctx.filter = 'sepia(80%) contrast(1.05)';
        } else {
          ctx.filter = 'none';
        }

        ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        ctx.filter = 'none';
        ctx.restore();

        drawPhotoAreaWatermark(ctx, 0, 0, targetW, canvas.height);
        drawPosterDetails(ctx, canvas);
      };
    } else {
      ctx.fillStyle = '#22211f';
      ctx.fillRect(20, 20, targetW - 40, canvas.height - 40);
      
      ctx.fillStyle = '#8c8273';
      ctx.font = '400 24px "Playfair Display", serif';
      ctx.textAlign = 'center';
      ctx.fillText('NO IMAGE UPLOADED', targetW / 2, 560);
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.fillText('UPLOAD PORTRAIT PHOTO ON CONTROLS ABOVE', targetW / 2, 600);
      ctx.textAlign = 'left';

      drawPosterDetails(ctx, canvas);
    }
  }, [template, photoUrl, imgOffset, photoFilter, drawPosterDetails]);

  const drawRafRef = useRef(null);

  useEffect(() => {
    if (drawRafRef.current) {
      cancelAnimationFrame(drawRafRef.current);
    }
    drawRafRef.current = requestAnimationFrame(() => {
      drawBanner();
      if (isDragging) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const targetW = template === 'aura' || template === 'glass' ? canvas.width : 600;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(targetW / 2, 0);
        ctx.lineTo(targetW / 2, canvas.height);
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(targetW, canvas.height / 2);
        ctx.stroke();
        ctx.restore();
      }
    });
    return () => {
      if (drawRafRef.current) {
        cancelAnimationFrame(drawRafRef.current);
      }
    };
  }, [drawBanner, isDragging, template]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoUrl(reader.result);
        setImgOffset({ x: 0, y: 0, scale: 1 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async (format = 'square') => {
    try {
      let exportCanvas = canvasRef.current;
      if (format === 'status') {
        exportCanvas = await buildWhatsAppStatusCanvas({
          photoUrl,
          imgOffset,
          photoFilter,
          nominee,
          accent,
          bgStyle,
          backgroundOptions,
          shareUrl: getNomineeVoteUrl(nominee.code),
        });
      }
      if (!exportCanvas) return;
      const url = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = format === 'status'
        ? `ASCES_Status_${nominee.code}.png`
        : `ASCES_Poster_${nominee.name.replace(/\s+/g, '_')}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error(err);
      setSaveStatus(`Error: Could not export poster (${err.message})`);
    }
  };

  const handleMouseDown = (e) => {
    if (!photoUrl) return;
    setIsDragging(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !photoUrl) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const dx = currentX - dragStart.x;
    const dy = currentY - dragStart.y;
    const resolutionScale = 1200 / rect.width;

    setImgOffset(prev => ({
      ...prev,
      x: prev.x + dx * resolutionScale,
      y: prev.y + dy * resolutionScale
    }));

    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
      <div className="editorial-sheet">
        <h3 style={{ marginBottom: '0.75rem', fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}>Campaign Poster Studio</h3>
        <p style={{ marginBottom: '2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Produce high-quality campaign posters with a VoteEQ watermark on your photo. Upload a portrait, drag to crop, then download a square feed graphic or a <strong style={{ color: 'var(--text-primary)' }}>9:16 WhatsApp Status</strong> (1080×1920) sized for phone screens.
        </p>

        {/* Customization Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>1. Upload Portrait</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              className="luxury-input" 
              style={{ padding: '0.5rem', background: 'var(--bg-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>2. Scale Photo</label>
            <input 
              type="range" 
              min="0.5" 
              max="3.0" 
              step="0.05" 
              value={imgOffset.scale} 
              onChange={(e) => setImgOffset(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', margin: '0.5rem 0' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>ZOOM: {Math.round(imgOffset.scale * 100)}%</span>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>3. Layout Design Preset</label>
            <select 
              value={template} 
              onChange={(e) => setTemplate(e.target.value)} 
              className="luxury-select"
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase' }}
            >
              <option value="classic">STARK SPLIT CLASSIC</option>
              <option value="aura">AURA GLOW MODERN</option>
              <option value="glass">VINTAGE FROSTED GLASS</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>4. Layout Accent</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              {accentColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setAccent(c.value)}
                  type="button"
                  style={{
                    backgroundColor: c.value,
                    width: '22px',
                    height: '22px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transform: accent === c.value ? 'scale(1.2)' : 'none',
                    transition: 'transform 0.2s ease',
                    boxShadow: accent === c.value ? '0 0 0 2px var(--bg-primary), 0 0 0 3px var(--accent)' : 'none'
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>5. Card Background</label>
            <select 
              value={bgStyle} 
              onChange={(e) => setBgStyle(e.target.value)} 
              className="luxury-select"
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.75rem' }}
            >
              {backgroundOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>6. Portrait Filter</label>
            <select 
              value={photoFilter} 
              onChange={(e) => setPhotoFilter(e.target.value)} 
              className="luxury-select"
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.75rem' }}
            >
              <option value="none">ORIGINAL PORTRAIT</option>
              <option value="grayscale">STARK BLACK & WHITE</option>
              <option value="sepia">VINTAGE SEPIA</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>7. Inner Borders</label>
            <select 
              value={borderWidth} 
              onChange={(e) => setBorderWidth(parseInt(e.target.value))} 
              className="luxury-select"
              style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.75rem' }}
            >
              <option value={1}>HAIRLINE (1PX)</option>
              <option value={2}>MEDIUM (2PX)</option>
              <option value={4}>BOLD BORDER (4PX)</option>
              <option value={0}>BORDERLESS PANELS</option>
            </select>
          </div>
        </div>

        {photoUrl && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '0.6rem',
            border: '1px solid var(--border-color)', 
            background: 'var(--bg-tertiary)', 
            padding: '0.6rem 1rem', 
            marginBottom: '1.5rem', 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)',
            letterSpacing: '0.02em'
          }}>
            <span style={{ color: 'var(--accent)' }}>✦</span>
            <span>DRAG WITHIN THE CANVAS LEFT AREA TO CROP // DOTTED ALIGNMENT GUIDES VISIBLE ON DRAG</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0' }}>
            <canvas
              ref={canvasRef}
              width={1200}
              height={1200}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="banner-canvas"
              style={{
                width: '100%',
                maxWidth: '450px',
                height: 'auto',
                border: '1px solid rgba(28, 28, 28, 0.08)',
                background: '#fff',
                cursor: photoUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                boxShadow: '0 25px 60px -15px rgba(28, 28, 28, 0.15), 0 0 0 1px rgba(28, 28, 28, 0.03)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
              aria-label="Campaign banner poster preview. Displays nominee profile image, candidate name, category description, and mobile money shortcode voting instructions."
            >
              Interactive campaign poster builder showing nominee details.
            </canvas>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', width: '100%', maxWidth: '450px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => handleDownload('square')}
              className="luxury-btn"
              style={{ padding: '1rem', flex: '1 1 140px', fontSize: '0.7rem', letterSpacing: '0.05em' }}
            >
              SQUARE POST
            </button>
            <button
              type="button"
              onClick={() => handleDownload('status')}
              className="luxury-btn"
              style={{ padding: '1rem', flex: '1 1 140px', fontSize: '0.7rem', letterSpacing: '0.05em' }}
            >
              WHATSAPP STATUS
            </button>
            {token && (
              <button
                type="button"
                onClick={handleSaveBanner}
                disabled={saving}
                className="luxury-btn secondary"
                style={{ padding: '1rem', flex: '1 1 100%', fontSize: '0.7rem', letterSpacing: '0.05em' }}
              >
                {saving ? 'SAVING...' : 'SAVE SQUARE FOR LINK PREVIEW'}
              </button>
            )}
          </div>
          {saveStatus && (
            <div 
              className="banner-save-status"
              style={{
                fontSize: '0.75rem',
                color: saveStatus.startsWith('Error') ? '#c05a3e' : 'var(--accent-dark)',
                fontWeight: 500,
                textAlign: 'center',
                animation: 'fadeIn 0.3s ease'
              }}
            >
              {saveStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
