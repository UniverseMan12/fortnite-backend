@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Fortnite Launcher
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is missing. Install it from https://nodejs.org
  echo Then close this window and double-click START.cmd again.
  pause
  exit /b 1
)
node src/cli.js
if errorlevel 1 pause
