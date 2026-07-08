@echo off
title Ally Companion Launcher
echo ===================================================
echo             ALLY AI COMPANION LAUNCHER
echo ===================================================
echo.

:: Verify if .env exists, if not, alert user
if not exist "backend\.env" (
    echo [WARNING] backend\.env was not found.
    echo Copying .env.example to backend\.env...
    copy .env.example backend\.env >nul
    echo Please open backend\.env and verify your local OLLAMA_HOST details!
    echo.
)

:: Starting backend server in separate shell
echo [+] Launching local FastAPI backend on port 8000...
start "Ally Backend Server" cmd /k "title Ally Backend && venv\Scripts\python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

:: Wait 1.5 seconds for backend startup
timeout /t 2 /nobreak >nul

:: Starting frontend server in separate shell
echo [+] Launching React + Vite dev server...
start "Ally Frontend Client" cmd /k "title Ally Frontend && cd frontend && npm run dev"

echo.
echo ===================================================
echo [+] Ally has been launched successfully!
echo [+] Browser UI is available at: http://localhost:5173
echo [+] Backend API is available at: http://127.0.0.1:8000
echo ===================================================
echo.
echo Press any key to exit this launcher (servers will keep running in their windows).
pause >nul
