@echo off
rem Play-Paperfall.bat - put this in the repo root (next to package.json) and double-click it.
rem Builds the game the first time, installs the desktop shell the first time, then opens the game window.
rem Needs Node.js installed. After you change code, run `npm run build` once, then use this again.
setlocal
cd /d "%~dp0"

rem Never offer upstream's updates over this build.
set DAGGER_NO_UPDATE_CHECK=1

if not exist "dist\index.html" (
  echo Building the game ^(first run, about a minute^)...
  call npm install
  if errorlevel 1 goto :fail
  call npm run build
  if errorlevel 1 goto :fail
)

if not exist "app\node_modules" (
  echo Installing the desktop shell...
  pushd app
  call npm install
  if errorlevel 1 ( popd & goto :fail )
  popd
)

cd app
call npm start
goto :eof

:fail
echo.
echo Something failed above. Read the message, then press any key to close.
pause >nul
