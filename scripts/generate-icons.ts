import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Renders the PWA icon set from the Lucide "sparkles" glyph (ISC licensed).
 * The glyph is third-party UI iconography, not hand-drawn game art.
 */
const OUT_DIR = path.join(process.cwd(), "public", "icons");

const GLYPH = `
  <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
  <path d="M20 2v4" />
  <path d="M22 4h-4" />
  <circle cx="4" cy="20" r="2" />
`;

type IconSpec = {
  file: string;
  size: number;
  glyphRatio: number;
  radius: number;
};

const ICONS: IconSpec[] = [
  { file: "icon-192.png", size: 192, glyphRatio: 0.62, radius: 42 },
  { file: "icon-512.png", size: 512, glyphRatio: 0.62, radius: 112 },
  { file: "maskable-512.png", size: 512, glyphRatio: 0.5, radius: 0 },
  { file: "apple-touch-icon.png", size: 180, glyphRatio: 0.62, radius: 0 },
];

function iconSvg({ size, glyphRatio, radius }: IconSpec): string {
  const glyphSize = size * glyphRatio;
  const scale = glyphSize / 24;
  const inset = (size - glyphSize) / 2;
  const ringInset = size * 0.02;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0" stop-color="#14342d" />
      <stop offset="0.55" stop-color="#0b1219" />
      <stop offset="1" stop-color="#080b11" />
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${size * 0.012}" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)" />
  ${
    radius > 0
      ? `<rect x="${ringInset}" y="${ringInset}" width="${size - ringInset * 2}" height="${size - ringInset * 2}" rx="${Math.max(0, radius - ringInset)}" fill="none" stroke="#3ad7c0" stroke-opacity="0.18" stroke-width="${Math.max(1, size * 0.004)}" />`
      : ""
  }
  <g transform="translate(${inset} ${inset}) scale(${scale})" fill="none" stroke="#ffc94a" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
    ${GLYPH}
  </g>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const icon of ICONS) {
    const target = path.join(OUT_DIR, icon.file);
    await sharp(Buffer.from(iconSvg(icon))).png().toFile(target);
    console.log(`wrote public/icons/${icon.file}`);
  }
}

void main();

