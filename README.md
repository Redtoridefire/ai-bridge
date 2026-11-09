# AI Command Center

AI Command Center is a free, local-first Electron workspace for using existing AI website accounts side by side. It extends [AI Bridge](https://github.com/mananmaroo/ai-bridge) by Manan Maroo and preserves its MIT license and core idea: authenticate on each provider's real website, keep account sessions isolated, and move context only when the user asks.

No Command Center account, API key, subscription, analytics service, or external application server is required.

## What works

- Eight registered providers: ChatGPT, Claude, Grok, Gemini, DeepSeek, Perplexity, Microsoft Copilot, and Google AI Studio.
- Independent persistent browser sessions for multiple accounts of the same provider.
- One to four simultaneous panels in each saved workspace.
- Independent, Compare, and Handoff modes. Compare prepares a prompt but never silently submits it. Handoff exposes an editable preview and requires confirmation.
- Best-effort composer insertion and conversation extraction for providers with maintained selectors, with clipboard/manual fallback for every workflow.
- Local notes, prompt snippets, projects, labels, favorites, and an explicitly populated searchable library.
- JSON, Markdown, and HTML export, plus provenance-aware import of AI Command Center, official ChatGPT, and official Claude JSON exports.
- Dark, light, and system themes; keyboard shortcuts; persistent layouts.
- A narrow preload API, isolated provider partitions, restricted navigation, validated IPC, and denied privileged access from provider pages.

Provider websites change independently. A successful sign-in, content extraction, or composer insertion can vary by provider, account, region, and current site design. The app does not use private APIs, bypass access controls, automate CAPTCHAs, or submit messages without a visible user action.

## Windows development

Prerequisites:

- Windows 10 or 11
- Node.js 20 LTS or newer
- PowerShell 5.1 or newer

From PowerShell:

```powershell
git clone https://github.com/Redtoridefire/ai-bridge.git
Set-Location ai-bridge
npm install
npm test
npm start
```

You can also run `./scripts/start.ps1`, which checks Node.js, installs missing dependencies, runs the checks, and starts the app.

The first time a provider panel opens, sign in directly within that panel. Each panel uses a persistent Electron partition keyed by its local panel ID. Removing a panel removes it from the layout; it does not export its cookies or credentials.

## Build a Windows installer and portable app

On Windows PowerShell:

```powershell
npm install
npm test
npm run dist:win
```

Artifacts are written to `dist/`:

- `AI-Command-Center-<version>-<arch>.exe` NSIS installer
- A portable Windows executable

The installer is unsigned. Windows SmartScreen may warn about unsigned community builds. Production distributors should configure their own code-signing certificate through electron-builder's supported environment settings; never commit signing credentials.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+1` | Independent mode |
| `Ctrl+2` | Compare mode |
| `Ctrl+3` | Handoff mode |
| `Ctrl+Shift+P` | Add provider account |

## Local data model

Workspace layouts, settings, notes, snippets, labels, projects, handoff metadata, and explicitly saved library content are stored in the app's Chromium local storage under Electron's OS-managed user data directory. Provider cookies and web storage remain in separate persistent Electron session partitions. JSON exports include organization data and saved library content but never provider cookies or login tokens.

Local search only covers content the user explicitly saves or imports. It does not claim to index complete provider histories and does not scrape entire accounts.

## Architecture

- `main.js`: window lifecycle, webview policy, permissions, navigation, validated file dialogs, session clearing.
- `preload.js`: frozen, narrow IPC bridge exposed to the trusted local renderer.
- `src/providers.js`: provider metadata, capabilities, URLs, and isolated selector adapters.
- `src/core.js`: pure state normalization, workspaces, search, import/export.
- `src/security.js`: origin, partition, external URL, and export validation.
- `renderer.js`: local UI, session views, explicit compare/handoff workflows, and productivity features.
- `tests/`: Node test suite for core behavior, registry coverage, and security boundaries.

## Current limitations

- Provider website embedding and automation are inherently subject to provider policy and technical controls. Some sites may block Electron sign-in or embedded pages. Use the manual clipboard workflow or the provider in your regular browser when that occurs.
- Extraction adapters are best effort for ChatGPT, Claude, Gemini, and Copilot. Grok, DeepSeek, Perplexity, and Google AI Studio default to manual extraction until tested selectors can be maintained responsibly.
- Compare mode prepares prompts but leaves final submission to the user in every panel.
- Conversation search covers saved/imported content only.
- Detachable provider windows and optional Ollama summaries remain roadmap items.
- Linux cloud containers that disable user namespaces may require Electron's `--no-sandbox` flag for development. Packaged Windows builds use Chromium's normal Windows sandbox; do not add `--no-sandbox` to Windows shortcuts.

## Development and security

```powershell
npm run check
npm test
npm run pack
```

See [SECURITY.md](SECURITY.md) for the threat model and reporting guidance. Keep site-specific selectors in `src/providers.js`; do not add privileged browser-page preload scripts, remote Node integration, credential logging, or unsupported provider APIs.

## License and attribution

MIT. Copyright (c) 2026 Manan Maroo. AI Command Center is based on the original AI Bridge project and retains the upstream license in [LICENSE](LICENSE).
