import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Share2, Sparkles, Check, Disc, Heart, Music, MessageCircleHeart, Mic, RefreshCw, Radio, Tag, Flame, ArrowLeft } from 'lucide-react';
import html2canvas from 'html2canvas';
import { SongRequest, RadioHost } from '../types';

interface StoryShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: Partial<SongRequest> | null;
  radioHost?: RadioHost;
  radioHosts?: RadioHost[];
}

export type StoryTheme = {
  id: string;
  name: string;
  bgClass: string;
  cardBgClass: string;
  accentBgClass: string;
  badgeBgClass: string;
  previewColor: string;
  // Raw Hex colors for Canvas rendering & export safety
  outerBgHex: string;
  cardBgHex: string;
  accentHex: string;
  badgeHex: string;
  tagBgHex: string;
  textHex: string;
};

export const NEO_THEMES: StoryTheme[] = [
  {
    id: 'bubblegum-pink',
    name: 'Bubblegum Pink',
    bgClass: 'bg-[#FE90E8]',
    cardBgClass: 'bg-white',
    accentBgClass: 'bg-[#C0F7FE]',
    badgeBgClass: 'bg-[#FFE600]',
    previewColor: '#FE90E8',
    outerBgHex: '#FE90E8',
    cardBgHex: '#FFFFFF',
    accentHex: '#C0F7FE',
    badgeHex: '#FFE600',
    tagBgHex: '#B8FF00',
    textHex: '#000000'
  },
  {
    id: 'electric-cyan',
    name: 'Electric Cyan',
    bgClass: 'bg-[#C0F7FE]',
    cardBgClass: 'bg-white',
    accentBgClass: 'bg-[#FE90E8]',
    badgeBgClass: 'bg-[#B8FF00]',
    previewColor: '#C0F7FE',
    outerBgHex: '#C0F7FE',
    cardBgHex: '#FFFFFF',
    accentHex: '#FE90E8',
    badgeHex: '#B8FF00',
    tagBgHex: '#FFE600',
    textHex: '#000000'
  },
  {
    id: 'neo-lime',
    name: 'Neo Lime Green',
    bgClass: 'bg-[#99E885]',
    cardBgClass: 'bg-white',
    accentBgClass: 'bg-[#FE90E8]',
    badgeBgClass: 'bg-[#FFDC8B]',
    previewColor: '#99E885',
    outerBgHex: '#99E885',
    cardBgHex: '#FFFFFF',
    accentHex: '#FE90E8',
    badgeHex: '#FFDC8B',
    tagBgHex: '#C0F7FE',
    textHex: '#000000'
  },
  {
    id: 'butter-mustard',
    name: 'Butter Mustard',
    bgClass: 'bg-[#FFDC8B]',
    cardBgClass: 'bg-white',
    accentBgClass: 'bg-[#C0F7FE]',
    badgeBgClass: 'bg-[#FE90E8]',
    previewColor: '#FFDC8B',
    outerBgHex: '#FFDC8B',
    cardBgHex: '#FFFFFF',
    accentHex: '#C0F7FE',
    badgeHex: '#FE90E8',
    tagBgHex: '#99E885',
    textHex: '#000000'
  },
  {
    id: 'paper-dot',
    name: 'Paper Cream Dot',
    bgClass: 'bg-[#FFFDF0]',
    cardBgClass: 'bg-white',
    accentBgClass: 'bg-[#FE90E8]',
    badgeBgClass: 'bg-[#C0F7FE]',
    previewColor: '#FFFDF0',
    outerBgHex: '#FFFDF0',
    cardBgHex: '#FFFFFF',
    accentHex: '#FE90E8',
    badgeHex: '#C0F7FE',
    tagBgHex: '#B8FF00',
    textHex: '#000000'
  },
  {
    id: 'neo-dark-chalk',
    name: 'Neo Dark Chalk',
    bgClass: 'bg-[#18181B]',
    cardBgClass: 'bg-[#27272A]',
    accentBgClass: 'bg-[#FFE600]',
    badgeBgClass: 'bg-[#FE90E8]',
    previewColor: '#18181B',
    outerBgHex: '#18181B',
    cardBgHex: '#FFFFFF',
    accentHex: '#FFE600',
    badgeHex: '#FE90E8',
    tagBgHex: '#C0F7FE',
    textHex: '#000000'
  }
];

