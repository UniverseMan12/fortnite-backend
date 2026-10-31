$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $projectRoot 'runtime'
$out = Join-Path $runtime 'extracted'
Expand-Archive -LiteralPath (Join-Path $runtime 'reboot.zip') -DestinationPath $out -Force
$files = @(Get-ChildItem -LiteralPath $out -Filter '*.dll' -Recurse)
if ($files.Count -ne 1) { throw 'Das Archiv muss genau eine Spielserver-DLL enthalten.' }
Copy-Item -LiteralPath $files[0].FullName -Destination (Join-Path $runtime 'reboot.dll')
