# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Logo/icon assets under `assets/` (SVG + PNG sizes, wordmark, OG image)
- Marketing landing page under `site/`, deployed to Cloudflare Pages
- `title-bullets` template (alias `list`): clean title over bullet points

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
