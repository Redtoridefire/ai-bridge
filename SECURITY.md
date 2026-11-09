# Security model

AI Command Center displays remote, potentially hostile provider content next to trusted local UI. Its main boundary is that provider pages never receive Node.js, filesystem, shell, or unrestricted IPC access.

## Threat model

### Malicious or compromised provider content

Provider pages run with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and `webSecurity: true`. The main process validates the initial provider URL and partition before attaching a webview. Navigation is limited to registered HTTPS provider hosts; other HTTPS links open in the system browser, and non-HTTPS links are rejected. Permission requests default to denied except a small origin-checked set needed for chat media, fullscreen, sanitized clipboard writes, and notifications.

Website content can still display deceptive UI, track activity according to the provider's own policies, or exploit an Electron/Chromium vulnerability. Keep Electron updated and do not install untrusted extensions.

### Cross-provider leakage

Each panel uses a unique persistent session partition. The app does not read or export cookies, passwords, or tokens. Compare and handoff content moves only after explicit user action. Handoff always exposes the exact text in an editable preview and records metadata rather than credentials. Clipboard fallback may leave content in the OS clipboard; users should clear sensitive clipboard content when appropriate.

### Local data exposure

Notes, saved content, exports, and workspace state are local files protected by the current OS account, not end-to-end encrypted. Anyone with access to the OS profile may be able to read them. JSON exports can contain sensitive conversation text and should be handled accordingly. The app limits import/export size and validates paths through Electron dialogs.

### Compromised dependencies

Electron and electron-builder are development dependencies installed from npm. Review dependency changes, use a lockfile in release branches, run `npm audit`, and build releases in a controlled CI environment. Release signing credentials must remain in the CI secret store.

## IPC and navigation rules

- The preload bridge exposes only app metadata, HTTPS external links, partition-scoped clearing, and bounded file import/export.
- IPC payloads are validated in the main process.
- Export filenames are sanitized and file paths are chosen through native dialogs.
- Provider content cannot select arbitrary Electron partitions.
- Popups are denied; safe HTTPS destinations are delegated to the system browser.
- No remote debugging interface is enabled in packaged builds.

## Reporting

Report suspected vulnerabilities privately to the repository owner. Do not include provider cookies, session tokens, passwords, exported conversations, or other personal data in an issue.
