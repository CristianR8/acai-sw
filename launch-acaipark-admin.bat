@echo off
set PROJECT_ROOT=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%deploy\windows-admin\start-admin.ps1" -ProjectRoot "%PROJECT_ROOT:~0,-1%"
