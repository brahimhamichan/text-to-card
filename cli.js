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

const { version: VERSION } = require('./package.json');

const WIDTH = 1920;
const HEIGHT = 1080;
const OUTPUT_DIR = 'cards';
const SLUG_MAX = 48;

// libvips/Pango spells the centered alignment the British way; alias it for clarity.
const ALIGN_CENTER = 'centre';
const ALIGN_LEFT = 'left';

// Optional --logo watermark: fraction of canvas height for the mark, and the
// margin from the bottom-right corner (also as a fraction of the canvas).
const LOGO_HEIGHT_RATIO = 0.09;
const LOGO_MARGIN_RATIO = 0.035;

// Named themes: swap background/foreground as a pair. `light` is the default.
const THEMES = {
  light: { bg: '#f7f7f2', fg: '#111111' },
  dark: { bg: '#111111', fg: '#f7f7f2' },
  midnight: { bg: '#0f172a', fg: '#e2e8f0' },
  paper: { bg: '#fffdf7', fg: '#1a1a1a' }
};

const DEFAULT_BACKGROUND = THEMES.light.bg;
const DEFAULT_FOREGROUND = THEMES.light.fg;

// Named size presets (width × height). Default matches the original 16:9 card.
const SIZES = {
  '16:9': [1920, 1080],
  wide: [1920, 1080],
  square: [1080, 1080],
  og: [1200, 630],
  story: [1080, 1920],
  portrait: [1080, 1350]
};

function cliName() {
  const base = path.basename(process.argv[1] || 'txt2card');
  return base === 'text-to-card' || base === 'txt2card' ? base : 'txt2card';
}

function helpText(name = cliName()) {
  return `Usage:
  ${name} title "Title" [options]
  ${name} text "Text" [options]
  ${name} description "Title" "Description" [options]   (alias: title-description)
  ${name} bullets "First point" "Second point" [options]
  ${name} title-bullets "Title" "First point" "Second point" [options]   (alias: list)

Options:
  -o, --output <path>   Output file (default: cards/card_<timestamp>_<slug>.png)
  --theme <name>        ${Object.keys(THEMES).join(', ')} (default: light)
  --bg <color>          Background color (hex like #0f172a or a named color)
  --fg <color>          Text color (hex or named color)
  --size <preset|WxH>   ${Object.keys(SIZES).join(', ')}, or e.g. 1600x900 (default: 16:9)
  --logo <path>         Watermark image placed in the bottom-right corner
  -v, --version         Print version and exit
  -h, --help            Show this help

Read a value from stdin by passing "-" in its place:
  echo "Piped title" | ${name} title -

Commands: txt2card (preferred) or text-to-card
Default output: cards/card_YYYY_MM_DD_HH_mm_ss_<Text_Slug>.png
Fonts are bundled (Inter) so renders match across macOS, Linux, and Windows.`;
}

// Escape all five XML predefined entities. Text is injected as Pango markup body
// content (never into an attribute), so `<` and `&` are the only strictly-required
// escapes; quotes are escaped too so this stays a correct general-purpose escaper.
function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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
  if (
    template === 'description' ||
    template === 'title-description' ||
    template === 'title-bullets' ||
    template === 'list'
  ) {
    return values[0] || '';
  }
  // Use every bullet (SLUG_MAX bounds the final length) so the filename reflects
  // what was actually rendered — render draws all bullets, not just the first three.
  if (template === 'bullets') return values.join(' ');
  return values.join(' ');
}

function defaultOutputPath(template, values, date = new Date()) {
  const slug = toSnakeStyle(contentForSlug(template, values));
  return path.join(OUTPUT_DIR, `card_${formatTimestamp(date)}_${slug}.png`);
}

/** Validate a color string: hex (#rgb / #rrggbb / #rrggbbaa) or a plain named color. */
function normalizeColor(value, label) {
  const color = String(value).trim();
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) return color;
  if (/^[a-zA-Z]+$/.test(color)) return color.toLowerCase(); // named colors (Pango/libvips accept these)
  throw new Error(`Invalid ${label} color: ${value} (use hex like #0f172a or a color name)`);
}

