$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20 or newer is required. Install the LTS release from https://nodejs.org and reopen PowerShell."
}

$majorVersion = [int]((node --version).TrimStart("v").Split(".")[0])
if ($majorVersion -lt 20) {
  throw "Node.js 20 or newer is required. Current version: $(node --version)"
}

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path "node_modules/electron")) {
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
}

npm run check
if ($LASTEXITCODE -ne 0) { throw "Static checks failed." }

npm test
if ($LASTEXITCODE -ne 0) { throw "Tests failed." }

npm start
