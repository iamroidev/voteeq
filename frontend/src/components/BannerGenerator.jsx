import React, { useState, useRef, useEffect } from 'react';

export default function BannerGenerator({ nominee }) {
  const canvasRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0, scale: 1 });
  const [accent, setAccent] = useState('#b8986c'); // Default Gold
  const [bgStyle, setBgStyle] = useState('black'); // Background theme key
  const [photoFilter, setPhotoFilter] = useState('none'); // 'none', 'grayscale', 'sepia'
  const [borderWidth, setBorderWidth] = useState(1); // 1, 2, 4, 0
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

  const drawPosterDetails = (ctx, canvas) => {
    const activeBg = backgroundOptions.find(b => b.id === bgStyle) || backgroundOptions[0];
    const rightBg = activeBg.bg;
    const textPrimaryColor = activeBg.text;
    const textSecondaryColor = activeBg.secondaryText;
    const cardBg = activeBg.cardBg;

    ctx.fillStyle = rightBg;
    ctx.fillRect(600, 0, 600, canvas.height);

    // Left-to-right boundary line
    ctx.strokeStyle = activeBg.isDark ? accent : '#1c1c1c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(600, 0);
    ctx.lineTo(600, canvas.height);
    ctx.stroke();

    // 1. Tag Ribbon
    ctx.fillStyle = accent;
    ctx.fillRect(640, 60, 520, 48);
    
    ctx.fillStyle = !activeBg.isDark && (accent === '#e2dcd0' || accent === '#b8986c') ? '#000000' : '#ffffff';
    ctx.font = '700 16px "Space Grotesk", sans-serif';
    ctx.fillText('VOTEEQ AWARDS // OFFICIAL NOMINEE', 670, 92);

    // 2. Nominee Name Header
    ctx.fillStyle = textPrimaryColor;
    ctx.font = '400 68px "Playfair Display", serif';
    let nameText = nominee.name.toUpperCase();
    ctx.fillText(nameText, 640, 210);

    // 3. Divider Line
    ctx.strokeStyle = textSecondaryColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(640, 260);
    ctx.lineTo(1160, 260);
    ctx.stroke();

    // 4. Category Details
    ctx.fillStyle = textSecondaryColor;
    ctx.font = '700 16px "Space Grotesk", sans-serif';
    ctx.fillText('CATEGORY', 640, 300);
    
    ctx.fillStyle = textPrimaryColor;
    ctx.font = '400 36px "Playfair Display", serif';
    let catName = nominee.category_name || 'ARTIST OF THE YEAR';
    if (catName.length > 24) catName = catName.substring(0, 22) + '...';
    ctx.fillText(catName.toUpperCase(), 640, 345);

    // 5. Voting Instructions Card block
    ctx.fillStyle = cardBg;
    ctx.fillRect(640, 410, 520, 230);
    if (borderWidth > 0) {
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = textSecondaryColor;
      ctx.strokeRect(640, 410, 520, 230);
    }

    ctx.fillStyle = textSecondaryColor;
    ctx.font = '700 16px "Space Grotesk", sans-serif';
    ctx.fillText('DIAL MOBILE SHORTCODE TO VOTE', 675, 460);
    
    ctx.fillStyle = activeBg.isDark ? accent : '#000000';
    ctx.font = '900 62px "Space Grotesk", sans-serif';
    ctx.fillText(`*920*102*${nominee.code}#`, 675, 540);

    ctx.fillStyle = textPrimaryColor;
    ctx.font = '700 15px "Space Grotesk", sans-serif';
    ctx.fillText('1 VOTE = GHS 0.50 // INSTANT SYNC', 675, 600);

    // 6. Online Voting Instructions block
    ctx.fillStyle = cardBg;
    ctx.fillRect(640, 670, 520, 160);
    if (borderWidth > 0) {
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = textSecondaryColor;
      ctx.strokeRect(640, 670, 520, 160);
    }

    ctx.fillStyle = textSecondaryColor;
    ctx.font = '700 16px "Space Grotesk", sans-serif';
    ctx.fillText('OR VOTE ONLINE DIRECTLY AT', 675, 720);
    
    ctx.fillStyle = activeBg.isDark ? accent : '#000000';
    ctx.font = '700 28px "Space Grotesk", sans-serif';
    ctx.fillText(`WWW.VOTEEQ.COM/?NOMINEE=${nominee.code}`, 675, 795);

    // 7. Footer metadata
    ctx.fillStyle = textSecondaryColor;
    ctx.font = '700 14px "Space Grotesk", sans-serif';
    ctx.fillText('OFFICIAL CAMPAIGN POSTER', 640, 960);
    ctx.fillText(`NOMINEE CODE: ${nominee.code}`, 640, 995);

    // Simple geometric decoration
    ctx.fillStyle = accent;
    ctx.fillRect(1120, 940, 40, 60);

    // Outer frame border
    ctx.strokeStyle = rightBg === '#ffffff' ? '#1c1c1c' : rightBg;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  };

  const drawBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#181715';
    ctx.fillRect(0, 0, 600, canvas.height);

    if (photoUrl) {
      const img = new Image();
      img.src = photoUrl;
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, 600, canvas.height);
        ctx.clip();

        const imgRatio = img.width / img.height;
        const targetW = 600;
        const targetH = canvas.height;
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
        
        drawPosterDetails(ctx, canvas);
      };
    } else {
      ctx.fillStyle = '#22211f';
      ctx.fillRect(20, 20, 560, canvas.height - 40);
      
      ctx.fillStyle = '#8c8273';
      ctx.font = '400 24px "Playfair Display", serif';
      ctx.textAlign = 'center';
      ctx.fillText('NO IMAGE UPLOADED', 300, 560);
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.fillText('UPLOAD PORTRAIT PHOTO ON CONTROLS ABOVE', 300, 600);
      ctx.textAlign = 'left';

      drawPosterDetails(ctx, canvas);
    }
  };

  useEffect(() => {
    drawBanner();
  }, [nominee, photoUrl, imgOffset, accent, bgStyle, photoFilter, borderWidth]);

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

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `VOTEEQ_Poster_${nominee.name.replace(/\s+/g, '_')}.png`;
    link.href = url;
    link.click();
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
          Produce high-quality campaign posters. Upload a portrait photograph, drag to position the crop inside the graphic, choose background styles, and download the finished graphic.
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
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>3. Layout Accent</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              {accentColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setAccent(c.value)}
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
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>4. Card Background</label>
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
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>5. Portrait Filter</label>
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
            <label style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>6. Inner Borders</label>
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
          <div style={{ display: 'inline-block', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', padding: '0.5rem 0.75rem', marginBottom: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            TIP: Click and drag inside the left half of the graphic below to center the photograph.
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
            style={{
              width: '100%',
              maxWidth: '450px',
              height: 'auto',
              border: '1px solid var(--border-color)',
              background: '#fff',
              cursor: photoUrl ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button 
            onClick={handleDownload} 
            className="luxury-btn" 
            style={{ padding: '1rem 3rem', width: '100%', maxWidth: '380px' }}
          >
            DOWNLOAD OFFICIAL POSTER
          </button>
        </div>
      </div>
    </div>
  );
}
