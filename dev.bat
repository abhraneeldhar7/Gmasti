@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"

start "Gmasti API" powershell -NoExit -Command "Set-Location -LiteralPath '%ROOT%apps\server'; if (Test-Path '.venv\Scripts\python.exe') { & '.venv\Scripts\python.exe' -m uvicorn app.main:app --reload } else { py -3.13 -m uvicorn app.main:app --reload }"
start "Gmasti Webapp" powershell -NoExit -Command "Set-Location -LiteralPath '%ROOT%apps\webapp'; npm run dev"

endlocal