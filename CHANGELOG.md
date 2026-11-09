# Changelog

## Unreleased

## 1.2.1 — security hardening

- Replaced automatic media permissions with explicit per-account origin grants and revocation controls.
- Enforced provider-specific HTTPS origins, authentication exceptions, redirect checks, and origin-guarded extraction/insertion.
- Added main-process disclosure confirmation before composer preparation; disabled implicit Compare clipboard copies and default Handoff insertion.
- Validated every privileged IPC caller and all imported workspace/collection identifiers and types.
- Moved the trusted UI to a constrained custom protocol and removed webview popup permission.
- Added OS-protected encrypted organization storage/backups with verified legacy migration and fail-closed persistence.
- Added account clearing, backup erasure, packaged Electron fuses, pinned security CI, release checksums/SBOM, and signing prerequisites for tagged releases.
- Enabled the OS-cookie-encryption fuse for development and packaged binaries (one-way compatibility change); use ephemeral provider sessions when OS protection is unavailable.
- Remediated the matcher denial-of-service advisory with targeted dependency overrides; full npm audit reports zero findings.

## 1.2.0

- Added searchable/favoritable skill and context libraries with reviewed public GitHub skill imports and attribution.
- Added template fields and explicit copy/composer preparation for skills, context packets, and prompt snippets.
- Added conversation bookmarks, a provider-attributed comparison notebook, and workspace presets.
- Added persistent column sizing, panel ordering/focus controls, and mounted views across workspace switches.
- Added rotating local organization backups and restore with a safety snapshot.
- Added optional local Ollama model discovery and content processing.
- Added productivity, import, backup, and live Electron workflow tests.

- Fixed Independent, Compare, and Handoff toolbars incorrectly appearing together.
- Fixed clipped controls at smaller window widths and hidden utility panel overflow.
- Preserved comparison target selections across mode and utility changes.
- Replaced unsupported workspace name prompts with accessible in-app dialogs.
- Kept provider panels intact when saving settings.
- Added live Electron workflow regressions for visibility, cancellation, workspace naming, and layout.

## 1.1.0 — AI Command Center

- Added a registry for ChatGPT, Claude, Grok, Gemini, DeepSeek, Perplexity, Microsoft Copilot, and Google AI Studio.
- Added saved multi-panel workspaces and isolated multi-account sessions.
- Added Independent, Compare, and explicit-preview Handoff modes with manual fallbacks.
- Added themes, settings, onboarding, keyboard shortcuts, notes, snippets, projects, labels, favorites, local search, and import/export.
- Hardened Electron webviews, navigation, permissions, IPC, and local file operations.
- Added core, provider-registry, and security tests.
- Added Windows NSIS/portable packaging and release workflow.

## 1.0.0 — AI Bridge

- Original local multi-platform workspace and conversation handoff by Manan Maroo.
