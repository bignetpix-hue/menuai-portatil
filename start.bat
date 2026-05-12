@echo off
cd /d "%~dp0"
echo.
echo  MENUAI - Cardapio Digital
echo  ================================
echo.
IF NOT EXIST "node_modules" (
    echo  Instalando dependencias...
    call npm install
    echo.
)
echo  Iniciando servidor...
echo.
node server/index.js
pause
