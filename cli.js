#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const WIDTH = 1920;
const HEIGHT = 1080;
const BACKGROUND = '#f7f7f2';
const FOREGROUND = '#111111';

const help = `Usage:
  text-to-card title "Title" [-o card.png]
  text-to-card text "Text" [-o card.png]
  text-to-card description "Title" "Description" [-o card.png]
  text-to-card bullets "First point" "Second point" [-o card.png]`;

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function textImage(text, width, height, font, align = 'centre') {
  return sharp({
    text: {
      text: `<span foreground="${FOREGROUND}">${escapeXml(text)}</span>`,
      font,
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
    const result = await textImage(values.join(' '), 1600, 760, template === 'title' ? 'sans Bold' : 'sans');
    layers = [centered(result.data, result.info, (HEIGHT - result.info.height) / 2)];
  } else if (template === 'description' || template === 'title-description') {
    const title = await textImage(values[0], 1600, 280, 'sans Bold');
    const description = await textImage(values.slice(1).join(' '), 1500, 360, 'sans');
    const gap = 60;
    const top = (HEIGHT - title.info.height - description.info.height - gap) / 2;
    layers = [
      centered(title.data, title.info, top),
      centered(description.data, description.info, top + title.info.height + gap)
    ];
  } else if (template === 'bullets') {
    const result = await textImage(values.map(value => `\u2022  ${value}`).join('\n'), 1500, 760, 'sans', 'left');
    layers = [{ input: result.data, left: 210, top: Math.round((HEIGHT - result.info.height) / 2) }];
  } else {
    throw new Error(`Unknown template: ${template}`);
  }

  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: BACKGROUND } })
    .composite(layers)
    .png()
    .toFile(output);
}

function parseArgs(args) {
  if (!args.length || args.includes('-h') || args.includes('--help')) return { help: true };

  const template = args.shift();
  const values = [];
  let output = 'card.png';

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
  if (values.length < minimum) throw new Error(`Template ${template} needs at least ${minimum} value${minimum === 1 ? '' : 's'}`);
  return { template, values, output };
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) return console.log(help);
  await render(options.template, options.values, options.output);
  console.log(path.resolve(options.output));
}

if (require.main === module) main().catch(error => {
  console.error(`text-to-card: ${error.message}\n\n${help}`);
  process.exitCode = 1;
});

module.exports = { render };