export const StoryShareModal: React.FC<StoryShareModalProps> = ({
  isOpen,
  onClose,
  request,
  radioHost,
  radioHosts
}) => {
  const [selectedTheme, setSelectedTheme] = useState<StoryTheme>(NEO_THEMES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [safeCoverUrl, setSafeCoverUrl] = useState<string>('');
  const storyCardRef = useRef<HTMLDivElement>(null);

  const rawCoverUrl = request?.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';

  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !request) return;

    // Convert cover image to base64 Data URL to prevent CORS taint in html2canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = rawCoverUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 400;
        canvas.height = img.naturalHeight || 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          if (isMounted) setSafeCoverUrl(dataUrl);
          return;
        }
      } catch (e) {
        console.warn('Canvas conversion restricted, using raw URL:', e);
      }
      if (isMounted) setSafeCoverUrl(rawCoverUrl);
    };
    img.onerror = () => {
      if (isMounted) setSafeCoverUrl('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80');
    };
  }, [isOpen, request?.coverUrl, rawCoverUrl]);

  // Close modal when pressing Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !request) return null;

  const allHosts = radioHosts && radioHosts.length > 0 ? radioHosts : (radioHost ? [radioHost] : []);
  const namedHosts = allHosts.filter(h => h && h.name && h.name.trim().length > 0);
  const activeNamedHosts = namedHosts.filter(h => h.isOnAir);
  const displayHostString = activeNamedHosts.length > 0
    ? activeNamedHosts.map(h => h.name).join(' & ')
    : (namedHosts.length > 0 ? namedHosts.map(h => h.name).join(' & ') : 'DJ Penyiar Sekolah');

  const displayCoverUrl = safeCoverUrl || rawCoverUrl;

  const handleCloneForHtml2Canvas = (clonedDoc: Document) => {
    const dummyCanvas = clonedDoc.createElement('canvas');
    const ctx = dummyCanvas.getContext('2d');

    const fixColorString = (str: string) => {
      if (!str || (!str.includes('oklab') && !str.includes('oklch') && !str.includes('color-mix'))) return str;
      let clean = str.replace(/in\s+okl(?:ab|ch),?\s*/gi, '');
      return clean.replace(/okl(?:ab|ch)\([^)]+\)/gi, (match) => {
        if (!ctx) return '#000000';
        try {
          ctx.fillStyle = '#ffffff';
          ctx.fillStyle = match;
          return ctx.fillStyle !== '#ffffff' ? ctx.fillStyle : '#000000';
        } catch {
          return '#000000';
        }
      });
    };

    const propsToFix = [
      'color',
      'background-color',
      'border-color',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'outline-color',
      'box-shadow',
      'background-image',
      'fill',
      'stroke'
    ];

    const targetNode = clonedDoc.querySelector('[data-story-frame="true"]') || clonedDoc.body;
    if (targetNode) {
      const allNodes = [targetNode, ...Array.from(targetNode.querySelectorAll('*'))];
      allNodes.forEach((node) => {
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;
        node.style.backdropFilter = 'none';
        (node.style as any).webkitBackdropFilter = 'none';

        const computed = (clonedDoc.defaultView || window).getComputedStyle(node);
        propsToFix.forEach((prop) => {
          const val = computed.getPropertyValue(prop);
          if (val && (val.includes('oklab') || val.includes('oklch') || val.includes('color-mix'))) {
            node.style.setProperty(prop, fixColorString(val), 'important');
          }
        });
      });
    }
  };

  const generateNativeCanvasJpeg = async (): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    // 1. Neo-Brutalism Canvas Background
    ctx.fillStyle = selectedTheme.outerBgHex;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Neo-Brutalism Dot Matrix Grid Pattern
    ctx.fillStyle = '#000000';
    const dotSpacing = 44;
    const dotRadius = 2.2;
    for (let x = 30; x < 1080; x += dotSpacing) {
      for (let y = 30; y < 1920; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = selectedTheme.id === 'neo-dark-chalk' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
        ctx.fill();
      }
    }

    // 3. Decorative Corner Accents & Neo-Brutalism Crosshairs
    const drawCross = (cx: number, cy: number, size: number) => {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - size, cy);
      ctx.lineTo(cx + size, cy);
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx, cy + size);
      ctx.stroke();
    };

    drawCross(60, 60, 16);
    drawCross(1020, 60, 16);
    drawCross(60, 1860, 16);
    drawCross(1020, 1860, 16);

    // Decorative Neo Sparkles
    const drawSparkle = (cx: number, cy: number, r: number, color: string) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        const innerAngle = angle + Math.PI / 4;
        ctx.lineTo(cx + Math.cos(innerAngle) * (r * 0.35), cy + Math.sin(innerAngle) * (r * 0.35));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawSparkle(980, 240, 28, selectedTheme.badgeHex);
    drawSparkle(100, 1020, 22, selectedTheme.accentHex);

    // 4. Main Outer Frame (Thick 8px Black Border with Hard Shadow)
    const frameX = 50;
    const frameY = 50;
    const frameW = 980;
    const frameH = 1820;
    const shadowOffset = 12;

    // Hard Shadow
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(frameX + shadowOffset, frameY + shadowOffset, frameW, frameH, 44);
      ctx.fill();
    } else {
      ctx.fillRect(frameX + shadowOffset, frameY + shadowOffset, frameW, frameH);
    }

    // Outer Card Fill
    ctx.fillStyle = selectedTheme.id === 'neo-dark-chalk' ? '#18181B' : selectedTheme.outerBgHex;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(frameX, frameY, frameW, frameH, 44);
    } else {
      ctx.rect(frameX, frameY, frameW, frameH);
    }
    ctx.fill();

    // Outer Card Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.stroke();

    // 5. HEADER BAR:
    // LEFT: Neo Badge "ON-AIR" (NO FM, NO numbers!)
    // RIGHT: EMKA RADIO BRANDING (Right aligned with green radio icon)
    const headerY = 130;

    // Left Tag: ON-AIR
    const leftTagW = 220;
    const leftTagH = 64;
    const leftTagX = 90;

    // Hard Shadow for ON-AIR
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(leftTagX + 5, headerY + 5, leftTagW, leftTagH, 18);
      ctx.fill();
    }
    ctx.fillStyle = selectedTheme.tagBgHex;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(leftTagX, headerY, leftTagW, leftTagH, 18);
    } else {
      ctx.rect(leftTagX, headerY, leftTagW, leftTagH);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Red Dot inside ON-AIR pill
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(leftTagX + 34, headerY + leftTagH / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ON-AIR Text (Clean, no FM, no numbers)
    ctx.fillStyle = '#000000';
    ctx.font = '900 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ON-AIR', leftTagX + 52, headerY + 41);

    // RIGHT SIDE: EMKA RADIO LOGO & BRANDING (Right aligned!)
    const rightLogoW = 340;
    const rightLogoH = 74;
    const rightLogoX = 1080 - 90 - rightLogoW;

    // Hard Shadow for EMKA Radio
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(rightLogoX + 5, headerY + 5, rightLogoW, rightLogoH, 22);
      ctx.fill();
    }

    // EMKA Radio Box Fill
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(rightLogoX, headerY, rightLogoW, rightLogoH, 22);
    } else {
      ctx.rect(rightLogoX, headerY, rightLogoW, rightLogoH);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Text on Left of Badge
    ctx.textAlign = 'right';
    ctx.fillStyle = '#000000';
    ctx.font = '900 24px sans-serif';
    ctx.fillText('EMKA RADIO', rightLogoX + rightLogoW - 74, headerY + 34);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Multi Karya', rightLogoX + rightLogoW - 74, headerY + 58);

    // Green Icon Box on Right of Badge
    const iconBoxX = rightLogoX + rightLogoW - 62;
    const iconBoxY = headerY + 12;
    const iconBoxSize = 50;

    ctx.fillStyle = selectedTheme.tagBgHex;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 14);
    } else {
      ctx.rect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Radio Antenna & Waves inside Icon Box
    const iconCenterX = iconBoxX + iconBoxSize / 2;
    const iconCenterY = iconBoxY + iconBoxSize / 2;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, 11, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, 11, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, 17, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, 17, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();

    // 6. MOOD STICKER (Tilted Neo-brutalist Tape/Sticker)
    const rawMood = request.mood || 'SECRET CONFESSION';
    const moodText = `✦ ${rawMood.toUpperCase()} ✦`;
    const moodY = 245;

    ctx.font = '900 24px sans-serif';
    const moodTextWidth = ctx.measureText(moodText).width;
    const moodW = Math.max(340, moodTextWidth + 60);
    const moodH = 58;

    ctx.save();
    ctx.translate(1080 / 2, moodY + moodH / 2);
    ctx.rotate(-0.035); // -2 deg tilt

    // Hard Shadow
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(-moodW / 2 + 5, -moodH / 2 + 5, moodW, moodH, 16);
      ctx.fill();
    }

    // Mood Sticker Box
    ctx.fillStyle = selectedTheme.badgeHex;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-moodW / 2, -moodH / 2, moodW, moodH, 16);
    } else {
      ctx.rect(-moodW / 2, -moodH / 2, moodW, moodH);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = '900 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(moodText, 0, 8);
    ctx.restore();

    // DYNAMIC ADAPTIVE SCALING FOR MESSAGE & ALBUM
    const rawMsg = (request.message || 'Pesan confession untuk doi...').trim();
    const msgLength = rawMsg.length;
    const isVeryLongMsg = msgLength > 200;
    const isLongMsg = msgLength > 100;

    // 7. ALBUM COVER & VINYL (Neo-Brutalism Style - Responsive Sizing)
    const coverSize = isVeryLongMsg ? 280 : isLongMsg ? 320 : 360;
    const coverX = (1080 - coverSize) / 2 - (isVeryLongMsg ? 25 : 30);
    const coverY = isVeryLongMsg ? 330 : isLongMsg ? 340 : 355;

    // Black Vinyl Record Behind
    const vinylCenterX = coverX + coverSize + (isVeryLongMsg ? 36 : 44);
    const vinylCenterY = coverY + coverSize / 2;
    const vinylRadius = coverSize * 0.46;

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(vinylCenterX, vinylCenterY, vinylRadius, 0, Math.PI * 2);
    ctx.fill();

    // Vinyl Grooves
    ctx.strokeStyle = '#27272A';
    ctx.lineWidth = 3;
    [vinylRadius * 0.35, vinylRadius * 0.55, vinylRadius * 0.75, vinylRadius * 0.9].forEach((r) => {
      ctx.beginPath();
      ctx.arc(vinylCenterX, vinylCenterY, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Vinyl Center Colored Disc
    const centerDiscR = coverSize * 0.16;
    ctx.fillStyle = selectedTheme.accentHex;
    ctx.beginPath();
    ctx.arc(vinylCenterX, vinylCenterY, centerDiscR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(vinylCenterX, vinylCenterY, centerDiscR * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Hard Shadow for Album Cover
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(coverX + 8, coverY + 8, coverSize, coverSize, 24);
      ctx.fill();
    }

    // Cover Image Frame
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = displayCoverUrl;
      await new Promise((res) => {
        if (img.complete) res(true);
        img.onload = () => res(true);
        img.onerror = () => res(false);
      });

      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(coverX, coverY, coverSize, coverSize, 24);
      } else {
        ctx.rect(coverX, coverY, coverSize, coverSize);
      }
      ctx.clip();
      ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
      ctx.restore();

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(coverX, coverY, coverSize, coverSize, 24);
      } else {
        ctx.rect(coverX, coverY, coverSize, coverSize);
      }
      ctx.stroke();
    } catch {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(coverX, coverY, coverSize, coverSize, 24);
      } else {
        ctx.rect(coverX, coverY, coverSize, coverSize);
      }
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // 8. SONG TITLE & ARTIST (Punchy Neo-Brutalism Typography)
    const titleY = coverY + coverSize + 48;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.font = isVeryLongMsg ? '900 38px sans-serif' : '900 44px sans-serif';
    ctx.fillText((request.songTitle || 'Judul Lagu').toUpperCase(), 1080 / 2, titleY, 900);

    // Artist in a White Neo-Brutalist Pill
    const artistText = request.artist || 'Penyanyi';
    ctx.font = 'bold 26px sans-serif';
    const artistWidth = Math.min(ctx.measureText(artistText).width + 50, 840);
    const artistX = (1080 - artistWidth) / 2;
    const artistY = titleY + 16;

    // Hard Shadow for Artist Pill
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(artistX + 4, artistY + 4, artistWidth, 44, 22);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(artistX, artistY, artistWidth, 44, 22);
    } else {
      ctx.rect(artistX, artistY, artistWidth, 44);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.fillText(artistText, 1080 / 2, artistY + 31, artistWidth - 30);

    // 9. CONFESSION MEMO CARD (White Neo-Brutalist Note Box with Dynamic Adaptive Height)
    const cardX = 90;
    const cardW = 900;
    const cardY = artistY + 68;
    const footerY = 1750;

    // Prepare message lines and measure height
    let msgFontSize = 32;
    let msgLineHeight = 48;

    if (msgLength > 280) {
      msgFontSize = 22;
      msgLineHeight = 34;
    } else if (msgLength > 180) {
      msgFontSize = 25;
      msgLineHeight = 38;
    } else if (msgLength > 90) {
      msgFontSize = 28;
      msgLineHeight = 44;
    }

    ctx.font = `italic 700 ${msgFontSize}px sans-serif`;
    const fullMsg = `"${rawMsg}"`;
    const paragraphs = fullMsg.split('\n');
    const maxLineW = cardW - 60;
    const messageLines: string[] = [];

    for (let p = 0; p < paragraphs.length; p++) {
      const words = paragraphs[p].split(' ');
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const testLine = line ? `${line} ${words[i]}` : words[i];
        if (ctx.measureText(testLine).width > maxLineW && line) {
          messageLines.push(line);
          line = words[i];
        } else {
          line = testLine;
        }
      }
      if (line) {
        messageLines.push(line);
      }
    }

    // Dynamic card height calculation to avoid empty giant white space!
    const headerSectionH = 145; // DARI + UNTUK + divider
    const textSectionH = messageLines.length * msgLineHeight + 40;
    const computedCardH = headerSectionH + textSectionH;
    const maxAllowedCardH = footerY - cardY - 40;
    const cardH = Math.min(Math.max(computedCardH, isVeryLongMsg ? 360 : 280), maxAllowedCardH);

    // Hard Shadow for Card
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(cardX + 8, cardY + 8, cardW, cardH, 28);
      ctx.fill();
    }

    // Card Body Fill
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cardX, cardY, cardW, cardH, 28);
    } else {
      ctx.rect(cardX, cardY, cardW, cardH);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Row 1: DARI
    const row1Y = cardY + 24;
    const fromBadgeW = 85;
    const fromBadgeH = 36;

    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(cardX + 24, row1Y, fromBadgeW, fromBadgeH, 8);
      ctx.fill();
    } else {
      ctx.fillRect(cardX + 24, row1Y, fromBadgeW, fromBadgeH);
    }
    ctx.fillStyle = '#B8FF00';
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DARI', cardX + 24 + fromBadgeW / 2, row1Y + 25);

    // Sender Name + Class
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.font = '900 24px sans-serif';
    const senderName = request.studentName || 'Anonim';
    const senderClass = request.className ? `(${request.className})` : '';
    const senderFull = `${senderName} ${senderClass}`.trim();
    ctx.fillText(senderFull, cardX + 24 + fromBadgeW + 14, row1Y + 27, cardW - fromBadgeW - 65);

    // Row 2: UNTUK
    const row2Y = row1Y + 46;
    const toBadgeW = 95;
    const toBadgeH = 36;

    // Hard Shadow for UNTUK Badge
    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(cardX + 24 + 3, row2Y + 3, toBadgeW, toBadgeH, 8);
      ctx.fill();
    }
    ctx.fillStyle = selectedTheme.accentHex;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cardX + 24, row2Y, toBadgeW, toBadgeH, 8);
    } else {
      ctx.rect(cardX + 24, row2Y, toBadgeW, toBadgeH);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNTUK', cardX + 24 + toBadgeW / 2, row2Y + 25);

    // Target Person Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.font = '900 24px sans-serif';
    const targetFull = `💘 ${request.targetPerson || 'Semua Teman'}`;
    ctx.fillText(targetFull, cardX + 24 + toBadgeW + 14, row2Y + 27, cardW - toBadgeW - 65);

    // Divider Line
    const dividerY = row2Y + 50;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 24, dividerY);
    ctx.lineTo(cardX + cardW - 24, dividerY);
    ctx.stroke();

    // Message Lines Drawing
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.font = `italic 700 ${msgFontSize}px sans-serif`;

    let currY = dividerY + msgLineHeight;
    for (let i = 0; i < messageLines.length; i++) {
      if (currY > cardY + cardH - 20) break;
      ctx.fillText(messageLines[i], cardX + 28, currY);
      currY += msgLineHeight;
    }

    // 10. FOOTER: DJ HOST & HASHTAG PILLS
    // Host Badge Left
    const hostPillW = 390;
    const hostPillH = 58;
    const hostPillX = 90;

    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(hostPillX + 4, footerY + 4, hostPillW, hostPillH, 18);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(hostPillX, footerY, hostPillW, hostPillH, 18);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`🎙️ ${displayHostString}`, hostPillX + 20, footerY + 38, hostPillW - 35);

    // Hashtag Badge Right
    const tagPillW = 320;
    const tagPillH = 58;
    const tagPillX = 1080 - 90 - tagPillW;

    ctx.fillStyle = '#000000';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(tagPillX + 4, footerY + 4, tagPillW, tagPillH, 18);
      ctx.fill();
    }
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(tagPillX, footerY, tagPillW, tagPillH, 18);
    }
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#B8FF00';
    ctx.font = '900 24px sans-serif';
    ctx.fillText('#EMKARadioConfes', tagPillX + tagPillW / 2, footerY + 39);

    return canvas.toDataURL('image/jpeg', 0.94);
  };

  const handleDownloadStoryImage = async () => {
    setIsGenerating(true);

    try {
      const imageJpeg = await generateNativeCanvasJpeg();
      const link = document.createElement('a');
      const cleanName = (request.studentName || 'Request').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Confession_EMKA_Radio_${cleanName}_${Date.now()}.jpg`;
      link.download = filename;
      link.href = imageJpeg;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate story image:', err);
      alert('Gagal mengunduh gambar. Silakan coba lagi.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNativeShare = async () => {
    setIsGenerating(true);

    try {
      const imageJpeg = await generateNativeCanvasJpeg();
      const res = await fetch(imageJpeg);
      const blob = await res.blob();
      const file = new File([blob], `Story_EMKA_Radio_${request.studentName || 'Confession'}.jpg`, {
        type: 'image/jpeg'
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Confession ${request.studentName} - EMKA Radio`,
          text: `🎵 ${request.songTitle} - ${request.artist}\n💬 "${request.message}"\n#EMKARadio #MenfesSekolah`,
          files: [file]
        });
      } else {
        handleDownloadStoryImage();
      }
    } catch (e) {
      console.warn('Native share failed or unsupported:', e);
      handleDownloadStoryImage();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCaption = () => {
    const text = `🎵 Song Request: ${request.songTitle || 'Judul'} - ${request.artist || 'Penyanyi'}\n💌 From: ${request.studentName || 'Anonim'} (${request.className || 'Sekolah'})\n💘 To: ${request.targetPerson || 'Doi'}\n💬 Message: "${request.message || ''}"\n\n📻 Powered by EMKA Radio Sekolah #EMKARadioConfes`;
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white border-3 border-black rounded-[28px] sm:rounded-[32px] shadow-[8px_8px_0px_0px_#000000] overflow-hidden">
        
        {/* Sticky Modal Header Bar - Always Visible */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-5 border-b-3 border-black bg-[#FFFDF0] z-20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B8FF00] text-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000000] flex-shrink-0">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-black font-display uppercase tracking-wide">
                  Share Confession ke Story IG (9:16)
                </h2>
                <span className="hidden sm:inline-block bg-[#FE90E8] text-black text-[10px] font-black px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_0px_#000]">
                  NEO-BRUTALISM
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-700">Download gambar siap upload ke Instagram / WhatsApp Story</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Tutup modal"
            className="w-10 h-10 rounded-xl bg-white hover:bg-rose-100 active:bg-rose-200 text-black border-2 border-black flex items-center justify-center transition shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 flex-shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F9F9F6]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: 9:16 Neo-Brutalism Story Preview Canvas */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            
            {/* The Actual 9:16 Canvas Frame */}
            <div
              ref={storyCardRef}
              data-story-frame="true"
              className={`relative w-[320px] h-[580px] sm:w-[350px] sm:h-[635px] rounded-[32px] p-4 sm:p-5 flex flex-col justify-between overflow-hidden ${selectedTheme.bgClass} border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000000] select-none`}
            >
              {/* Neo-brutalist Dot Grid Texture Background */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(#000000 1.5px, transparent 1.5px)',
                  backgroundSize: '18px 18px'
                }}
              ></div>

              {/* Decorative Geometric Shapes */}
              <div className="absolute top-2 left-2 text-black/40 font-black text-xs pointer-events-none">+</div>
              <div className="absolute top-2 right-2 text-black/40 font-black text-xs pointer-events-none">+</div>
              <div className="absolute bottom-2 left-2 text-black/40 font-black text-xs pointer-events-none">+</div>
              <div className="absolute bottom-2 right-2 text-black/40 font-black text-xs pointer-events-none">+</div>

              {/* STORY HEADER: 
                  - LEFT: Live Tag
                  - RIGHT: EMKA RADIO BRANDING (Moved to Right as requested!) */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                {/* Left Live Badge */}
                <div className="bg-[#B8FF00] text-black px-2.5 py-1 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                  <span className="text-[10px] font-black tracking-wider uppercase font-display">ON-AIR</span>
                </div>

                {/* RIGHT SIDE: EMKA RADIO ICON & BRANDING */}
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                  <div className="text-right">
                    <h4 className="text-[11px] font-black text-black tracking-wider uppercase font-display leading-none">EMKA RADIO</h4>
                    <p className="text-[8px] font-extrabold text-slate-600 leading-none mt-0.5">Multi Karya</p>
                  </div>
                  <div className="w-7 h-7 rounded-xl bg-[#B8FF00] border-2 border-black flex items-center justify-center text-black shadow-[1px_1px_0px_0px_#000]">
                    <Radio className="w-3.5 h-3.5 text-black" />
                  </div>
                </div>
              </div>

              {/* STORY CENTER: Mood Badge, Vinyl Cover, Song Info, & Confession Box */}
              <div className="relative z-10 my-auto py-1 space-y-2.5 text-center flex-1 flex flex-col justify-center">
                
                {/* Tilted Mood Badge / Sticker */}
                <div className="inline-flex items-center justify-center transform -rotate-2">
                  <span
                    className={`text-[10px] sm:text-[11px] font-black px-3.5 py-1 rounded-xl border-2 border-black text-black shadow-[3px_3px_0px_0px_#000000] uppercase font-display tracking-wider ${selectedTheme.badgeBgClass}`}
                  >
                    ✦ {request.mood || 'Secret Confession'} ✦
                  </span>
                </div>

                {/* Album Cover with Black Vinyl (Responsively Sized) */}
                <div className={`relative mx-auto flex items-center justify-center my-0.5 ${
                  (request.message || '').length > 200
                    ? 'w-24 h-24 sm:w-26 sm:h-26'
                    : (request.message || '').length > 100
                    ? 'w-28 h-28 sm:w-30 sm:h-30'
                    : 'w-32 h-32 sm:w-36 sm:h-36'
                }`}>
                  {/* Vinyl Record */}
                  <div className={`absolute -right-2.5 rounded-full bg-black border-2 border-black flex items-center justify-center shadow-lg ${
                    (request.message || '').length > 200
                      ? 'w-22 h-22'
                      : (request.message || '').length > 100
                      ? 'w-26 h-26'
                      : 'w-28 h-28 sm:w-32 sm:h-32'
                  }`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-black ${selectedTheme.accentBgClass} flex items-center justify-center`}>
                      <Disc className="w-4 h-4 text-black" />
                    </div>
                  </div>

                  {/* Album Cover Box */}
                  <div className={`relative z-10 rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#000000] border-2 sm:border-3 border-black bg-white ${
                    (request.message || '').length > 200
                      ? 'w-24 h-24'
                      : (request.message || '').length > 100
                      ? 'w-28 h-28'
                      : 'w-30 h-30 sm:w-34 sm:h-34'
                  }`}>
                    <img
                      src={displayCoverUrl}
                      alt={request.songTitle || 'Cover'}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>
                </div>

                {/* Song Title & Artist Pill */}
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-black text-black leading-snug line-clamp-2 px-1 font-display uppercase tracking-tight">
                    {request.songTitle || 'Judul Lagu'}
                  </h3>
                  <div className="inline-block bg-white text-black px-3 py-0.5 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_#000] text-[10px] sm:text-[11px] font-black max-w-full truncate">
                    {request.artist || 'Penyanyi'}
                  </div>
                </div>

                {/* Confession Memo Card (White Neo-Brutalist Box with Stacked DARI & UNTUK and Dynamic Text) */}
                <div className="bg-white border-3 border-black rounded-2xl p-3 sm:p-3.5 shadow-[5px_5px_0px_0px_#000000] space-y-2 text-left">
                  {/* Stacked Sender & Recipient Header so neither DARI nor UNTUK gets cut off! */}
                  <div className="space-y-1.5 border-b-2 border-black pb-2 text-[10px] sm:text-[11px]">
                    {/* Row 1: DARI */}
                    <div className="flex items-center space-x-1.5">
                      <span className="bg-black text-[#B8FF00] px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider flex-shrink-0">
                        DARI
                      </span>
                      <span className="font-black text-black break-words leading-tight">
                        {request.studentName || 'Anonim'}
                        {request.className && (
                          <span className="text-slate-500 font-bold ml-1">({request.className})</span>
                        )}
                      </span>
                    </div>

                    {/* Row 2: UNTUK (Full width, no truncation) */}
                    <div className="flex items-center space-x-1.5">
                      <span className={`${selectedTheme.accentBgClass} text-black border border-black px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider flex-shrink-0`}>
                        UNTUK
                      </span>
                      <span className="font-black text-black break-words leading-tight flex items-center gap-1">
                        <span>💘</span>
                        <span>{request.targetPerson || 'Semua Teman'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Confession Message text - dynamically sized, no line-clamp, fully readable */}
                  <div className="pt-0.5">
                    <p className={`text-black italic font-bold break-words whitespace-pre-wrap ${
                      (request.message || '').length > 220
                        ? 'text-[10px] sm:text-[11px] leading-tight'
                        : (request.message || '').length > 110
                        ? 'text-[11px] sm:text-xs leading-snug'
                        : 'text-xs sm:text-sm leading-relaxed'
                    }`}>
                      "{request.message || 'Pesan confession untuk doi...'}"
                    </p>
                  </div>
                </div>

              </div>

              {/* STORY FOOTER: Host & Hashtag */}
              <div className="relative z-10 pt-1 flex items-center justify-between gap-2 text-[10px]">
                <div className="bg-white px-2.5 py-1 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center space-x-1 font-bold text-black truncate max-w-[55%]">
                  <Mic className="w-3 h-3 text-black flex-shrink-0" />
                  <span className="truncate">{displayHostString}</span>
                </div>

                <div className="bg-black text-[#B8FF00] px-2.5 py-1 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] font-black text-[10px] tracking-wider font-display">
                  #EMKARadioConfes
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Neo-Brutalism Themes & Download Actions */}
          <div className="lg:col-span-6 space-y-5">
            
            {/* Neo-Brutalism Theme Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-black uppercase tracking-wider block font-display">
                  🎨 Pilih Tema Warna Neo-Brutalism:
                </label>
                <span className="text-[10px] font-black bg-[#B8FF00] text-black px-2 py-0.5 rounded-full border border-black">
                  6 Tema Pilihan
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {NEO_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t)}
                    className={`p-2.5 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-2 active:scale-95 ${
                      selectedTheme.id === t.id
                        ? 'bg-white border-black text-black font-black shadow-[4px_4px_0px_0px_#000000] ring-2 ring-black'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-black shadow-sm'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded-xl border-2 border-black shadow-[1px_1px_0px_0px_#000] flex-shrink-0"
                        style={{ backgroundColor: t.previewColor }}
                      ></div>
                      <span className="text-[11px] font-black truncate text-black">{t.name}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span 
                        className="w-3.5 h-3.5 rounded-md border border-black" 
                        style={{ backgroundColor: t.accentHex }}
                      ></span>
                      <span 
                        className="w-3.5 h-3.5 rounded-md border border-black" 
                        style={{ backgroundColor: t.badgeHex }}
                      ></span>
                      <span 
                        className="w-3.5 h-3.5 rounded-md border border-black" 
                        style={{ backgroundColor: t.tagBgHex }}
                      ></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Details Summary Box */}
            <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_#000000] space-y-2">
              <div className="text-xs font-black text-black flex items-center space-x-2 border-b-2 border-black pb-2">
                <MessageCircleHeart className="w-4 h-4 text-[#FE90E8]" />
                <span className="font-display uppercase tracking-wider">Rincian Confession & Lagu</span>
              </div>
              <div className="text-xs text-black space-y-1 font-bold">
                <p><span className="text-slate-500 font-semibold">Lagu:</span> {request.songTitle} - {request.artist}</p>
                <p><span className="text-slate-500 font-semibold">Pengirim:</span> {request.studentName} ({request.className})</p>
                <p><span className="text-slate-500 font-semibold">Tujuan:</span> {request.targetPerson}</p>
                <p><span className="text-slate-500 font-semibold">Pesan:</span> "{request.message}"</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-1">
              <button
                onClick={handleDownloadStoryImage}
                disabled={isGenerating}
                className="w-full py-3.5 sm:py-4 px-5 rounded-2xl bg-[#B8FF00] hover:bg-[#a3e600] text-black font-black text-xs sm:text-sm border-3 border-black shadow-[5px_5px_0px_0px_#000000] transition flex items-center justify-center space-x-2 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-black" />
                    <span>Mempersiapkan Gambar Story Neo-Brutalism...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 text-black" />
                    <span>Download Gambar Story (9:16 JPEG ~1MB)</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleNativeShare}
                  disabled={isGenerating}
                  className="py-3 px-4 rounded-xl bg-[#C0F7FE] hover:bg-cyan-200 text-black font-black text-xs transition border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center space-x-1.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-black" />
                  <span>Share Langsung</span>
                </button>

                <button
                  onClick={handleCopyCaption}
                  className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-black font-black text-xs transition border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center space-x-1.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Caption Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#FE90E8]" />
                      <span>Salin Caption Teks</span>
                    </>
                  )}
                </button>
              </div>

              {/* Dedicated Kembali / Tutup Button below Share & Salin */}
              <button
                onClick={onClose}
                type="button"
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-rose-50 active:bg-rose-100 text-black font-black text-xs sm:text-sm transition border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center space-x-2 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
                <span>Kembali / Tutup Preview</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-600 font-bold text-center leading-relaxed">
              💡 Tip: Setelah download, upload file gambar ke Instagram / WhatsApp Story Anda dan tambahkan stiker musik resmi dari Instagram untuk efek audio yang lebih viral!
            </p>

          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

