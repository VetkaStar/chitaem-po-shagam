param([ValidateSet('dev','check','build','publish')][string]$Action='dev')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$node=Join-Path $projectRoot '.local/node/bin/node.exe'
if (-not (Test-Path -LiteralPath $node)) { $node='node' }
function Run-Node([string[]]$Arguments) {
 & $node @Arguments
 if ($LASTEXITCODE) { throw "Command failed: $Arguments" }
}
switch ($Action) {
 'dev' { Run-Node @('node_modules/vite/bin/vite.js','--config','vite.pages.config.ts','--host','127.0.0.1','--port','3024') }
 'build' { Run-Node @('node_modules/vite/bin/vite.js','build','--config','vite.pages.config.ts') }
 'check' {
  Run-Node @('node_modules/typescript/bin/tsc','--noEmit')
  foreach ($test in @('regression','practice-flow','text-practice-flow','illustrations','auto-advance')) { Run-Node @("tests/$test.mjs") }
  Run-Node @('node_modules/vite/bin/vite.js','build','--config','vite.pages.config.ts')
 }
 'publish' {
  $key=(Join-Path $projectRoot '.local/publish-auth/topic-key').Replace('\','/')
  $hosts=(Join-Path $projectRoot '.local/publish-auth/known_hosts').Replace('\','/')
  $env:GIT_SSH_COMMAND="ssh -i `"$key`" -o IdentitiesOnly=yes -o UserKnownHostsFile=`"$hosts`" -o StrictHostKeyChecking=yes -o BatchMode=yes"
  git push origin new-design
  if ($LASTEXITCODE) { throw 'Publication failed' }
 }
}


