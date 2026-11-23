'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { LOGO_MARK } from '@/lib/logo-mark';
import {
  adventTitle,
  formatCertificateDate,
  type AdventEvent,
  type CertificateData,
} from '@/lib/advent-certificate';

// Drawn on a canvas, not as SVG, so the PNG download uses the page's own fonts.
// The certificate is a light "paper" in both site themes.
const W = 1600;
const H = 1130;
const SCALE = 1.5; // 2400x1695 PNG

const INK = '#0F1A14';
const MUTED = '#5B6660';
const GREEN = '#16A34A';
const BRIGHT = '#22C55E';
const PAPER = '#FFFFFF';
const LINE = '#E3E8E5';

export interface CertificateCanvasHandle {
  toPngBlob: () => Promise<Blob | null>;
}

interface Props {
  advent: AdventEvent;
  data: CertificateData;
  className?: string;
}

function fontStack(): { sans: string; mono: string } {
  const body = typeof document !== 'undefined' ? getComputedStyle(document.body).fontFamily : '';
  return {
    sans: body || 'Inter, "Segoe UI", Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  };
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  start: number,
  maxWidth: number,
  min: number
): number {
  let size = start;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, sans: string) {
  const s = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  roundRect(
    ctx,
    LOGO_MARK.square.x,
    LOGO_MARK.square.y,
    LOGO_MARK.square.size,
    LOGO_MARK.square.size,
    LOGO_MARK.square.radius
  );
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.strokeStyle = BRIGHT;
  ctx.lineWidth = LOGO_MARK.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(LOGO_MARK.chevron));
  ctx.stroke(new Path2D(LOGO_MARK.cursor));
  ctx.restore();

  ctx.font = `700 ${Math.round(size * 0.62)}px ${sans}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  const first = 'DevOps ';
  ctx.fillText(first, x + size + 16, y + size / 2 + 1);
  const firstWidth = ctx.measureText(first).width;
  ctx.fillStyle = GREEN;
  ctx.fillText('Daily', x + size + 16 + firstWidth, y + size / 2 + 1);
}

export function drawCertificate(
  ctx: CanvasRenderingContext2D,
  advent: AdventEvent,
  data: CertificateData
) {
  const { sans, mono } = fontStack();
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // Paper and frame
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(22, 163, 74, 0.05)';
  for (let x = 72; x < W - 60; x += 28) {
    for (let y = 72; y < H - 60; y += 28) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  // Header: brand on the left, certificate id on the right
  drawLogo(ctx, 104, 100, 56, sans);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MUTED;
  ctx.font = `500 20px ${mono}`;
  ctx.fillText('CERTIFICATE ID', W - 104, 118);
  ctx.fillStyle = INK;
  ctx.font = `600 28px ${mono}`;
  ctx.fillText(data.id, W - 104, 154);

  // Title block
  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = `500 26px ${mono}`;
  ctx.fillText('// certificate of completion', W / 2, 282);

  const title = adventTitle(advent);
  const titleSize = fitText(ctx, title, (n) => `800 ${n}px ${sans}`, 84, W - 260, 48);
  ctx.font = `800 ${titleSize}px ${sans}`;
  const yearText = String(advent.year);
  const nameText = `${advent.name} `;
  const titleWidth = ctx.measureText(title).width;
  const titleX = W / 2 - titleWidth / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.fillText(nameText, titleX, 380);
  ctx.fillStyle = GREEN;
  ctx.fillText(yearText, titleX + ctx.measureText(nameText).width, 380);

  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${sans}`;
  ctx.fillText('This certifies that', W / 2, 470);

  // The name, as large as fits
  const nameSize = fitText(ctx, data.name, (n) => `700 ${n}px ${sans}`, 92, W - 300, 40);
  ctx.font = `700 ${nameSize}px ${sans}`;
  ctx.fillStyle = INK;
  ctx.fillText(data.name, W / 2, 578);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 360, 612);
  ctx.lineTo(W / 2 + 360, 612);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${sans}`;
  const full = data.days >= advent.totalDays;
  const line = full
    ? `completed all ${advent.totalDays} ${advent.achievement}`
    : `completed ${data.days} of ${advent.totalDays} ${advent.achievement}`;
  fitText(ctx, line, (n) => `400 ${n}px ${sans}`, 30, W - 260, 20);
  ctx.fillText(line, W / 2, 668);

  // One square per day, filled for the days done
  const cell = 34;
  const gap = 10;
  const rowWidth = advent.totalDays * cell + (advent.totalDays - 1) * gap;
  const startX = W / 2 - rowWidth / 2;
  for (let i = 0; i < advent.totalDays; i++) {
    const x = startX + i * (cell + gap);
    roundRect(ctx, x, 724, cell, cell, 7);
    if (i < data.days) {
      ctx.fillStyle = GREEN;
      ctx.fill();
    } else {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.fillStyle = MUTED;
  ctx.font = `500 20px ${mono}`;
  ctx.fillText(`${data.days} / ${advent.totalDays} days`, W / 2, 800);

  // Footer: date, seal, site
  const footY = 930;
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `500 20px ${mono}`;
  ctx.fillText('ISSUED', 140, footY - 40);
  ctx.fillStyle = INK;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(formatCertificateDate(data.date), 140, footY);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, footY + 22);
  ctx.lineTo(480, footY + 22);
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.font = `500 20px ${mono}`;
  ctx.fillText('ISSUED BY', W - 140, footY - 40);
  ctx.fillStyle = INK;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText('DevOps Daily', W - 140, footY);
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(W - 480, footY + 22);
  ctx.lineTo(W - 140, footY + 22);
  ctx.stroke();

  // Seal
  const cx = W / 2;
  const cy = 912;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.strokeStyle = BRIGHT;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = BRIGHT;
  ctx.font = `800 36px ${sans}`;
  ctx.fillText(`${data.days}/${advent.totalDays}`, cx, cy - 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 15px ${mono}`;
  ctx.fillText('DAYS DONE', cx, cy + 30);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MUTED;
  ctx.font = `400 19px ${sans}`;
  ctx.fillText(
    `Self-reported completion · devops-daily.com${advent.path} · ${advent.hashtag}`,
    W / 2,
    H - 84
  );
  ctx.restore();
}

/** The certificate as a responsive canvas. The handle exports it as a PNG. */
export const CertificateCanvas = forwardRef<CertificateCanvasHandle, Props>(
  function CertificateCanvas({ advent, data, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      toPngBlob: () =>
        new Promise((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas) return resolve(null);
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        }),
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      let cancelled = false;
      const draw = () => {
        if (cancelled) return;
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        drawCertificate(ctx, advent, data);
      };
      draw();
      // Draw again once the web font is in, so the PNG never uses the fallback.
      document.fonts?.ready.then(draw).catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [advent, data]);

    const title = adventTitle(advent);
    return (
      <canvas
        ref={canvasRef}
        width={W * SCALE}
        height={H * SCALE}
        role="img"
        aria-label={`${title} certificate of completion for ${data.name}: ${data.days} of ${advent.totalDays} days, issued ${formatCertificateDate(data.date)} by DevOps Daily. Certificate ID ${data.id}.`}
        className={className}
        style={{ width: '100%', height: 'auto', aspectRatio: `${W} / ${H}` }}
      />
    );
  }
);
