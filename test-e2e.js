#!/usr/bin/env node

/**
 * End-to-end suite: spawns the real CLI, generates PNGs, asserts naming + pixels.
 */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { toSnakeStyle, contentForSlug } = require('./cli');

const ROOT = __dirname;
const CLI = path.join(ROOT, 'cli.js');
const NAME_RE = /^card_\d{4}(?:_\d{2}){5}_[A-Za-z0-9_]+\.png$/;

function run(args, cwd) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env }
  });
  return result;
}

function assertOk(result, label) {
  assert.equal(result.status, 0, `${label} failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
}

async function assertCardImage(filePath, label) {
  const stat = await fsp.stat(filePath);
  assert.ok(stat.size > 5_000, `${label}: file too small (${stat.size} bytes)`);

  const metadata = await sharp(filePath).metadata();
  assert.equal(metadata.width, 1920, `${label}: width`);
  assert.equal(metadata.height, 1080, `${label}: height`);
  assert.equal(metadata.format, 'png', `${label}: format`);

  const stats = await sharp(filePath).stats();
  // Text is near-black on cream; min channel should drop well below background.
  assert.ok(stats.channels[0].min < 80, `${label}: expected dark text pixels`);
  assert.ok(stats.channels[0].max > 200, `${label}: expected light background`);
}

async function main() {
  const work = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'text-to-card-e2e-')));
  const cardsDir = path.join(work, 'cards');
  const gallery = path.join(ROOT, 'cards', 'e2e-gallery');
  await fsp.mkdir(gallery, { recursive: true });

  let passed = 0;
  const photos = [];

  // --- help ---
  {
    const help = run(['--help'], work);
    assertOk(help, 'help');
    assert.match(help.stdout, /(?:txt2card|text-to-card) title/);
    assert.match(help.stdout, /txt2card \(preferred\) or text-to-card/);
    assert.match(help.stdout, /cards\/card_YYYY_MM_DD_HH_mm_ss/);
    passed += 1;
    console.log('ok  help');
  }

  // --- both bin names map to same CLI when invoked via node path is fine;
  // package.json exposes txt2card + text-to-card after npm link ---
  {
    const pkg = require('./package.json');
    assert.equal(pkg.bin.txt2card, 'cli.js');
    assert.equal(pkg.bin['text-to-card'], 'cli.js');
    passed += 1;
    console.log('ok  bin aliases (txt2card + text-to-card)');
  }

  // --- invalid usage ---
  {
    const missing = run(['title'], work);
    assert.notEqual(missing.status, 0, 'title without text should fail');
    assert.match(missing.stderr, /needs at least 1 value/);
    passed += 1;
    console.log('ok  error: missing title value');
  }
  {
    const unknown = run(['unknown-template', 'x'], work);
    assert.notEqual(unknown.status, 0, 'unknown template should fail');
    passed += 1;
    console.log('ok  error: unknown template');
  }

  // --- template suite via real CLI (default naming into cards/) ---
  const cases = [
    {
      name: 'title-short',
      args: ['title', 'Ship faster']
    },
    {
      name: 'title-long',
      args: ['title', 'This is a test! and Tests are awesome!']
    },
    {
      name: 'title-special',
      args: ['title', 'Q3 Results: growth <risk> & "trust"']
    },
    {
      name: 'text-body',
      args: [
        'text',
        'Local CLI. No browser. No backend. Auto-fits text into a 1920x1080 card so long copy stays inside safe margins.'
      ]
    },
    {
      name: 'description',
      args: [
        'description',
        'text-to-card',
        'Turn titles, body text, and bullets into portable 16:9 PNG cards with bundled fonts.'
      ]
    },
    {
      name: 'bullets',
      args: [
        'bullets',
        'Default cards/ directory',
        'Timestamped Snake_Style names',
        'Bundled Inter fonts',
        'Works on macOS, Linux, Windows'
      ]
    },
    {
      name: 'title-bullets',
      args: [
        'title-bullets',
        'Release checklist',
        'Install from npm',
        'Run the e2e suite',
        'Ship the gallery cards'
      ]
    }
  ];

  for (const testCase of cases) {
    const template = testCase.args[0];
    const values = testCase.args.slice(1);
    const expectedSlug = toSnakeStyle(contentForSlug(template, values));

    const result = run(testCase.args, work);
    assertOk(result, testCase.name);

    const printed = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    assert.ok(printed, `${testCase.name}: CLI printed no path`);
    assert.ok(path.isAbsolute(printed), `${testCase.name}: path should be absolute`);
    assert.ok(fs.existsSync(printed), `${testCase.name}: missing file ${printed}`);
    assert.equal(
      path.dirname(await fsp.realpath(printed)),
      cardsDir,
      `${testCase.name}: should land in cards/`
    );

    const base = path.basename(printed);
    assert.match(base, NAME_RE, `${testCase.name}: bad filename ${base}`);
    assert.ok(
      base.endsWith(`_${expectedSlug}.png`),
      `${testCase.name}: expected slug ${expectedSlug} in ${base}`
    );

    await assertCardImage(printed, testCase.name);

    // Keep a copy in repo gallery for visual inspection
    const galleryName = `${testCase.name}.png`;
    const galleryPath = path.join(gallery, galleryName);
    await fsp.copyFile(printed, galleryPath);
    photos.push(galleryPath);

    passed += 1;
    console.log(`ok  ${testCase.name} → ${base}`);
  }

  // --- custom -o path creates parent dirs ---
  {
    const custom = path.join(work, 'nested', 'out', 'custom-card.png');
    const result = run(['title', 'Custom path', '-o', custom], work);
    assertOk(result, 'custom -o');
    assert.equal(result.stdout.trim(), path.resolve(custom));
    await assertCardImage(custom, 'custom -o');
    await fsp.copyFile(custom, path.join(gallery, 'custom-output.png'));
    photos.push(path.join(gallery, 'custom-output.png'));
    passed += 1;
    console.log('ok  custom -o nested path');
  }

  // --- --logo watermark via real CLI ---
  {
    const logoCard = path.join(work, 'branded.png');
    const result = run(
      ['title', 'Branded card', '--logo', path.join(ROOT, 'assets', 'icon-256.png'), '-o', logoCard],
      work
    );
    assertOk(result, '--logo');
    await assertCardImage(logoCard, '--logo');
    await fsp.copyFile(logoCard, path.join(gallery, 'logo-watermark.png'));
    passed += 1;
    console.log('ok  --logo watermark');
  }

  // --- --version flag ---
  {
    const pkg = require('./package.json');
    const result = run(['--version'], work);
    assertOk(result, '--version');
    assert.equal(result.stdout.trim(), pkg.version, '--version should print package version');
    passed += 1;
    console.log('ok  --version');
  }

  // --- --theme + --size via real CLI (dark 1080x1080) ---
  {
    const themed = path.join(work, 'themed.png');
    const result = run(['title', 'Dark square', '--theme', 'dark', '--size', 'square', '-o', themed], work);
    assertOk(result, '--theme/--size');
    const metadata = await sharp(themed).metadata();
    assert.equal(metadata.width, 1080, 'square width');
    assert.equal(metadata.height, 1080, 'square height');
    const stats = await sharp(themed).stats();
    assert.ok(stats.channels[0].min < 60, 'dark theme should have dark pixels');
    assert.ok(stats.channels[0].max > 200, 'dark theme should render light text');
    passed += 1;
    console.log('ok  --theme dark --size square');
  }

  // --- stdin via "-" ---
  {
    const piped = path.join(work, 'piped.png');
    const result = spawnSync(process.execPath, [CLI, 'title', '-', '-o', piped], {
      cwd: work,
      encoding: 'utf8',
      input: 'Piped in title',
      env: { ...process.env }
    });
    assertOk(result, 'stdin "-"');
    await assertCardImage(piped, 'stdin "-"');
    passed += 1;
    console.log('ok  stdin "-"');
  }

  // --- successive runs do not clobber (timestamp uniqueness at second resolution) ---
  {
    const first = run(['title', 'Same title twice'], work);
    // Ensure next second for distinct names when seconds differ; if same second, still ok if files both exist
    await new Promise(resolve => setTimeout(resolve, 1100));
    const second = run(['title', 'Same title twice'], work);
    assertOk(first, 'first same-title');
    assertOk(second, 'second same-title');
    const a = first.stdout.trim();
    const b = second.stdout.trim();
    assert.notEqual(a, b, 'two successive default renders should produce different paths');
    assert.ok(fs.existsSync(a) && fs.existsSync(b), 'both successive outputs should exist');
    passed += 1;
    console.log('ok  successive runs keep both files');
  }

  // --- gallery summary ---
  assert.equal(photos.length, cases.length + 1);
  for (const photo of photos) {
    await assertCardImage(photo, `gallery ${path.basename(photo)}`);
  }
  passed += 1;
  console.log(`ok  gallery ${photos.length} photos under cards/e2e-gallery/`);

  console.log(`\ne2e passed: ${passed} checks`);
  console.log(`work dir: ${work}`);
  console.log(`gallery:  ${gallery}`);
  for (const photo of photos) console.log(`  ${path.relative(ROOT, photo)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
