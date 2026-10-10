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
        finalChips: {},
        collectedRake: 0,
        totalPaidOut: 0
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
                isSetup: true, buyInAmount: amount, players: [], logs: [], isCashingOut: false, finalChips: {}, collectedRake: 0, totalPaidOut: 0
            };
            addLog(`השולחן נפתח! סכום כניסה: ₪${amount}`);
            io.emit('updateState', gameState);
        });

        socket.on('addPlayer', (name) => {
            const trimmedName = name.trim();
            const existingPlayer = gameState.players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());

            if (existingPlayer) {
                existingPlayer.rebuys += 1;
                addLog(`${existingPlayer.name} נרשם שוב בטעות - נוסף אוטומטית כ Re-buy`);
            } else {
                const newId = gameState.players.length > 0 ? Math.max(...gameState.players.map(p => p.id)) + 1 : 1;
                // נוספו ערכים לניהול פדיון מוקדם
                gameState.players.push({ id: newId, name: trimmedName, rebuys: 1, hasCashedOut: false, cashedOutChips: 0, payout: 0, paidRake: 0 });
                gameState.finalChips[newId] = 0;
                addLog(`${trimmedName} שילם והצטרף לשולחן`);
            }
            io.emit('updateState', gameState);
        });

        socket.on('addRebuy', (data) => {
            const playerId = data.playerId;
            const count = data.count || 1;

            const player = gameState.players.findIndex(p => p.id === playerId);
            if (player > -1) {
                gameState.players[player].rebuys += count;
                const text = count > 1 ? `Re-buy (x${count}) ב-₪${count * gameState.buyInAmount}` : 'Re-buy';
                addLog(`${gameState.players[player].name} ביצע ${text}`);
                io.emit('updateState', gameState);
            }
        });

        socket.on('toggleCashOut', () => {
            gameState.isCashingOut = !gameState.isCashingOut;
            addLog(gameState.isCashingOut ? 'המשחק הושהה - מעבר למסך פדיון' : 'חזרנו למצב משחק פעיל');
            io.emit('updateState', gameState);
        });

        socket.on('updateFinalChips', ({ playerId, amount }) => {
            gameState.finalChips[playerId] = amount;
            io.emit('updateState', gameState);
        });

        // פונקציה חדשה: סגירת שחקן פרטני (לפרישה מוקדמת או סוף ערב)
        socket.on('settlePlayer', (playerId) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player && !player.hasCashedOut) {
                const chips = gameState.finalChips[playerId] || 0;
                const invested = player.rebuys * gameState.buyInAmount;
                const profit = chips - invested;
                let rake = 0;
                if (profit > 0) rake = Math.round(profit * 0.1);
                const payout = chips - rake;

                player.hasCashedOut = true;
                player.cashedOutChips = chips;
                player.payout = payout;
                player.paidRake = rake;

                gameState.collectedRake += rake;
                gameState.totalPaidOut += payout;

                addLog(`${player.name} פדה ₪${payout} ויצא מהשולחן`);
                io.emit('updateState', gameState);
            }
        });

        // פונקציה חדשה: ביטול סגירת שחקן במידה והייתה טעות
        socket.on('unsettlePlayer', (playerId) => {
            const player = gameState.players.find(p => p.id === playerId);
            if (player && player.hasCashedOut) {
                gameState.collectedRake -= player.paidRake;
                gameState.totalPaidOut -= player.payout;

                player.hasCashedOut = false;
                player.cashedOutChips = 0;
                player.payout = 0;
                player.paidRake = 0;

                addLog(`הפדיון של ${player.name} בוטל והוא הוחזר לשולחן`);
                io.emit('updateState', gameState);
            }
        });

        socket.on('resetGame', () => {
            gameState = { isSetup: false, buyInAmount: 50, players: [], logs: [], isCashingOut: false, finalChips: {}, collectedRake: 0, totalPaidOut: 0 };
            io.emit('updateState', gameState);
        });
    });

    server.use((req, res) => handle(req, res));

    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
        console.log(`> Poker Manager running on port ${port}`);
    });
});