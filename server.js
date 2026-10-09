const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);
    const io = new Server(httpServer);

    let gameState = {
        isSetup: false,
        buyInAmount: 50,
        players: [],
        logs: [],
        isCashingOut: false,
        finalChips: {}
    };

    const addLog = (text) => {
        const time = new Date().toLocaleTimeString('he-IL', {
            timeZone: 'Asia/Jerusalem',
            hour: '2-digit',
            minute: '2-digit'
        });
        gameState.logs.push({ id: Date.now() + Math.random(), time, text });
        if (gameState.logs.length > 50) gameState.logs.shift();
    };

    io.on('connection', (socket) => {
        socket.emit('updateState', gameState);

        socket.on('setupTable', (amount) => {
            gameState = {
                isSetup: true, buyInAmount: amount, players: [], logs: [], isCashingOut: false, finalChips: {}
            };
            addLog(`השולחן נפתח! סכום כניסה: ₪${amount}`);
            io.emit('updateState', gameState);
        });

        socket.on('addPlayer', (name) => {
            const newId = gameState.players.length > 0 ? Math.max(...gameState.players.map(p => p.id)) + 1 : 1;
            gameState.players.push({ id: newId, name: name, rebuys: 1 });
            gameState.finalChips[newId] = 0;
            addLog(`${name} שילם והצטרף לשולחן`);
            io.emit('updateState', gameState);
        });

        socket.on('addRebuy', (playerId) => {
            const player = gameState.players.findIndex(p => p.id === playerId);
            if (player > -1) {
                gameState.players[player].rebuys += 1;
                addLog(`${gameState.players[player].name} ביצע Re-buy`);
                io.emit('updateState', gameState);
            }
        });

        socket.on('toggleCashOut', () => {
            gameState.isCashingOut = !gameState.isCashingOut;
            addLog(gameState.isCashingOut ? 'המשחק הסתיים - עברנו למצב פדיון צ\'יפים' : 'חזרנו למצב משחק פעיל');
            io.emit('updateState', gameState);
        });

        socket.on('updateFinalChips', ({ playerId, amount }) => {
            gameState.finalChips[playerId] = amount;
            io.emit('updateState', gameState);
        });

        socket.on('resetGame', () => {
            gameState = { isSetup: false, buyInAmount: 50, players: [], logs: [], isCashingOut: false, finalChips: {} };
            io.emit('updateState', gameState);
        });
    });

    server.use((req, res) => handle(req, res));

    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
        console.log(`> Poker Manager running on port ${port}`);
    });
});