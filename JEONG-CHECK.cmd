@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title JEONG Check

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 goto :failed
)

set "JEONG_DIST_DIR=.next-check"
if exist ".next-check\" rmdir /s /q ".next-check"

echo [1/2] TypeScript check...
call npm.cmd run typecheck
if errorlevel 1 goto :failed

echo.
echo [2/2] Production build check in .next-check...
call npm.cmd run build
if errorlevel 1 goto :failed

echo.
echo JEONG code check completed successfully.
echo Development cache .next was not touched.
pause
exit /b 0

:failed
echo.
echo JEONG check failed. Read the first error above.
pause
exit /b 1
