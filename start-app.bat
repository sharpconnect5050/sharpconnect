@echo off
cd /d "%~dp0"
echo Starting SharpConnect server...
start "SharpConnect" cmd /c "npm run start"
timeout /t 8 /nobreak >nul
echo Starting Cloudflare Tunnel...
cloudflared tunnel --url http://localhost:3000
pause