/** Resolve --size into [width, height] from a preset name or a WxH string. */
function parseSize(value) {
  const key = String(value).trim().toLowerCase();
  if (SIZES[key]) return [...SIZES[key]];
  const match = key.match(/^(\d+)\s*[x×]\s*(\d+)$/);
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w >= 64 && h >= 64 && w <= 8000 && h <= 8000) return [w, h];
  }
  throw new Error(
    `Invalid size: ${value} (use a preset [${Object.keys(SIZES).join(', ')}] or WxH like 1600x900)`
  );
}

async function textImage(text, width, height, bold, align, foreground) {
  return sharp({
    text: {
      text: `<span foreground="${foreground}">${escapeXml(text)}</span>`,
      font: bold ? 'Inter Bold' : 'Inter',
      fontfile: bold ? FONT_BOLD : FONT_REGULAR,
      width,
      height,
      align,
      rgba: true
    }
  }).png().toBuffer({ resolveWithObject: true });
}

function centered(image, info, y, width) {
  return { input: image, left: Math.round((width - info.width) / 2), top: Math.round(y) };
}

/** Warn (without failing) if a text block is taller than the box it was fit into. */
function warnIfClipped(result, boxHeight, label, warn) {
  if (result.info.height > boxHeight + 1) {
    warn(`warning: ${label} text may be clipped \u2014 try shorter text or a larger --size`);
  }
}

async function render(template, values, output, opts = {}) {
  const [width, height] = opts.size || [WIDTH, HEIGHT];
  const foreground = opts.foreground || DEFAULT_FOREGROUND;
  const background = opts.background || DEFAULT_BACKGROUND;
  const warn = opts.warn || (message => console.error(`${cliName()}: ${message}`));

  // Layout boxes/margins are defined as fractions of the canvas so any size scales cleanly.
  const boxW = Math.round(width * (1600 / WIDTH));
  const innerW = Math.round(width * (1500 / WIDTH));
  const left = Math.round(width * (210 / WIDTH));
  const scaleH = boxHeight => Math.round(height * (boxHeight / HEIGHT));
  const scaleGap = gap => Math.round(height * (gap / HEIGHT));

  let layers;

  if (template === 'title' || template === 'text') {
    const box = scaleH(760);
    const result = await textImage(values.join(' '), boxW, box, template === 'title', ALIGN_CENTER, foreground);
    warnIfClipped(result, box, template, warn);
    layers = [centered(result.data, result.info, (height - result.info.height) / 2, width)];
  } else if (template === 'description' || template === 'title-description') {
    const titleBox = scaleH(280);
    const descBox = scaleH(360);
    const title = await textImage(values[0], boxW, titleBox, true, ALIGN_CENTER, foreground);
    const description = await textImage(values.slice(1).join(' '), innerW, descBox, false, ALIGN_CENTER, foreground);
    warnIfClipped(title, titleBox, 'title', warn);
    warnIfClipped(description, descBox, 'description', warn);
    const gap = scaleGap(60);
    const top = (height - title.info.height - description.info.height - gap) / 2;
    layers = [
      centered(title.data, title.info, top, width),
      centered(description.data, description.info, top + title.info.height + gap, width)
    ];
  } else if (template === 'bullets') {
    const box = scaleH(760);
    const result = await textImage(
      values.map(value => `\u2022  ${value}`).join('\n'),
      innerW,
      box,
      false,
      ALIGN_LEFT,
      foreground
    );
    warnIfClipped(result, box, 'bullets', warn);
    layers = [{ input: result.data, left, top: Math.round((height - result.info.height) / 2) }];
  } else if (template === 'title-bullets' || template === 'list') {
    // Clean layout: bold title over left-aligned bullets, shared left margin, centered as a block.
    const titleBox = scaleH(220);
    const bulletsBox = scaleH(520);
    const title = await textImage(values[0], innerW, titleBox, true, ALIGN_LEFT, foreground);
    const bullets = await textImage(
      values.slice(1).map(value => `\u2022  ${value}`).join('\n'),
      innerW,
      bulletsBox,
      false,
      ALIGN_LEFT,
      foreground
    );
    warnIfClipped(title, titleBox, 'title', warn);
    warnIfClipped(bullets, bulletsBox, 'bullets', warn);
    const gap = scaleGap(56);
    const blockHeight = title.info.height + gap + bullets.info.height;
    const top = (height - blockHeight) / 2;
    layers = [
      { input: title.data, left, top: Math.round(top) },
      { input: bullets.data, left, top: Math.round(top + title.info.height + gap) }
    ];
  } else {
    throw new Error(`Unknown template: ${template}`);
  }

  if (opts.logo) {
    layers.push(await logoLayer(opts.logo, width, height));
  }

  const resolved = path.resolve(output);
  await fsp.mkdir(path.dirname(resolved), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background } })
    .composite(layers)
    .png()
    .toFile(resolved);
  return resolved;
}

