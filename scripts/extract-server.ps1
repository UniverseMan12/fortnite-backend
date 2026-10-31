$ErrorActionPreference = 'Stop'
Import-Module "$PSHOME\Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1" -Force
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $projectRoot 'runtime'
$out = Join-Path $runtime ('extracted-' + [Guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath (Join-Path $runtime 'reboot.zip') -DestinationPath $out -Force
$files = @(Get-ChildItem -LiteralPath $out -Filter '*.dll' -Recurse)
if ($files.Count -ne 1) { throw 'The archive must contain exactly one game server DLL.' }
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'dependencies.lock.json') -Raw | ConvertFrom-Json
$digest = (Get-FileHash -LiteralPath $files[0].FullName -Algorithm SHA256).Hash.ToLower()
if ($digest -ne $manifest.dlls.'reboot.dll') { throw 'Downloaded server checksum mismatch. Existing server was not changed.' }
$license = Join-Path $out 'REBOOT-LICENSE.txt'
if (-not (Test-Path -LiteralPath $license)) { throw 'Server license is missing from the archive.' }
$target = Join-Path $runtime 'reboot.dll'
if (Test-Path -LiteralPath $target) { Copy-Item -LiteralPath $target -Destination (Join-Path $runtime 'reboot.previous.dll') }
Copy-Item -LiteralPath $files[0].FullName -Destination (Join-Path $runtime 'reboot.dll')
Copy-Item -LiteralPath $license -Destination (Join-Path $runtime 'REBOOT-LICENSE.txt')
