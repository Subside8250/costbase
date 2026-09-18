@echo off
title CostBase
cd /d "%~dp0"
echo.
echo   Starting CostBase...
echo   Your browser will open automatically in a few seconds.
echo.
echo   KEEP THIS WINDOW OPEN while you use CostBase.
echo   Close this window (or press Ctrl+C) to stop it.
echo.
call npm run dev -- --port 5173 --strictPort --open
echo.
echo   CostBase has stopped. You can close this window.
pause >nul
