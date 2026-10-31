@echo off
setlocal
cd /d "%~dp0"
title Fortnite Backend - Local
echo ============================================================
echo   FORTNITE BACKEND - START HERE
echo ============================================================
echo This window will ask for your version, game folder and name.
echo Press Enter to keep a suggested value shown in [brackets].
echo To try a local match, choose option 2 when the menu appears.
echo Keep this window open while playing. Type H in the menu for help.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is missing. Install it from https://nodejs.org
  echo Then close this window and double-click START.cmd again.
  pause
  exit /b 1
)
node src/cli.js
if errorlevel 1 pause
