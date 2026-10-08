'use client';
import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface Log { id: number; time: string; text: string; }
interface Player { id: number; name: string; rebuys: number; }

interface GameState {
  isSetup: boolean;
  buyInAmount: number;
  players: Player[];
  logs: Log[];
  isCashingOut: boolean;
  finalChips: Record<number, number>;
}

const PAYBOX_LINK = "https://links.payboxapp.com/2kraF8pgPUb";
let socket: Socket;

export default function PokerDashboard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [setupBuyIn, setSetupBuyIn] = useState(50);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [hasClickedPaybox, setHasClickedPaybox] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket = io();
    socket.on('updateState', (state: GameState) => {
      setGameState(state);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.logs]);

  if (!gameState) return <div className="text-center p-10 text-white font-bold text-xl">טוען שולחן...</div>;

  if (!gameState.isSetup) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 font-sans dir-rtl" dir="rtl">
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700 mt-10">
          <h1 className="text-3xl font-bold text-center mb-6 text-green-400">פתיחת שולחן פוקר</h1>
          <div className="mb-8">
            <label className="block text-gray-400 mb-2 font-bold">סכום כניסה ראשונית (₪):</label>
            <input
              type="number"
              value={setupBuyIn}
              onChange={(e) => setSetupBuyIn(Number(e.target.value))}
              className="w-full bg-gray-700 text-white p-4 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none text-xl text-center"
            />
          </div>
          <button
            onClick={() => socket.emit('setupTable', setupBuyIn)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-colors text-xl shadow-lg"
          >
            פתח שולחן לכולם!
          </button>
        </div>
      </div>
    );
  }

  const totalPot = gameState.players.reduce((sum, p) => sum + p.rebuys * gameState.buyInAmount, 0);
  const totalCashedOut = Object.values(gameState.finalChips || {}).reduce((sum, val) => sum + Number(val), 0);
  const balanceDifference = totalCashedOut - totalPot;

  const handleRebuy = (player: Player) => {
    window.open(PAYBOX_LINK, '_blank');
    setTimeout(() => {
      if (window.confirm(`האם העברת ${gameState.buyInAmount}₪ נוספים בפייבוקס?`)) {
        socket.emit('addRebuy', player.id);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-sans dir-rtl pb-24" dir="rtl">
      <div className="max-w-md mx-auto">

        <div className="flex justify-between items-center mb-6 mt-4">
          <button
            onClick={() => socket.emit('toggleCashOut')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors shadow-md text-sm ${gameState.isCashingOut ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}
          >
            {gameState.isCashingOut ? 'חזור למשחק' : 'סיום משחק ופדיון'}
          </button>
          <button
            onClick={() => {
              if (confirm('בטוח שאתה רוצה לאפס הכל?')) socket.emit('resetGame');
            }}
            className="text-red-400 text-sm hover:text-red-300 font-bold bg-red-900/30 px-3 py-2 rounded-md"
          >
            איפוס שולחן
          </button>
        </div>

        <div className={`rounded-xl p-6 shadow-2xl border mb-6 text-center relative overflow-hidden ${gameState.isCashingOut ? 'bg-blue-900/40 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600"></div>
          <h2 className="text-xl text-gray-400 mb-2">קופה כללית (כסף בפייבוקס)</h2>
          <div className="text-6xl font-black text-yellow-400 tracking-tight">₪{totalPot}</div>

          {gameState.isCashingOut && (
            <div className="mt-4 p-3 bg-gray-900 rounded-lg">
              <div className="text-gray-300 text-sm mb-1">סה"כ צ'יפים שהוזנו: ₪{totalCashedOut}</div>
              {balanceDifference === 0 ? (
                <div className="text-green-400 font-bold text-lg">✓ השולחן מאוזן באופן מושלם</div>
              ) : balanceDifference > 0 ? (
                <div className="text-red-400 font-bold text-lg">✗ עודף צ'יפים: ₪{balanceDifference} (מישהו טעה)</div>
              ) : (
                <div className="text-orange-400 font-bold text-lg">! חסרים צ'יפים: ₪{Math.abs(balanceDifference)} (לא כולם הזינו)</div>
              )}
            </div>
          )}
        </div>

        {!gameState.isCashingOut && (
          <div className="bg-gray-800 rounded-xl p-5 shadow-lg border border-teal-700/50 mb-6">
            <h3 className="text-lg font-bold mb-4 text-teal-400">הצטרפות לשולחן:</h3>
            <div className="space-y-3">
              <input
                type="text" placeholder="הכנס את השם שלך..." value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:outline-none focus:border-teal-500"
              />
              <div className="flex gap-2">
                <a
                  href={PAYBOX_LINK} target="_blank" rel="noopener noreferrer"
                  onClick={() => setHasClickedPaybox(true)}
                  className="flex-1 bg-[#14B8A6] hover:bg-teal-400 py-3 rounded-lg font-bold transition-colors text-center text-white shadow-md border border-teal-500"
                >
                  1. שלם בפייבוקס
                </a>
                <button
                  disabled={!hasClickedPaybox || !newPlayerName.trim()}
                  onClick={() => {
                    socket.emit('addPlayer', newPlayerName.trim());
                    setNewPlayerName('');
                    setHasClickedPaybox(false);
                  }}
                  className={`flex-1 py-3 rounded-lg font-bold transition-all shadow-md ${(hasClickedPaybox && newPlayerName.trim()) ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-500'}`}
                >
                  2. היכנס למשחק
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-8">
          <h3 className="text-lg font-bold text-gray-400 mb-2">
            {gameState.isCashingOut ? 'הזנת צ\'יפים לכל שחקן:' : `שחקנים פעילים (${gameState.players.length}):`}
          </h3>

          {gameState.players.map(player => (
            <div key={player.id} className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 flex justify-between items-center">
              <div>
                <div className="font-bold text-xl mb-1">{player.name}</div>
                {!gameState.isCashingOut && (
                  <div className="text-yellow-400 font-bold text-sm">הכניס לקופה: ₪{player.rebuys * gameState.buyInAmount}</div>
                )}
              </div>

              {!gameState.isCashingOut ? (
                <div className="flex items-center gap-3">
                  <span className="bg-gray-700 border border-gray-600 px-3 py-1.5 rounded-lg text-md font-mono font-bold" dir="ltr">x{player.rebuys}</span>
                  <button onClick={() => handleRebuy(player)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition-colors shadow-md text-sm">
                    + Re-buy
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-gray-400 text-sm text-left">להעביר חזרה:</div>
                  <input
                    type="number" value={gameState.finalChips[player.id] || ''} placeholder="₪"
                    onChange={(e) => socket.emit('updateFinalChips', { playerId: player.id, amount: Number(e.target.value) })}
                    className="w-24 bg-gray-700 text-yellow-400 font-bold text-lg p-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-center" dir="ltr"
                  />
                </div>
              )}
            </div>
          ))}
          {gameState.players.length === 0 && <div className="text-center text-gray-500 py-6">עדיין אין שחקנים בשולחן...</div>}
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
          <div className="bg-gray-900 p-3 text-sm font-bold text-gray-400 border-b border-gray-700">היסטוריית פעולות (Live)</div>
          <div className="p-3 h-40 overflow-y-auto space-y-2 text-sm text-gray-300">
            {!gameState.logs || gameState.logs.length === 0 ? (
              <div className="text-gray-600 text-center mt-4">אין היסטוריה עדיין...</div>
            ) : (
              gameState.logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-gray-500 font-mono">[{log.time}]</span>
                  <span>{log.text}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}