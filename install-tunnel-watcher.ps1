# -----------------------------------------------------------------------------
# Videa Master Pro CRM — Cloudflare Tunnel Watcher installer (Windows)
#
# What this does, once:
#   1. Creates C:\VideaTunnel with a wrapper batch + config.
#   2. Registers a Windows scheduled task named "VideaCloudflaredWatcher"
#      that runs at system startup under SYSTEM.
#   3. The wrapper starts `cloudflared tunnel --url http://127.0.0.1:55667`,
#      reads the new https://...trycloudflare.com URL from the log, and
#      POSTs it to the CRM's /api/tunnel-updater endpoint.
#   4. If the tunnel dies, it restarts automatically.
#
# After running this once, you never think about the tunnel again.
# -----------------------------------------------------------------------------

#requires -RunAsAdministrator

param(
  [Parameter(Mandatory=$true)]  [string] $CrmBaseUrl,        # e.g. https://xxx.manus.space
  [Parameter(Mandatory=$true)]  [string] $TunnelUpdaterSecret, # value of TUNNEL_UPDATER_SECRET
  [string] $ManagerLocalUrl = "http://127.0.0.1:55667"       # Manager.io local URL
)

$ErrorActionPreference = "Stop"

$root = "C:\VideaTunnel"
if (-not (Test-Path $root)) { New-Item -ItemType Directory -Path $root | Out-Null }

# 1. Write config used by the wrapper.
@"
CRM_BASE_URL=$CrmBaseUrl
TUNNEL_UPDATER_SECRET=$TunnelUpdaterSecret
MANAGER_LOCAL_URL=$ManagerLocalUrl
"@ | Out-File -FilePath (Join-Path $root "config.env") -Encoding ascii -Force

# 2. Write the watcher PowerShell script.
$watcher = @'
param()

$cfg = @{}
Get-Content "C:\VideaTunnel\config.env" | ForEach-Object {
  if ($_ -match "^\s*([^=]+?)\s*=\s*(.+)$") { $cfg[$Matches[1]] = $Matches[2] }
}

$logFile = "C:\VideaTunnel\watcher.log"
function Log($msg) {
  "$([DateTime]::UtcNow.ToString("o"))  $msg" | Out-File -Append -FilePath $logFile
}

while ($true) {
  try {
    Log "Starting cloudflared tunnel"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cloudflared"
    $psi.Arguments = "tunnel --url $($cfg.MANAGER_LOCAL_URL)"
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardOutput = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $proc.Start() | Out-Null

    $tunnelUrl = $null
    while (-not $proc.HasExited) {
      $line = $proc.StandardError.ReadLine()
      if ($line) {
        Log "cf: $line"
        if (-not $tunnelUrl -and $line -match "(https://[a-z0-9\-]+\.trycloudflare\.com)") {
          $tunnelUrl = $Matches[1]
          Log "Detected tunnel URL: $tunnelUrl"

          try {
            $body = @{ url = ("$tunnelUrl/api2") } | ConvertTo-Json
            $headers = @{ "X-Tunnel-Secret" = $cfg.TUNNEL_UPDATER_SECRET }
            Invoke-RestMethod -Uri "$($cfg.CRM_BASE_URL)/api/tunnel-updater" `
                              -Method POST -Headers $headers `
                              -ContentType "application/json" -Body $body -TimeoutSec 20 | Out-Null
            Log "Posted new URL to CRM."
          } catch {
            Log "Failed to post URL: $_"
          }
        }
      }
    }
    Log "cloudflared exited with code $($proc.ExitCode). Restarting in 10s."
    Start-Sleep -Seconds 10
  } catch {
    Log "Watcher error: $_. Retrying in 30s."
    Start-Sleep -Seconds 30
  }
}
'@
$watcher | Out-File -FilePath (Join-Path $root "watcher.ps1") -Encoding ascii -Force

# 3. Register (or replace) the scheduled task.
$taskName = "VideaCloudflaredWatcher"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$root\watcher.ps1`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 9999)

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Description "Videa Master Pro — Cloudflared watcher" | Out-Null

Start-ScheduledTask -TaskName $taskName

Write-Host ""
Write-Host "Tunnel watcher installed and started." -ForegroundColor Green
Write-Host "Log file: C:\VideaTunnel\watcher.log"
Write-Host "It will auto-start with Windows from now on."
