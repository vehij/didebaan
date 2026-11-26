@echo off
cd /d "%~dp0"
rem Didebaan Companion updater (Windows): double-click to replace this folder with the latest released version.
rem Chrome keeps loading the extension from this same folder, so the pairing stays.
echo Downloading the latest Didebaan Companion...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $dir=(Get-Location).Path; $zip=Join-Path $env:TEMP 'didebaan-companion.zip'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing 'https://github.com/vehij/didebaan/releases/latest/download/didebaan-companion.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath $dir -Force; Remove-Item $zip"
if errorlevel 1 (echo Update failed. Check the internet connection and try again.) else (echo Updated. The extension reloads itself within a few minutes, or right away when you open its popup.)
pause
