@echo off
setlocal EnableExtensions
call "%~dp0scripts\run-local.cmd"
exit /b %errorlevel%
