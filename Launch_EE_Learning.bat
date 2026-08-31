@echo off
rem Kept so existing shortcuts keep working. The launcher now lives in
rem launch.bat, which fixes three things this file used to get wrong:
rem
rem   * it hard-coded port 8080 and simply failed when that was taken
rem   * it only looked for "python", missing the "py" launcher that is the
rem     reliable one on Windows when the Microsoft Store stub is on PATH
rem   * its fallback opened index.html over file://, which CANNOT work - the
rem     lessons are fetched with XHR and every browser blocks that on file://,
rem     so the fallback produced exactly the broken page it was meant to avoid
rem
rem See launch.bat and tools/serve.py.

cd /d "%~dp0"
call launch.bat %*
