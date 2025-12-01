# Changelog

All notable changes to HyperMemo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2025-12-01

### Added
- Admin CLI tools for subscription management and user statistics
- Documentation for Admin CLI (`docs/admin-cli.md`)
- Table format output for admin stats script

### Changed
- Updated CLI scripts to use `pnpm`
- Refactored `manage-subscription.ts` for better code quality
- Updated `SUBSCRIPTION_SYSTEM.md` to reference new Admin CLI docs

### Fixed
- Pre-commit linting issues in `dashboard.tsx`, `SubscriptionManager.tsx`, and `subscriptionService.ts`
- SVG accessibility issues (added titles)
- Type safety improvements in subscription service

## [0.1.0] - 2025-12-01

### Added
- Initial release
- AI-powered bookmark management
- Smart tag generation
- RAG-based chat with saved pages
- Multi-language support (English, Chinese Simplified, Chinese Traditional)
- Dashboard with overview and chat tabs
- Bookmark organization with tag filtering
- Auto-summarization of saved pages
- Chrome extension popup for quick bookmarking

### Technical
- React + TypeScript frontend
- Supabase backend with Edge Functions
- Firebase integration for AI features
- Chrome Extension Manifest V3
- Optimistic updates for better UX
- Error boundaries for resilience

[Unreleased]: https://github.com/yourusername/hypermemo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/hypermemo/releases/tag/v0.1.0
