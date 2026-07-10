const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { render } = require('./cli');

async function test() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'text-to-card-'));
  const cases = [
    ['title', ['This is a test! <Local> & "safe"']],
    ['text', [('Long text must remain inside the image. ').repeat(40)]],
    ['description', ['Simple title', ('Description content stays readable and contained. ').repeat(20)]],
    ['bullets', Array.from({ length: 14 }, (_, index) => `Bullet point ${index + 1} with useful detail`)]
  ];

  for (const [template, values] of cases) {
    const output = path.join(directory, `${template}.png`);
    await render(template, values, output);
    const metadata = await sharp(output).metadata();
    const stats = await sharp(output).stats();
    assert.deepEqual([metadata.width, metadata.height, metadata.format], [1920, 1080, 'png']);
    assert.ok(stats.channels[0].min < 100, `${template} output contains no visible text`);
  }

  console.log(`ok: ${cases.length} templates`);
}

test().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
