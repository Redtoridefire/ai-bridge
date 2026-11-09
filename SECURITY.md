# Security model and verification

AI Command Center hosts untrusted provider pages alongside a trusted local UI. It is a desktop browser application: the privileged Electron process must be trusted with authenticated sessions. Panels do not turn provider websites into offline services or change their privacy policies.

## Remote content and credentials

Provider guests have Node integration disabled, context isolation and sandboxing enabled, and no application preload. Each persistent account partition is bound to one provider. Exact provider HTTPS origins and explicitly named authentication origins are separate; arbitrary subdomains, credentials in URLs, nonstandard ports, and cross-provider navigation are rejected. Main-frame navigations and redirects are checked. Native windows/popups are denied, downloads are delegated only after a confirmation, and the explicit external-browser button requires confirmation.

Camera/microphone permission checks deny access until an explicit, origin-specific native approval. Requests from subframes or unknown origins are rejected. Media grants are scoped to the account partition and current app session. All other permissions are denied. Settings supports grant revocation and account storage/cache clearing. Provider sign-in compatibility, OS media permissions, and site changes require real-platform testing.

The application does not deliberately collect passwords, cookies, or tokens into its organization database or exports. Browser authentication data remains in Electron's partition storage. However, a compromised main process or dependency can access browser sessions: isolation is not protection against a malicious application update. No claim is made that a separate password field is the only way credentials can be compromised.

## Trusted UI, IPC, and imported data

The local UI runs at `aicc://app/index.html`, served through an explicit static asset allowlist. No arbitrary filesystem paths or main-process source are exposed by that protocol. CSP blocks remote scripts, connections, inline scripts, object content, and untrusted base URLs. Every IPC handler checks the exact app window and main frame before reading input, opening dialogs, making network requests, or accessing saved data.

Organization imports validate schema version, workspace/panel uniqueness, provider IDs, identifier characters, collection types, settings, and unsafe prototype properties. A saved/imported state cannot rebind a known account to another provider. Imported skills remain untrusted, escaped text: referenced files and executable commands are not fetched or executed. Their instructions can still cause harmful model behavior, so users must review them before applying them.

Public GitHub imports use fixed `api.github.com` API routes without app-provided credentials, bounded responses, TLS verification, and no redirects. Ollama is limited to model discovery and generation on `127.0.0.1:11434`; the renderer cannot choose another destination. A local process controlling that port can read selected material.

## Sharing, clipboard, and provider drafts

**Composer preparation is disclosure, even without final submission.** Provider scripts can read or autosave input as soon as it is inserted. All insertion goes through the main process, verifies the current provider origin, presents a native disclosure confirmation naming the destination/character count, and executes a second origin guard inside the provider page. Authentication pages cannot be automated.

Compare no longer implicitly copies prompts. Handoff defaults to explicit copy only; insertion is unchecked and separately confirmed. Skills/context offer separate Copy and Prepare actions. Clipboard copies can persist in OS history or cloud synchronization. No automatic clipboard clearing is attempted because it could overwrite unrelated user content. Providers may retain disclosed drafts according to their policies.

## Local storage, migration, and retention

Organization state and automatic snapshots use Electron `safeStorage` with OS-protected encryption (DPAPI on Windows). The app refuses insecure `basic_text` fallback storage. If protection or decryption is unavailable, or migration fails, persistence is visibly locked and existing files are not overwritten. New work then remains in memory until explicitly exported.

Legacy local storage and plaintext snapshots are migrated only after schema validation and verified encrypt/decrypt round-trips. Database removal and file replacement are logical deletion; historical disk blocks, OS backups, and exported files may still contain plaintext. Use full-disk encryption and appropriate device/backup policies. The app uses Electron's OS-cookie-encryption fuse in development and packaged binaries; without OS protection, new provider sessions are ephemeral. Existing cookies encrypt when rewritten by the engine; enabling this fuse is a one-way transition, and reverting to an unfused build risks cookie-store compatibility. The update does not forcibly rewrite existing cookies. Local malware under the same user account remains a threat.

Ten encrypted organization snapshots are retained. Restore makes a safety snapshot. Settings can erase retained backups and clear saved organization content separately from account sessions. Deletion is not forensic secure erasure. Explicit JSON/Markdown/HTML exports are plaintext and require separate protection, especially during transfer between machines/OS accounts. Text that users paste into notes can contain credentials and will be backed up/exported as text.

## Supply chain and distribution

The lockfile is committed and CI uses `npm ci`. Full dependency auditing includes build tools, not merely production-classified dependencies. Targeted minimatch overrides address GHSA-g3hv-75wg-m249; Linux/Windows packaging must be rechecked when changing them. Weekly Dependabot updates, CodeQL, Gitleaks, tests, and full auditing are configured with SHA-pinned actions. Configuring CI is not evidence it ran successfully; inspect GitHub results.

Packaged fuses disable RunAsNode, NODE_OPTIONS loading, and Node CLI inspection; enable cookie encryption; and restrict loading to app.asar with supported embedded integrity checks enabled. The file-protocol privilege fuse is deliberately retained for legacy file-origin localStorage migration: disabling it makes Chromium reject access to the legacy database. Only the isolated static migration page uses file://, without preload, Node integration, executable page scripts, or navigation. The normal UI uses the constrained custom origin and cannot navigate to file pages. The postinstall/prestart helper verifies development fuses, while keeping directory loading available for source development. Static CI explicitly skips binary downloads. These controls do not replace distributor code signing. Tagged Windows releases require a distributor-provided certificate via `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD`. Manual test builds may be unsigned. Artifacts include SHA-256 checksums and a CycloneDX dependency inventory; these do not alone establish trusted authorship or signed build provenance.

Enable GitHub secret scanning/push protection, protected branches, and review requirements in repository settings where available. Gitleaks licensing requirements may differ for organization-owned repositories. No certificates, signing passwords, provider tokens, or private keys should be committed.

## Verification and limits

The regression suite exercises permission denial/grants, per-account media scope, foreign-frame IPC denial, canceled insertion, redirect boundaries, strict imports, origin-guarded scripts, encryption plumbing, locked storage, and backup migration. A real Electron temporary-profile test verifies migration from the legacy file origin using a test crypto adapter. This is not a test of Windows DPAPI itself. The Windows build workflow separately runs `npm run test:windows-crypto` against actual Windows safeStorage; its outcome must be checked in GitHub Actions. Linux cloud GUI smoke testing uses a container-specific `--no-sandbox` flag; that flag is not part of Windows startup or packaged shortcuts.

This work uses Electron's security checklist, relevant OWASP ASVS/GenAI controls, and NIST SSDF practices as guidance. It is not compliance certification, independent penetration testing, or proof of provider sign-in compatibility.

## Reporting

Report vulnerabilities privately to the repository owner. Never include cookies, tokens, passwords, signing credentials, or private conversations in issues or diagnostic logs.
