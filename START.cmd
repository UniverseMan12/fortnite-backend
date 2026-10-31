@echo off
setlocal
cd /d "%~dp0"
title Fortnite Backend - Lokal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 oder neuer fehlt. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)
node src/cli.js
if errorlevel 1 pause