/** Build a bottom-right watermark layer from a logo image scaled to the canvas. */
async function logoLayer(logoPath, width, height) {
  const targetHeight = Math.round(height * LOGO_HEIGHT_RATIO);
  const margin = Math.round(Math.min(width, height) * LOGO_MARGIN_RATIO);
  const logo = await sharp(logoPath)
    .resize({ height: targetHeight, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  return {
    input: logo.data,
    left: Math.max(0, width - logo.info.width - margin),
    top: Math.max(0, height - logo.info.height - margin)
  };
}

function parseArgs(args) {
  if (!args.length || args.includes('-h') || args.includes('--help')) return { help: true, helpText: helpText() };
  if (args.includes('-v') || args.includes('--version')) return { version: true, versionText: VERSION };

  const template = args.shift();
  const values = [];
  let output;
  let theme;
  let bg;
  let fg;
  let size;
  let logo;

  const takeValue = (flag, rest) => {
    if (!rest.length) throw new Error(`Missing value for ${flag}`);
    return rest.shift();
  };

  while (args.length) {
    const value = args.shift();
    if (value === '-o' || value === '--output') {
      output = takeValue(value, args);
    } else if (value === '--theme') {
      theme = takeValue(value, args);
    } else if (value === '--bg') {
      bg = takeValue(value, args);
    } else if (value === '--fg') {
      fg = takeValue(value, args);
    } else if (value === '--size') {
      size = takeValue(value, args);
    } else if (value === '--logo') {
      logo = takeValue(value, args);
    } else {
      values.push(value);
    }
  }

  const multiValue = new Set(['description', 'title-description', 'bullets', 'title-bullets', 'list']);
  const minimum = multiValue.has(template) ? 2 : 1;
  if (values.length < minimum) {
    throw new Error(`Template ${template} needs at least ${minimum} value${minimum === 1 ? '' : 's'}`);
  }

  if (theme && !THEMES[theme]) {
    throw new Error(`Unknown theme: ${theme} (choose from ${Object.keys(THEMES).join(', ')})`);
  }
  const palette = THEMES[theme || 'light'];
  const background = normalizeColor(bg || palette.bg, 'background');
  const foreground = normalizeColor(fg || palette.fg, 'foreground');
  const resolvedSize = size ? parseSize(size) : [WIDTH, HEIGHT];

  if (logo && !fs.existsSync(logo)) {
    throw new Error(`Logo file not found: ${logo}`);
  }

  const autoOutput = !output;
  return {
    template,
    values,
    output: output || defaultOutputPath(template, values),
    autoOutput,
    background,
    foreground,
    size: resolvedSize,
    logo
  };
}

/** Read all of stdin as UTF-8 (used when a value is passed as "-"). */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data.replace(/\s+$/, '')));
    process.stdin.on('error', reject);
  });
}

/** Append _2, _3, … before the extension so auto-named cards never clobber. */
function uniquePath(target) {
  if (!fs.existsSync(target)) return target;
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  for (let index = 2; ; index += 1) {
    const candidate = path.join(dir, `${base}_${index}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) return console.log(options.helpText || helpText());
  if (options.version) return console.log(options.versionText || VERSION);

  // Resolve any "-" placeholders from stdin (at most one per invocation).
  const stdinSlots = options.values.filter(value => value === '-').length;
  if (stdinSlots > 1) throw new Error('Only one value may be read from stdin ("-")');
  if (stdinSlots === 1) {
    const piped = await readStdin();
    if (!piped) throw new Error('No stdin provided for "-"');
    options.values = options.values.map(value => (value === '-' ? piped : value));
  }

  // Auto-named cards get a unique suffix so same-second renders never clobber.
  const target = options.autoOutput ? uniquePath(options.output) : options.output;

  const output = await render(options.template, options.values, target, {
    background: options.background,
    foreground: options.foreground,
    size: options.size,
    logo: options.logo
  });
  console.log(output);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`${cliName()}: ${error.message}\n\n${helpText()}`);
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
  normalizeColor,
  parseSize,
  uniquePath,
  THEMES,
  SIZES,
  OUTPUT_DIR
};
