@echo off
set PROJECT_ROOT=%~dp0
powershell -ExecutionPolicy Bypass -File "%PROJECT_ROOT%deploy\windows-native\launcher.ps1" -ProjectRoot "%PROJECT_ROOT:~0,-1%"
