const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const {
  render,
  parseArgs,
  defaultOutputPath,
  toSnakeStyle,
  formatTimestamp,
  normalizeColor,
  parseSize,
  THEMES
} = require('./cli');

async function test() {
  assert.equal(toSnakeStyle('This is a test! and Tests are awesome!'), 'This_Is_A_Test_And_Tests_Are_Awesome');
  assert.equal(toSnakeStyle('simple'), 'Simple');
  assert.equal(toSnakeStyle('@@@'), 'Card');
  assert.ok(toSnakeStyle('a'.repeat(80)).length <= 48);

  const fixed = new Date(2026, 6, 10, 14, 30, 45);
  assert.equal(formatTimestamp(fixed), '2026_07_10_14_30_45');
  assert.equal(
    defaultOutputPath('title', ['Hello world'], fixed),
    path.join('cards', 'card_2026_07_10_14_30_45_Hello_World.png')
  );
  assert.equal(
    defaultOutputPath('description', ['Main title', 'Body copy'], fixed),
    path.join('cards', 'card_2026_07_10_14_30_45_Main_Title.png')
  );
  assert.equal(
    defaultOutputPath('title-bullets', ['Release notes', 'Faster install', 'Cleaner layout'], fixed),
    path.join('cards', 'card_2026_07_10_14_30_45_Release_Notes.png')
  );

  const parsed = parseArgs(['title', 'Ship it', '-o', 'custom.png']);
  assert.equal(parsed.output, 'custom.png');
  assert.equal(parsed.autoOutput, false);
  assert.deepEqual(parsed.size, [1920, 1080]);
  assert.equal(parsed.background, THEMES.light.bg);
  const auto = parseArgs(['text', 'Auto name please']);
  assert.match(auto.output, /^cards[/\\]card_\d{4}(?:_\d{2}){5}_Auto_Name_Please\.png$/);
  assert.equal(auto.autoOutput, true);

  // Options: version, theme, colors, sizes
  assert.equal(parseArgs(['--version']).version, true);
  const themed = parseArgs(['title', 'x', '--theme', 'dark', '--size', 'square']);
  assert.equal(themed.background, THEMES.dark.bg);
  assert.equal(themed.foreground, THEMES.dark.fg);
  assert.deepEqual(themed.size, [1080, 1080]);
  const overridden = parseArgs(['title', 'x', '--theme', 'dark', '--bg', '#010203', '--fg', 'white']);
  assert.equal(overridden.background, '#010203');
  assert.equal(overridden.foreground, 'white');
  assert.deepEqual(parseArgs(['title', 'x', '--size', '800x600']).size, [800, 600]);
  assert.throws(() => parseArgs(['title', 'x', '--theme', 'neon']), /Unknown theme/);
  assert.throws(() => parseArgs(['title', 'x', '--bg', 'zzz#']), /Invalid background/);
  assert.throws(() => parseArgs(['title', 'x', '--size', 'huge']), /Invalid size/);

  assert.equal(normalizeColor('#0f172a', 'bg'), '#0f172a');
  assert.equal(normalizeColor('White', 'bg'), 'white');
  assert.throws(() => normalizeColor('12ff', 'bg'), /Invalid bg/);
  assert.deepEqual(parseSize('og'), [1200, 630]);
  assert.deepEqual(parseSize('640x480'), [640, 480]);

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'text-to-card-'));
  const cases = [
    ['title', ['This is a test! <Local> & "safe"']],
    ['text', [('Long text must remain inside the image. ').repeat(40)]],
    ['description', ['Simple title', ('Description content stays readable and contained. ').repeat(20)]],
    ['bullets', Array.from({ length: 14 }, (_, index) => `Bullet point ${index + 1} with useful detail`)],
    ['title-bullets', ['Ship checklist', 'Install from npm', 'Render a title card', 'Commit and push']]
  ];

  for (const [template, values] of cases) {
    const output = path.join(directory, `${template}.png`);
    await render(template, values, output);
    const metadata = await sharp(output).metadata();
    const stats = await sharp(output).stats();
    assert.deepEqual([metadata.width, metadata.height, metadata.format], [1920, 1080, 'png']);
    assert.ok(stats.channels[0].min < 100, `${template} output contains no visible text`);
  }

  // Custom size + dark theme: dimensions honored, background is dark, text is light.
  const darkOut = path.join(directory, 'dark-square.png');
  await render('title', ['Dark mode'], darkOut, {
    size: [1080, 1080],
    background: THEMES.dark.bg,
    foreground: THEMES.dark.fg
  });
  const darkMeta = await sharp(darkOut).metadata();
  const darkStats = await sharp(darkOut).stats();
  assert.deepEqual([darkMeta.width, darkMeta.height], [1080, 1080]);
  assert.ok(darkStats.channels[0].min < 60, 'dark theme background should be dark');
  assert.ok(darkStats.channels[0].max > 200, 'dark theme should render light text');

  console.log(`ok: naming + ${cases.length} templates + options`);
}

test().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
