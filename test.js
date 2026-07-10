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
  formatTimestamp
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
  const auto = parseArgs(['text', 'Auto name please']);
  assert.match(auto.output, /^cards[/\\]card_\d{4}(?:_\d{2}){5}_Auto_Name_Please\.png$/);

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

  console.log(`ok: naming + ${cases.length} templates`);
}

test().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
