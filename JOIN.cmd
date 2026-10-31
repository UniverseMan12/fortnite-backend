@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Fortnite Launcher
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer from https://nodejs.org
  pause
  exit /b 1
)
node src/cli.js --join
if errorlevel 1 pause
