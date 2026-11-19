@echo off
rem Starts WellSense (Future Health Digital Innovation Challenge 2026, Wellbeing track) on http://localhost:8765 and opens it in Edge.
cd /d "%~dp0"
powershell -NoProfile -Command "if (-not (Test-NetConnection 127.0.0.1 -Port 8765 -InformationLevel Quiet -WarningAction SilentlyContinue)) { Start-Process -WindowStyle Hidden 'C:\Python314\python.exe' -ArgumentList '-m','http.server','8765','--bind','127.0.0.1' -WorkingDirectory '%~dp0' ; Start-Sleep -Milliseconds 800 }"
start "" msedge --app=http://localhost:8765/
