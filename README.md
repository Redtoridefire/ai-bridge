# AI Bridge — one workspace for all your AI accounts

A free, local desktop app that puts **Claude, ChatGPT, Gemini, and Copilot side by side** — including multiple accounts of the same platform (e.g. two Claude accounts). When you hit a usage limit on one, click **Share** and the whole conversation (your messages *and* the AI's answers) is dropped into the other platform's input box with a "take over, don't restart" instruction — press Enter and keep working.

- 100% local. No server, no stored passwords, no login automation — you sign in normally inside each pane, and each pane keeps its own isolated, persistent session.
- Handles very long conversations (up to ~120k characters; the oldest part is trimmed if bigger).
- Nothing is sent anywhere except by you pressing Enter in the target chat.

Also listed on [agentshive.net](https://www.agentshive.net/agents/e9c2a24c-629b-43b9-86a8-3d94e5a15fa1).

## Install

**Step 0 — Node.js** (skip if `node --version` prints v20+):
- **Windows:** install the LTS from [nodejs.org](https://nodejs.org) (keep "Add to PATH" checked), then reopen your terminal.
- **macOS:** LTS .pkg from nodejs.org, or `brew install node`.
- **Linux:** `sudo apt install nodejs npm`

**Step 1 — Get the app:**

```
git clone https://github.com/mananmaroo/ai-bridge.git
cd ai-bridge
npm install
npm start
```

(`npm install` downloads Electron once, ~2 minutes. Run `npm start` anytime to relaunch — logins are remembered.)

## How to use

1. Two panes open by default (Claude left, ChatGPT right). Log in inside each pane like a normal browser.
2. **+ Add account** to add panes — pick a platform and a label like "Claude — work account". Each pane is a separate cookie jar, so two Claude accounts can be signed in at once.
3. Click a tab to show it on the **left** · **Ctrl+click** for the **right**.
4. Open the conversation you want to hand off in the source pane, then hit **Share left ➜ right** (or right ➜ left). Review the pasted transcript in the target pane and press Enter.
5. For very long chats, scroll up in the source pane first so older messages load before sharing.

## Notes

- The share feature reads each platform's message elements; if a platform redesigns its chat page, the selector lists in `index.html` (`EXTRACT` / `insertScript`) are the one place to update.
- This intentionally does **not** automate logins or store credentials — that keeps it safe and within each platform's terms of service.

## License

MIT
