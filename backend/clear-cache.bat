@echo off
cd /d "%~dp0"
echo Clearing Laravel caches...
"C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe" artisan route:clear
"C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe" artisan config:clear
"C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe" artisan cache:clear
echo Done! Now restart Laragon (STOP then START Apache)
pause
