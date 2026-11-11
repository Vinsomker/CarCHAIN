@echo off
echo ===================================================
echo   CarChain - Starting MongoDB Local Server
echo ===================================================
if not exist "..\data\db" mkdir "..\data\db"
echo Data directory: %~dp0data\db
"C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --dbpath "%~dp0data\db" --bind_ip 127.0.0.1
pause
