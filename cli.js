#!/usr/bin/env node

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const FONTS_DIR = path.join(__dirname, 'fonts');
const FONT_REGULAR = path.join(FONTS_DIR, 'Inter-Regular.ttf');
const FONT_BOLD = path.join(FONTS_DIR, 'Inter-Bold.ttf');

// Point fontconfig at bundled fonts before sharp/libvips loads (portable across OS).
if (!process.env.FONTCONFIG_FILE && !process.env.FONTCONFIG_PATH) {
  const cacheDir = path.join(os.tmpdir(), 'text-to-card-fontconfig');
  fs.mkdirSync(cacheDir, { recursive: true });
  const confPath = path.join(cacheDir, 'fonts.conf');
  fs.writeFileSync(
    confPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${FONTS_DIR}</dir>
  <cachedir>${cacheDir}</cachedir>
  <config></config>
</fontconfig>
`
  );
  process.env.FONTCONFIG_FILE = confPath;
}

const sharp = require('sharp');

const WIDTH = 1920;
const HEIGHT = 1080;
const BACKGROUND = '#f7f7f2';
const FOREGROUND = '#111111';
const OUTPUT_DIR = 'cards';
const SLUG_MAX = 48;

const help = `Usage:
  text-to-card title "Title" [-o path.png]
  text-to-card text "Text" [-o path.png]
  text-to-card description "Title" "Description" [-o path.png]
  text-to-card bullets "First point" "Second point" [-o path.png]

Default output: cards/card_YYYY_MM_DD_HH_mm_ss_<Text_Slug>.png
Fonts are bundled (Inter) so renders match across macOS, Linux, and Windows.`;

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('_');
}

/** Turn free text into Snake_Style slug for filenames. */
function toSnakeStyle(text, maxLength = SLUG_MAX) {
  const parts = String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());

  let slug = parts.join('_') || 'Card';
  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/_+$/g, '');
    if (!slug) slug = 'Card';
  }
  return slug;
}

function contentForSlug(template, values) {
  if (template === 'description' || template === 'title-description') return values[0] || '';
  if (template === 'bullets') return values.slice(0, 3).join(' ');
  return values.join(' ');
}

function defaultOutputPath(template, values, date = new Date()) {
  const slug = toSnakeStyle(contentForSlug(template, values));
  return path.join(OUTPUT_DIR, `card_${formatTimestamp(date)}_${slug}.png`);
}

async function textImage(text, width, height, bold = false, align = 'centre') {
  return sharp({
    text: {
      text: `<span foreground="${FOREGROUND}">${escapeXml(text)}</span>`,
      font: bold ? 'Inter Bold' : 'Inter',
      fontfile: bold ? FONT_BOLD : FONT_REGULAR,
      width,
      height,
      align,
      rgba: true
    }
  }).png().toBuffer({ resolveWithObject: true });
}

function centered(image, info, y) {
  return { input: image, left: Math.round((WIDTH - info.width) / 2), top: Math.round(y) };
}

async function render(template, values, output) {
  let layers;

  if (template === 'title' || template === 'text') {
    const result = await textImage(values.join(' '), 1600, 760, template === 'title');
    layers = [centered(result.data, result.info, (HEIGHT - result.info.height) / 2)];
  } else if (template === 'description' || template === 'title-description') {
    const title = await textImage(values[0], 1600, 280, true);
    const description = await textImage(values.slice(1).join(' '), 1500, 360, false);
    const gap = 60;
    const top = (HEIGHT - title.info.height - description.info.height - gap) / 2;
    layers = [
      centered(title.data, title.info, top),
      centered(description.data, description.info, top + title.info.height + gap)
    ];
  } else if (template === 'bullets') {
    const result = await textImage(values.map(value => `\u2022  ${value}`).join('\n'), 1500, 760, false, 'left');
    layers = [{ input: result.data, left: 210, top: Math.round((HEIGHT - result.info.height) / 2) }];
  } else {
    throw new Error(`Unknown template: ${template}`);
  }

  const resolved = path.resolve(output);
  await fsp.mkdir(path.dirname(resolved), { recursive: true });
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: BACKGROUND } })
    .composite(layers)
    .png()
    .toFile(resolved);
  return resolved;
}

function parseArgs(args) {
  if (!args.length || args.includes('-h') || args.includes('--help')) return { help: true };

  const template = args.shift();
  const values = [];
  let output;

  while (args.length) {
    const value = args.shift();
    if (value === '-o' || value === '--output') {
      if (!args.length) throw new Error('Missing output path');
      output = args.shift();
    } else {
      values.push(value);
    }
  }

  const minimum = template === 'description' || template === 'title-description' || template === 'bullets' ? 2 : 1;
  if (values.length < minimum) {
    throw new Error(`Template ${template} needs at least ${minimum} value${minimum === 1 ? '' : 's'}`);
  }

  return {
    template,
    values,
    output: output || defaultOutputPath(template, values)
  };
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) return console.log(help);
  const output = await render(options.template, options.values, options.output);
  console.log(output);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`text-to-card: ${error.message}\n\n${help}`);
    process.exitCode = 1;
  });
}

module.exports = {
  render,
  parseArgs,
  defaultOutputPath,
  toSnakeStyle,
  formatTimestamp,
  contentForSlug,
  OUTPUT_DIR
};
