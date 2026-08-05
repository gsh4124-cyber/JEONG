@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title JEONG Check

echo.
echo ==========================================
echo        JEONG v6.0.1 CHECK
echo ==========================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing required packages...
  call npm.cmd install
  if errorlevel 1 goto FAIL
)

echo [1/2] Checking TypeScript...
call npm.cmd run typecheck
if errorlevel 1 goto FAIL

echo.
echo [2/2] Creating production build...
call npm.cmd run build
if errorlevel 1 goto FAIL

echo.
echo ==========================================
echo JEONG check completed successfully.
echo You may now run JEONG-RUN.cmd.
echo ==========================================
pause
exit /b 0

:FAIL
echo.
echo ==========================================
echo The check found an error.
echo Take a screenshot of the last red error lines.
echo ==========================================
pause
exit /b 1
