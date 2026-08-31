@echo off
setlocal

rem Launcher for the Analog Design Refresher Course.
rem
rem The course itself has no dependencies - it is plain HTML, CSS and
rem JavaScript. The only thing needed is a static web server, because the
rem lessons are loaded with XMLHttpRequest and browsers block that on file://.
rem Python ships with a perfectly good one, so all this has to do is find it.
rem
rem Double-click this file, or run it from a terminal.
rem
rem Named launch.bat rather than start.bat on purpose: "start" is an
rem intrinsic cmd command, so a file called start.bat is ambiguous when
rem typed at a prompt and resolves to the builtin in some shells.

cd /d "%~dp0"

rem The Windows launcher first, since it is the one that survives a PATH that
rem has the Microsoft Store's python.exe stub in it.
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 tools\serve.py %*
    goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
    python tools\serve.py %*
    goto :done
)

where python3 >nul 2>&1
if %errorlevel%==0 (
    python3 tools\serve.py %*
    goto :done
)

echo.
echo   Python was not found on this machine.
echo.
echo   The course needs a static web server to run. Python has one built in,
echo   and is the only thing you need to install:
echo.
echo       https://www.python.org/downloads/
echo.
echo   Tick "Add Python to PATH" during the install, then run this again.
echo.
echo   Alternatively, if you already have Node.js:
echo       npx --yes http-server -p 8080 -c-1
echo   then open http://localhost:8080/index.html
echo.
pause
exit /b 1

:done
endlocal
