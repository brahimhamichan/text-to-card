# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Logo/icon assets under `assets/` (SVG + PNG sizes, wordmark, OG image)
- Marketing landing page under `site/`, deployed to Cloudflare Pages
- `title-bullets` template (alias `list`): clean title over bullet points
- `--theme` (light, dark, midnight, paper) plus `--bg` / `--fg` for custom colors
- `--size` presets (16:9, wide, square, og, story, portrait) and custom `WxH`;
  layout scales proportionally to the canvas
- `-v` / `--version` flag
- Read a value from stdin by passing `-` in its place
- Warning when text may be clipped (too long for the chosen size)

### Fixed
- Auto-named cards no longer clobber each other within the same second
  (a `_2`, `_3`, … suffix is added on collision)
- `title-description` and `list` aliases are now documented in `--help` and README

## [0.1.0] - 2026-07-10

### Added

- CLI with preferred command `txt2card` and alias `text-to-card`
- Templates: `title`, `text`, `description`, `bullets`
- Auto-fitted 1920×1080 PNG output via Sharp
- Bundled Inter fonts for portable, consistent rendering
- Default output path `cards/card_YYYY_MM_DD_HH_mm_ss_Slug.png`
- Custom output via `-o path.png` (creates parent directories)
- Unit and e2e test scripts (`npm test`, `npm run test:e2e`, `npm run test:all`)
- Agent skill at `skills/text-to-card`
