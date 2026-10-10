'use client';
import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface Log { id: number; time: string; text: string; }
interface Player {
  id: number; name: string; rebuys: number;
  hasCashedOut?: boolean; cashedOutChips?: number; payout?: number; paidRake?: number;
}

interface GameState {
  isSetup: boolean;
  buyInAmount: number;
  players: Player[];
  logs: Log[];
  isCashingOut: boolean;
  finalChips: Record<number, number>;
  collectedRake: number;
  totalPaidOut: number;
}

const PAYBOX_LINK = "https://links.payboxapp.com/2kraF8pgPUb";
let socket: Socket;

export default function PokerDashboard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [setupBuyIn, setSetupBuyIn] = useState(50);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [hasClickedPaybox, setHasClickedPaybox] = useState(false);
  const [myPlayerName, setMyPlayerName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem('pokerAdmin') === 'true') setIsAdmin(true);

    socket = io();
    socket.on('updateState', (state: GameState) => setGameState(state));

    const savedName = localStorage.getItem('pokerPlayerName');
    if (savedName) setMyPlayerName(savedName);

    return () => { socket.disconnect(); };
  }, []);

  const logsLength = gameState?.logs?.length || 0;
  useEffect(() => {
    if (logsEndRef.current && !gameState?.isCashingOut) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsLength, gameState?.isCashingOut]);

  const handleAdminLogin = () => {
    if (isAdmin) {
      if (window.confirm("לצאת ממצב מנהל?")) {
        localStorage.removeItem('pokerAdmin');
        setIsAdmin(false);
      }
    } else {
      const code = window.prompt("הכנס קוד מנהל (PIN):");
      if (code === "1234") {
        localStorage.setItem('pokerAdmin', 'true');
        setIsAdmin(true);
      } else if (code !== null) alert("קוד שגוי ❌");
    }
  };

  if (!gameState) return <div className="text-center p-10 text-white font-bold text-xl">טוען שולחן...</div>;

  const AdminLockButton = () => (
    <button
      onClick={handleAdminLogin}
      className="fixed top-4 left-4 z-[999] bg-gray-800/90 p-3 rounded-full border-2 border-gray-600 text-2xl shadow-xl backdrop-blur-md transition-transform hover:scale-110"
    >
      {isAdmin ? '🔓' : '🔒'}
    </button>
  );

  if (!gameState.isSetup) {
    return (
      <div className="min-h-screen text-white p-4 font-sans dir-rtl bg-gray-900 relative" dir="rtl"
        style={{ backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.95)), url('/sheep.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>

        <AdminLockButton />

        <div className="max-w-md mx-auto bg-gray-800/90 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-2xl border border-gray-700 mt-16">
          <h1 className="text-3xl font-bold text-center mb-6 text-green-400">פתיחת שולחן פוקר</h1>
          <div className="mb-8">
            <label className="block text-gray-400 mb-2 font-bold">סכום כניסה ראשונית (₪):</label>
            <input type="number" value={setupBuyIn} onChange={(e) => setSetupBuyIn(Number(e.target.value))} className="w-full bg-gray-700 text-white p-4 rounded-lg border border-gray-600 focus:border-green-500 text-xl text-center" />
          </div>
          <button onClick={() => socket.emit('setupTable', setupBuyIn)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-xl shadow-lg">
            פתח שולחן לכולם!
          </button>
        </div>
      </div>
    );
  }

  const totalEntries = gameState.players.reduce((sum, p) => sum + p.rebuys, 0);
  const totalGrossPot = totalEntries * gameState.buyInAmount;
  const currentBoxBalance = totalGrossPot - (gameState.totalPaidOut || 0);

  const activePlayers = gameState.players.filter(p => !p.hasCashedOut);
  const cashedOutPlayers = gameState.players.filter(p => p.hasCashedOut);

  const expectedActiveChips = totalGrossPot - cashedOutPlayers.reduce((sum, p) => sum + (p.cashedOutChips || 0), 0);
  const currentActiveChipsInput = activePlayers.reduce((sum, p) => sum + Number(gameState.finalChips[p.id] || 0), 0);
  const remainingPotDifference = expectedActiveChips - currentActiveChipsInput;

  let activeRake = 0;
  if (gameState.isCashingOut) {
    activePlayers.forEach(p => {
      const invested = p.rebuys * gameState.buyInAmount;
      const chips = gameState.finalChips[p.id] || 0;
      const profit = chips - invested;
      if (profit > 0) activeRake += Math.round(profit * 0.1);
    });
  }
  const displayTotalRake = (gameState.collectedRake || 0) + activeRake;

  const handleJoin = () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) return;
    localStorage.setItem('pokerPlayerName', trimmedName);
    setMyPlayerName(trimmedName);
    socket.emit('addPlayer', trimmedName);
    setNewPlayerName('');
    setHasClickedPaybox(false);
  };

  const handleRebuy = (player: Player, count: number) => {
    const amountToPay = gameState.buyInAmount * count;
    window.open(PAYBOX_LINK, '_blank');
    setTimeout(() => {
      if (window.confirm(`האם העברת ${amountToPay}₪ נוספים בפייבוקס?`)) {
        socket.emit('addRebuy', { playerId: player.id, count });
      }
    }, 500);
  };

  return (
    <div className="min-h-screen text-white p-3 md:p-4 font-sans dir-rtl pb-24 bg-gray-900 relative" dir="rtl"
      style={{ backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url('/sheep.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>

      <AdminLockButton />

      <div className="max-w-md mx-auto pt-10 md:pt-10">

        <div className="flex justify-between items-center mb-6 mt-2">
          <button onClick={() => socket.emit('toggleCashOut')} className={`px-4 py-2 rounded-lg font-bold transition-colors shadow-md text-sm ${gameState.isCashingOut ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}>
            {gameState.isCashingOut ? 'חזור למשחק' : 'סיום משחק ופדיון'}
          </button>
          <button onClick={() => { if (confirm('בטוח שאתה רוצה לאפס הכל?')) socket.emit('resetGame'); }} className="text-red-400 text-sm hover:text-red-300 font-bold bg-red-900/40 px-3 py-2 rounded-md">
            איפוס שולחן
          </button>
        </div>

        <div className={`rounded-xl p-5 md:p-6 shadow-2xl border mb-6 text-center relative overflow-hidden backdrop-blur-sm ${gameState.isCashingOut ? 'bg-blue-900/60 border-blue-500' : 'bg-gray-800/80 border-gray-700'}`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600"></div>
          {isAdmin && <div className="absolute top-3 right-3 text-yellow-500 text-xs bg-yellow-900/40 px-2 py-1 rounded border border-yellow-700/50">מנהל 👑</div>}

          <h2 className="text-lg md:text-xl text-gray-300 mb-2">יתרה נוכחית בפייבוקס</h2>
          <div className="text-5xl md:text-6xl font-black text-yellow-400 tracking-tight">₪{currentBoxBalance}</div>

          {displayTotalRake > 0 && (
            <div className="text-red-400 font-bold text-xs md:text-sm mt-2 bg-red-900/40 inline-block px-3 py-1 rounded-full border border-red-500/30">
              רווח לבית (10% מהמנצחים): ₪{displayTotalRake}
            </div>
          )}

          <div className="text-gray-400 text-sm mt-3">סה"כ כניסות הערב: <span className="font-bold text-white">{totalEntries}</span></div>

          {gameState.isCashingOut && (
            <div className={`mt-5 p-4 bg-gray-900/90 rounded-xl border-2 shadow-inner transition-colors duration-300 ${remainingPotDifference === 0 ? 'border-green-500' : remainingPotDifference < 0 ? 'border-red-500' : 'border-orange-500'}`}>
              <div className="flex justify-between items-center text-gray-300 text-sm border-b border-gray-700 pb-2 mb-3">
                <span>צ'יפים שהוזנו עכשיו:</span>
                <span className="font-bold text-white text-lg">₪{currentActiveChipsInput} / ₪{expectedActiveChips}</span>
              </div>

              <div className="text-center">
                {remainingPotDifference === 0 ? (
                  <div className="animate-pulse">
                    <div className="text-green-400 font-black text-xl mb-1">✓ השולחן מאוזן מושלם!</div>
                    <div className="text-green-300 text-xs">אפשר לבצע פדיון לכולם בשקט.</div>
                  </div>
                ) : remainingPotDifference > 0 ? (
                  <div>
                    <div className="text-gray-400 text-sm mb-1">כסף שנשאר לחלק (חסרים צ'יפים):</div>
                    <div className="text-orange-400 font-black text-3xl">₪{remainingPotDifference}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-red-400 text-sm mb-1 font-bold">⚠️ מינוס! מישהו הזין יותר מדי:</div>
                    <div className="text-red-500 font-black text-3xl">₪{Math.abs(remainingPotDifference)} -</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!gameState.isCashingOut && (
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 md:p-5 shadow-lg border border-teal-700/50 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-teal-400">הצטרפות לשולחן:</h3>
              {myPlayerName && <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded border border-gray-600">מזוהה כ: <strong className="text-teal-300">{myPlayerName}</strong></span>}
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="הכנס את השם שלך..." value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:outline-none focus:border-teal-500" />
              <div className="flex flex-col md:flex-row gap-2">
                <a href={PAYBOX_LINK} target="_blank" rel="noopener noreferrer" onClick={() => setHasClickedPaybox(true)} className="flex-1 bg-[#14B8A6] hover:bg-teal-400 py-3 rounded-lg font-bold text-center text-white shadow-md border border-teal-500">
                  1. שלם בפייבוקס
                </a>
                <button disabled={!hasClickedPaybox || !newPlayerName.trim()} onClick={handleJoin} className={`flex-1 py-3 rounded-lg font-bold shadow-md ${(hasClickedPaybox && newPlayerName.trim()) ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                  2. היכנס למשחק
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-8">
          <h3 className="text-lg font-bold text-gray-300 mb-2">
            {gameState.isCashingOut ? 'ניהול פדיון שחקנים:' : `שחקנים פעילים (${activePlayers.length}):`}
          </h3>

          {gameState.players.map(player => {
            const isMe = myPlayerName && player.name.toLowerCase() === myPlayerName.toLowerCase();
            const invested = player.rebuys * gameState.buyInAmount;
            const chips = player.hasCashedOut ? player.cashedOutChips : (gameState.finalChips[player.id] || 0);
            const profit = (chips || 0) - invested;
            let rake = 0; if (profit > 0) rake = Math.round(profit * 0.1);
            const finalPayout = (chips || 0) - rake;

            if (player.hasCashedOut) {
              return (
                <div key={player.id} className="bg-gray-900/60 p-4 rounded-xl shadow-lg border border-green-500/30 opacity-80">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-lg text-gray-400 line-through decoration-gray-500">{player.name}</div>
                    <span className="bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded border border-green-500/50">שולם וסיים</span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <div className="flex justify-between"><span>השקיע:</span> <span>₪{invested}</span></div>
                    <div className="flex justify-between text-yellow-500 font-bold mt-1 pt-1 border-t border-gray-700">
                      <span>הועבר אליו:</span> <span>₪{player.payout}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => socket.emit('unsettlePlayer', player.id)} className="w-full mt-3 bg-gray-700 hover:bg-gray-600 py-1.5 rounded text-xs text-gray-300 transition-colors">
                      טעות? בטל פדיון והחזר למשחק
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div key={player.id} className="bg-gray-800/80 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-700 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-xl text-white">{player.name}</div>
                    {!gameState.isCashingOut && (
                      <div className="text-yellow-400 font-bold text-sm">הכניס: ₪{invested} <span className="text-gray-400 text-xs ml-1">(x{player.rebuys})</span></div>
                    )}
                  </div>

                  {!gameState.isCashingOut ? (
                    <div className="flex flex-col items-end gap-2">
                      {(isMe || isAdmin) ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {/* כפתור מחיקת כניסה שמוצג רק לאדמין */}
                          {isAdmin && player.rebuys > 0 && (
                            <button onClick={() => { if (confirm(`למחוק כניסה אחת (₪${gameState.buyInAmount}) ל${player.name}?`)) socket.emit('removeRebuy', { playerId: player.id, count: 1 }); }} className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg font-bold shadow-md text-xs text-white">
                              - מחיקת כניסה (טעות)
                            </button>
                          )}
                          <button onClick={() => handleRebuy(player, 1)} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg font-bold shadow-md text-xs text-white">
                            + ₪{gameState.buyInAmount}
                          </button>
                          <button onClick={() => handleRebuy(player, 2)} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg font-bold shadow-md text-xs text-white">
                            + ₪{gameState.buyInAmount * 2}
                          </button>
                        </div>
                      ) : (
                        <button disabled className="bg-gray-700/50 text-gray-500 px-4 py-2 rounded-lg font-bold shadow-md text-sm cursor-not-allowed flex items-center gap-1">
                          <span>🔒</span> נעול
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-gray-300 text-sm">צ'יפים:</div>
                      <input type="number" value={gameState.finalChips[player.id] || ''} placeholder="₪"
                        onChange={(e) => socket.emit('updateFinalChips', { playerId: player.id, amount: Number(e.target.value) })}
                        className="w-20 md:w-24 bg-gray-700 text-yellow-400 font-bold text-lg p-2 rounded-lg border border-gray-600 focus:border-blue-500 text-center" dir="ltr" />
                    </div>
                  )}
                </div>

                {gameState.isCashingOut && (
                  <div className="bg-gray-900/60 p-3 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between text-gray-300"><span>השקעה כוללת:</span><span>₪{invested}</span></div>
                    {profit > 0 ? (
                      <>
                        <div className="flex justify-between text-green-400"><span>רווח נקי:</span><span>₪{profit}</span></div>
                        <div className="flex justify-between text-purple-400"><span>10% לבית:</span><span>₪{rake}-</span></div>
                      </>
                    ) : profit < 0 ? (
                      <div className="flex justify-between text-red-400"><span>הפסד:</span><span>₪{Math.abs(profit)}-</span></div>
                    ) : (
                      <div className="flex justify-between text-gray-400"><span>מאוזן:</span><span>₪0</span></div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-700">
                      <div className="text-yellow-400 font-bold text-base">₪{finalPayout} להעברה</div>
                      <button onClick={() => { if (confirm(`האם העברת ₪${finalPayout} ל${player.name} בפייבוקס?`)) socket.emit('settlePlayer', player.id); }}
                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow transition-colors">
                        בצע פדיון וסגור שחקן
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {gameState.players.length === 0 && <div className="text-center text-gray-400 py-6">עדיין אין שחקנים בשולחן...</div>}
        </div>

        <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 overflow-hidden">
          <div className="bg-gray-900/90 p-3 text-sm font-bold text-gray-300 border-b border-gray-700">היסטוריית פעולות (Live)</div>
          <div className="p-3 h-40 overflow-y-auto space-y-2 text-sm text-gray-200">
            {!gameState.logs || gameState.logs.length === 0 ? (
              <div className="text-gray-400 text-center mt-4">אין היסטוריה עדיין...</div>
            ) : (
              gameState.logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-gray-400 font-mono">[{log.time}]</span>
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