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

## Skills, local AI, and backups

Imported skills are untrusted plain text, never scripts or privileged plugins. Public GitHub imports use fixed `api.github.com` routes with bounded responses and no application-provided credentials. All content is previewed before saving, copying, or preparing a composer. Supporting files and executable skill commands are not fetched or run. Applying a skill to a provider still exposes its instructions to that model, so inspect the content before sharing sensitive context.

Ollama IPC is restricted to model listing and generation on `127.0.0.1:11434`; the renderer cannot supply a network destination. The user chooses the model and exact material. Local inference is optional; it does not grant access to browser sessions. A local process controlling that port can see submitted material.

Organization backups contain workspace metadata and locally saved content, including skills and notes. They exclude provider partitions and credentials, are written atomically in the OS app profile, and retain ten snapshots. They are not encrypted. Backup and integration IPC requires the trusted app's main frame and returns structured errors. Provider pages cannot invoke these operations.

## Reporting

Report suspected vulnerabilities privately to the repository owner. Do not include provider cookies, session tokens, passwords, exported conversations, or other personal data in an issue.
