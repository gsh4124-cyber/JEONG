@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title JEONG
set "JEONG_ROOT=%CD%"
set "JEONG_RUNTIME_ID=jeong-runtime-v1"

if not exist ".env.local" (
  echo Google setup is not complete.
  echo .env.local is missing.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing JEONG for the first time...
  call npm.cmd install
  if errorlevel 1 (
    echo Installation failed.
    pause
    exit /b 1
  )
)

rem Do not trust an open port by itself. Verify that port 3000 is this JEONG runtime.
powershell -NoProfile -Command "try { $h=Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2; if($h.runtimeId -eq $env:JEONG_RUNTIME_ID){exit 0}else{exit 2} } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo JEONG server is already running. Opening the browser.
  start "" "http://localhost:3000/dashboard"
  exit /b 0
)

rem If a stale Node process from THIS folder owns port 3000, stop only that process.
rem Never terminate an unrelated application that happens to use port 3000.
powershell -NoProfile -Command "$listener=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue ^| Select-Object -First 1; if(-not $listener){exit 0}; $proc=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess) -ErrorAction SilentlyContinue; $root=$env:JEONG_ROOT; if($proc -and $proc.Name -match '^node(.exe)?$' -and $proc.CommandLine -like ('*' + $root + '*')){ Write-Host 'Stopping stale JEONG Node process' $proc.ProcessId; Stop-Process -Id $proc.ProcessId -Force; Start-Sleep -Milliseconds 700; exit 0 }; Write-Host ''; Write-Host 'Port 3000 is being used by another process.'; if($proc){Write-Host ('Process: ' + $proc.Name + ' (PID ' + $proc.ProcessId + ')')}; Write-Host 'JEONG will not terminate an unrelated process automatically.'; exit 3"
if errorlevel 3 (
  echo.
  echo Close the program using port 3000, then run JEONG-RUN.cmd again.
  pause
  exit /b 1
)

echo Cleaning stale Next.js development cache...
if exist ".next\" rmdir /s /q ".next"

start "JEONG Dev Server" cmd.exe /k "cd /d ""%~dp0"" && npm.cmd run dev"
echo Waiting for the current JEONG runtime...

powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 45;$i++){ try { $h=Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2; if($h.runtimeId -eq $env:JEONG_RUNTIME_ID){$ok=$true;break} } catch {}; Start-Sleep -Seconds 1 }; if($ok){exit 0}else{exit 1}"
if errorlevel 1 (
  echo.
  echo JEONG did not start correctly.
  echo Check the JEONG Dev Server window for the first error.
  pause
  exit /b 1
)

start "" "http://localhost:3000/dashboard"
exit /b 0
