import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';

const SRC = 'public/icons/source-logo.svg';
const OUT = 'public/icons';

if (!existsSync(SRC)) {
  console.error(`Error: Source file not found: ${SRC}`);
  process.exit(1);
}

try {
  mkdirSync(OUT, { recursive: true });

  const sizes = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512];

  for (const size of sizes) {
    await sharp(SRC)
      .resize(size, size)
      .png()
      .toFile(`${OUT}/icon-${size}.png`);
    console.log(`✓ icon-${size}.png`);
  }

  await sharp(SRC).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
  console.log('✓ apple-touch-icon.png');

  for (const size of [192, 512]) {
    const inner = Math.round(size * 0.8);
    const pad = Math.round(size * 0.1);
    await sharp(SRC)
      .resize(inner, inner)
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: { r: 99, g: 102, b: 241, alpha: 1 },
      })
      .png()
      .toFile(`${OUT}/icon-maskable-${size}.png`);
    console.log(`✓ icon-maskable-${size}.png`);
  }

  console.log('\nAll icons generated.');
} catch (err) {
  console.error('Error generating icons:', err.message);
  process.exit(1);
}
