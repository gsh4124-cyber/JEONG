@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title JEONG Setup

echo.
echo ==========================================
echo        JEONG SETUP AND RUN v3.2
echo ==========================================
echo.

if exist ".env.local" goto ENV_READY

echo Searching for saved Google settings in older JEONG folders...
for /d %%D in ("%~dp0..\JEONG*") do (
  if /I not "%%~fD"=="%~dp0" (
    if exist "%%~fD\.env.local" (
      copy /Y "%%~fD\.env.local" ".env.local" >nul
      echo Previous Google settings were copied automatically.
      goto ENV_READY
    )
  )
)

echo Saved Google settings were not found.
echo You only need to enter these values once.
echo.
set /p GOOGLE_ID=Paste Google OAuth Client ID: 
set /p GOOGLE_SECRET=Paste Google OAuth Client Secret: 

if "%GOOGLE_ID%"=="" (
  echo Client ID is empty.
  pause
  exit /b 1
)
if "%GOOGLE_SECRET%"=="" (
  echo Client Secret is empty.
  pause
  exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Opening download page.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set AUTH_SECRET=%%s
(
  echo AUTH_SECRET=%AUTH_SECRET%
  echo AUTH_GOOGLE_ID=%GOOGLE_ID%
  echo AUTH_GOOGLE_SECRET=%GOOGLE_SECRET%
  echo AUTH_URL=http://localhost:3000
) > .env.local

:ENV_READY
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Opening download page.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing JEONG...
  call npm.cmd install
  if errorlevel 1 (
    echo Installation failed.
    pause
    exit /b 1
  )
)

echo Starting JEONG...
start "JEONG Server" cmd.exe /c "cd /d ""%~dp0"" && npm.cmd run dev"
timeout /t 7 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo Google settings are saved. You will not enter them again.
pause
