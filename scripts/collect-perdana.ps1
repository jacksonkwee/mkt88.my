# Reads the official Perdana page and pushes it to the repo (free, no server).
# The site host cannot reach perdana4d.com; this PC can, so this collects the
# draws and commits them. Render then deploys them.
$ErrorActionPreference = "Continue"
$repo = "C:\dev\GONGXIFACAI"
$node = "C:\Users\dabom\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
Set-Location $repo
& $node "scripts\fetch-perdana-official.mjs" | Out-Null
if (git status --porcelain -- src/lib/perdana-official.json src/lib/perdana-past.json) {
  git add -- src/lib/perdana-official.json src/lib/perdana-past.json
  git commit -q -m "Perdana 4D results update"
  git push -q origin main
}
