import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, ChatMessage, GamePhase, NetworkMessage, DrawPath } from './types';
import { WORD_LIST, AVATARS, ROUND_TIME, MAX_ROUNDS } from './constants';
import GameCanvas from './components/GameCanvas';
import { Users, Send, Copy, Crown, Timer, AlertCircle, Play, LogOut, CheckCircle2 } from 'lucide-react';

// --- INITIAL STATE ---
const INITIAL_STATE: GameState = {
  roomId: '',
  phase: 'LOBBY',
  players: [],
  currentDrawerId: null,
  currentWord: '',
  currentWordHint: '',
  timeLeft: 0,
  round: 1,
  totalRounds: MAX_ROUNDS,
  drawingData: [],
  chatHistory: [],
  wordChoices: [],
  winnerId: null,
};

export default function App() {
  // Local User State
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState(AVATARS[0]);
  const [inputRoomId, setInputRoomId] = useState('');
  
  // Network State
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map()); // Host stores all, Client stores Host
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [errorMsg, setErrorMsg] = useState('');

  // Game State
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [chatInput, setChatInput] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived State
  const isHost = gameState.players.find(p => p.id === myId)?.isHost || false;
  const isDrawer = gameState.currentDrawerId === myId;
  const myPlayer = gameState.players.find(p => p.id === myId);

  // --- NETWORK HELPERS ---

  const sendMessage = useCallback((msg: NetworkMessage, targetConn?: DataConnection) => {
    if (targetConn) {
      if (targetConn.open) targetConn.send(msg);
    } else {
      // Broadcast to all connected peers
      connectionsRef.current.forEach(conn => {
        if (conn.open) conn.send(msg);
      });
    }
  }, []);

  const handleData = useCallback((data: unknown, senderId: string) => {
    const msg = data as NetworkMessage;
    
    switch (msg.type) {
      case 'UPDATE_STATE':
        setGameState(msg.payload);
        break;
        
      case 'DRAW_ACTION':
        // If Host receives draw, update state and broadcast
        if (isHost) {
          setGameState(prev => {
            const newState = {
               ...prev,
               drawingData: [...prev.drawingData, msg.payload]
            };
            sendMessage({ type: 'UPDATE_STATE', payload: newState });
            return newState;
          });
        }
        break;

      case 'CLEAR_CANVAS':
        if (isHost) {
          setGameState(prev => {
            const newState = { ...prev, drawingData: [] };
            sendMessage({ type: 'UPDATE_STATE', payload: newState });
            return newState;
          });
        }
        break;

      case 'CHAT_MESSAGE':
        if (isHost) {
          processChatMessage(msg.payload, senderId);
        }
        break;

      case 'JOIN':
        // Host handling new player
        if (isHost) {
          const newPlayer: Player = {
            id: msg.payload.id,
            name: msg.payload.name,
            avatar: msg.payload.avatar,
            score: 0,
            isHost: false,
            hasGuessedCorrectly: false,
            isConnected: true
          };
          
          setGameState(prev => {
            // Avoid duplicates
            if (prev.players.find(p => p.id === newPlayer.id)) return prev;
            
            const newState = {
              ...prev,
              players: [...prev.players, newPlayer],
              chatHistory: [...prev.chatHistory, {
                id: uuidv4(),
                playerId: 'SYSTEM',
                playerName: 'System',
                text: `${newPlayer.name} 加入了游戏`,
                type: 'SYSTEM',
                timestamp: Date.now()
              } as ChatMessage]
            };
            sendMessage({ type: 'UPDATE_STATE', payload: newState });
            return newState;
          });
        }
        break;
        
      case 'CHOOSE_WORD':
        if (isHost && gameState.phase === 'CHOOSING_WORD') {
           startRound(msg.payload);
        }
        break;

       case 'RESTART':
         if (isHost) {
           resetGame();
         }
         break;
    }
  }, [isHost, gameState.phase, sendMessage]); 

  // --- HOST GAME LOGIC ---

  const processChatMessage = (text: string, playerId: string) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    // Check if guess is correct
    const isCorrect = gameState.phase === 'DRAWING' && 
                      playerId !== gameState.currentDrawerId && 
                      !player.hasGuessedCorrectly &&
                      text.trim() === gameState.currentWord;

    if (isCorrect) {
      // Correct Guess Logic
      const points = Math.ceil((gameState.timeLeft / ROUND_TIME) * 100);
      
      setGameState(prev => {
        const updatedPlayers = prev.players.map(p => {
          if (p.id === playerId) return { ...p, score: p.score + points, hasGuessedCorrectly: true };
          if (p.id === prev.currentDrawerId) return { ...p, score: p.score + 50 }; // Drawer gets partial points
          return p;
        });
        
        const sysMsg: ChatMessage = {
          id: uuidv4(),
          playerId: playerId,
          playerName: player.name,
          text: '猜对了答案！',
          type: 'GUESS_CORRECT',
          timestamp: Date.now()
        };

        const newState = {
          ...prev,
          players: updatedPlayers,
          chatHistory: [...prev.chatHistory, sysMsg]
        };
        
        // Check if all guessers have guessed
        const guessers = updatedPlayers.filter(p => p.id !== prev.currentDrawerId && p.isConnected);
        const allGuessed = guessers.length > 0 && guessers.every(p => p.hasGuessedCorrectly);
        
        if (allGuessed) {
           setTimeout(() => endRound(newState), 1000);
        }

        sendMessage({ type: 'UPDATE_STATE', payload: newState });
        return newState;
      });
    } else {
      // Normal Chat
      setGameState(prev => {
        const msg: ChatMessage = {
          id: uuidv4(),
          playerId,
          playerName: player.name,
          text,
          type: 'CHAT',
          timestamp: Date.now()
        };
        const newState = {
          ...prev,
          chatHistory: [...prev.chatHistory, msg]
        };
        sendMessage({ type: 'UPDATE_STATE', payload: newState });
        return newState;
      });
    }
  };

  const startGameHost = () => {
    if (!isHost) return;
    setGameState(prev => ({
      ...prev,
      phase: 'LOBBY', // Reset first
      score: 0,
      round: 1,
      players: prev.players.map(p => ({ ...p, score: 0, hasGuessedCorrectly: false })),
    }));
    nextTurn(gameState.players, 1);
  };

  const nextTurn = (currentPlayers: Player[], roundNum: number) => {
    // Pick next drawer
    const drawer = currentPlayers[Math.floor(Math.random() * currentPlayers.length)];
    
    const words = [];
    for(let i=0; i<3; i++) words.push(WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]);

    const newState: GameState = {
      ...gameState,
      players: currentPlayers.map(p => ({...p, hasGuessedCorrectly: false})), // Reset round flags
      phase: 'CHOOSING_WORD',
      currentDrawerId: drawer.id,
      currentWord: '',
      currentWordHint: '',
      wordChoices: words,
      timeLeft: 15,
      drawingData: [],
      round: roundNum
    };
    
    setGameState(newState);
    sendMessage({ type: 'UPDATE_STATE', payload: newState });

    // Start Selection Timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
       setGameState(prev => {
         if (prev.timeLeft <= 1) {
           if (prev.phase === 'CHOOSING_WORD') {
             clearInterval(timerRef.current!);
             return prev; 
           }
         }
         const t = prev.timeLeft - 1;
         sendMessage({ type: 'UPDATE_STATE', payload: { ...prev, timeLeft: t } });
         return { ...prev, timeLeft: t };
       });
    }, 1000);
  };

  // Host effect to catch timeout in CHOOSING_WORD
  useEffect(() => {
    if (!isHost) return;
    if (gameState.phase === 'CHOOSING_WORD' && gameState.timeLeft <= 0) {
      startRound(gameState.wordChoices[0]);
    }
    if (gameState.phase === 'DRAWING' && gameState.timeLeft <= 0) {
      endRound(gameState);
    }
  }, [gameState.timeLeft, gameState.phase, isHost]);

  const startRound = (word: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const newState: GameState = {
      ...gameState,
      phase: 'DRAWING',
      currentWord: word,
      currentWordHint: `${word.length} 个字`,
      timeLeft: ROUND_TIME,
      chatHistory: [...gameState.chatHistory, {
        id: uuidv4(),
        type: 'SYSTEM',
        text: `画家正在作画! 提示: ${word.length} 个字`,
        playerId: 'SYS',
        playerName: 'System',
        timestamp: Date.now()
      }]
    };
    setGameState(newState);
    sendMessage({ type: 'UPDATE_STATE', payload: newState });

    timerRef.current = setInterval(() => {
      setGameState(prev => {
        const t = prev.timeLeft - 1;
        sendMessage({ type: 'UPDATE_STATE', payload: { ...prev, timeLeft: t } });
        return { ...prev, timeLeft: t };
      });
    }, 1000);
  };

  const endRound = (currentState: GameState) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const isGameOver = currentState.round >= MAX_ROUNDS; 

    const newState: GameState = {
      ...currentState,
      phase: isGameOver ? 'GAME_END' : 'ROUND_END',
      timeLeft: 5,
      currentWordHint: `答案是: ${currentState.currentWord}`,
      drawingData: [], // Clear canvas
      winnerId: isGameOver ? [...currentState.players].sort((a,b) => b.score - a.score)[0].id : null
    };

    setGameState(newState);
    sendMessage({ type: 'UPDATE_STATE', payload: newState });

    setTimeout(() => {
      if (isGameOver) {
        // Stay on Game End
      } else {
        nextTurn(newState.players, newState.round + 1);
      }
    }, 5000);
  };
  
  const resetGame = () => {
    startGameHost();
  };

  // --- INITIALIZATION ---

  useEffect(() => {
    // Set a default random avatar
    setMyAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const createRoom = () => {
    if (!myName.trim()) {
      setErrorMsg("请输入昵称");
      return;
    }
    
    // Destroy previous instance if exists to prevent 'unavailable id'
    if (peerRef.current) {
        peerRef.current.destroy();
    }
    
    setErrorMsg('');
    setConnectionStatus('CONNECTING');
    
    // Let PeerJS assign a random ID. Do not pass myId.
    const peer = new Peer(); 
    
    peer.on('open', (id) => {
      setConnectionStatus('CONNECTED');
      setMyId(id); // Capture the assigned ID
      
      // Initialize Host State with the assigned ID
      setGameState({
        ...INITIAL_STATE,
        roomId: id,
        players: [{
          id: id,
          name: myName,
          avatar: myAvatar,
          score: 0,
          isHost: true,
          hasGuessedCorrectly: false,
          isConnected: true
        }]
      });
    });

    peer.on('connection', (conn) => {
      conn.on('data', (data) => handleData(data, conn.peer));
      conn.on('open', () => {
        connectionsRef.current.set(conn.peer, conn);
        // Important: Use function update to get latest state inside callback
        setGameState(current => {
           conn.send({ type: 'UPDATE_STATE', payload: current });
           return current;
        });
      });
      conn.on('close', () => {
        connectionsRef.current.delete(conn.peer);
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === conn.peer ? { ...p, isConnected: false } : p)
        }));
      });
    });
    
    peerRef.current = peer;
  };

  const joinRoom = () => {
     if (!myName.trim() || !inputRoomId.trim()) {
      setErrorMsg("请输入昵称和房间号");
      return;
    }
    
    if (peerRef.current) {
        peerRef.current.destroy();
    }

    setErrorMsg('');
    setConnectionStatus('CONNECTING');

    // Let PeerJS assign a random ID
    const peer = new Peer();
    
    peer.on('open', (id) => {
      setMyId(id); // Capture assigned ID
      
      const conn = peer.connect(inputRoomId);
      
      conn.on('open', () => {
        setConnectionStatus('CONNECTED');
        connectionsRef.current.set(inputRoomId, conn);
        
        // Send Join Request with my new assigned ID
        conn.send({
          type: 'JOIN',
          payload: { id: id, name: myName, avatar: myAvatar }
        });
      });

      conn.on('data', (data) => handleData(data, inputRoomId));
      
      conn.on('close', () => {
        setConnectionStatus('DISCONNECTED');
        setErrorMsg("Host disconnected");
      });
      
      conn.on('error', (err) => {
         console.error(err);
         setErrorMsg("Connection error");
         setConnectionStatus('DISCONNECTED');
      });
    });
    
    peer.on('error', (err) => {
      setErrorMsg("Peer Error: " + err.type);
      setConnectionStatus('DISCONNECTED');
    });

    peerRef.current = peer;
  };

  // --- UI HANDLERS ---
  const handleDraw = (path: DrawPath) => {
    // Optimistic Update
    setGameState(prev => ({
      ...prev,
      drawingData: [...prev.drawingData, path]
    }));
    
    // Send to Host (if I am client)
    if (!isHost) {
      sendMessage({ type: 'DRAW_ACTION', payload: path }, connectionsRef.current.get(gameState.roomId));
    } else {
       // If I am host, I already updated state, now broadcast
       sendMessage({ type: 'DRAW_ACTION', payload: path });
    }
  };
  
  const handleClear = () => {
     if (!isHost && !isDrawer) return;
     if (isHost) {
        setGameState(prev => ({...prev, drawingData: []}));
        sendMessage({ type: 'CLEAR_CANVAS', payload: null });
     } else {
        sendMessage({ type: 'CLEAR_CANVAS', payload: null }, connectionsRef.current.get(gameState.roomId));
     }
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    if (isHost) {
      processChatMessage(chatInput, myId);
    } else {
      sendMessage({ type: 'CHAT_MESSAGE', payload: chatInput }, connectionsRef.current.get(gameState.roomId));
    }
    setChatInput('');
  };

  const copyRoomId = () => {
     navigator.clipboard.writeText(gameState.roomId);
     alert("房间号已复制!");
  };

  // --- RENDER ---

  if (connectionStatus === 'DISCONNECTED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
           <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
             你画我猜
           </h1>
           
           <div className="space-y-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">选择头像</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                   {AVATARS.map(a => (
                     <button 
                       key={a} 
                       onClick={() => setMyAvatar(a)}
                       className={`text-2xl p-2 rounded-lg transition-all ${myAvatar === a ? 'bg-blue-600 scale-110' : 'bg-slate-700 hover:bg-slate-600'}`}
                     >
                       {a}
                     </button>
                   ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">昵称</label>
                <input 
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="请输入你的名字"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                <button 
                  onClick={createRoom}
                  className="flex flex-col items-center justify-center p-4 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg active:scale-95"
                >
                   <Crown className="mb-2" />
                   <span className="font-bold">创建房间</span>
                </button>
                <button 
                   onClick={() => document.getElementById('join-inputs')?.classList.toggle('hidden')}
                   className="flex flex-col items-center justify-center p-4 bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-lg active:scale-95"
                >
                   <Users className="mb-2" />
                   <span className="font-bold">加入房间</span>
                </button>
              </div>

              <div id="join-inputs" className="hidden space-y-4 pt-4 animate-in fade-in slide-in-from-top-4">
                 <input 
                   value={inputRoomId}
                   onChange={e => setInputRoomId(e.target.value)}
                   className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono"
                   placeholder="输入房间 ID"
                 />
                 <button 
                   onClick={joinRoom}
                   className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold shadow-lg"
                 >
                   进入游戏
                 </button>
              </div>

              {errorMsg && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg flex items-center gap-2">
                   <AlertCircle size={16} /> {errorMsg}
                </div>
              )}
           </div>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'CONNECTING') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
         <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xl">连接中...</p>
         </div>
      </div>
    );
  }

  // --- GAME LOBBY & PLAY ---
  
  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-slate-100">
      
      {/* LEFT: PLAYERS */}
      <div className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
         <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
               <Users size={18}/> 玩家列表 ({gameState.players.length})
            </h2>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 cursor-pointer hover:text-blue-500" onClick={copyRoomId}>
               ID: {gameState.roomId.slice(0,8)}... <Copy size={10}/>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {gameState.players.map(p => (
              <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg ${p.hasGuessedCorrectly ? 'bg-green-50 border border-green-200' : 'bg-white border border-slate-100'} shadow-sm`}>
                 <div className="text-2xl">{p.avatar}</div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                       <span className="font-bold text-slate-800 truncate">{p.name}</span>
                       {p.isHost && <Crown size={12} className="text-yellow-500 fill-yellow-500"/>}
                    </div>
                    <div className="text-xs text-slate-500">得分: {p.score}</div>
                 </div>
                 {p.id === gameState.currentDrawerId && <div className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">画画中</div>}
                 {p.hasGuessedCorrectly && <CheckCircle2 size={16} className="text-green-500"/>}
              </div>
            ))}
         </div>
         {isHost && gameState.phase === 'LOBBY' && (
           <div className="p-4 border-t border-slate-200">
              <button 
                onClick={startGameHost}
                disabled={gameState.players.length < 2}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
              >
                开始游戏
              </button>
           </div>
         )}
      </div>

      {/* CENTER: GAME AREA */}
      <div className="flex-1 flex flex-col bg-slate-100 relative">
         {/* HEADER */}
         <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
            <div className="flex items-center gap-4">
               <div className="flex flex-col">
                  <span className="text-xs text-slate-400">回合</span>
                  <span className="font-bold text-slate-700">{gameState.round} / {MAX_ROUNDS}</span>
               </div>
               <div className="w-px h-8 bg-slate-200"></div>
               <div className="flex items-center gap-2">
                  <Timer size={20} className={gameState.timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-400'}/>
                  <span className={`text-2xl font-black ${gameState.timeLeft < 10 ? 'text-red-500' : 'text-slate-700'}`}>{gameState.timeLeft}s</span>
               </div>
            </div>
            
            <div className="text-xl font-bold text-slate-800">
               {gameState.phase === 'LOBBY' && "等待开始..."}
               {gameState.phase === 'CHOOSING_WORD' && (isDrawer ? "请选择题目" : "画家正在选题...")}
               {gameState.phase === 'DRAWING' && (isDrawer ? `题目: ${gameState.currentWord}` : `提示: ${gameState.currentWordHint}`)}
               {gameState.phase === 'ROUND_END' && `本轮结束! 答案: ${gameState.currentWord}`}
               {gameState.phase === 'GAME_END' && "游戏结束!"}
            </div>

            <div>
               {/* Spacer or Settings */}
               {isHost && gameState.phase !== 'LOBBY' && (
                 <button onClick={() => sendMessage({ type: 'RESTART', payload: null })} className="text-xs text-red-500 hover:underline">重置游戏</button>
               )}
            </div>
         </div>

         {/* CANVAS CONTAINER */}
         <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
            
            {gameState.phase === 'LOBBY' ? (
               <div className="text-center text-slate-400">
                  <div className="text-6xl mb-4">🎨</div>
                  <h3 className="text-2xl font-bold mb-2">等待玩家加入...</h3>
                  <p>邀请好友输入房间号加入游戏</p>
                  <div className="mt-8 p-4 bg-white rounded-xl border border-dashed border-slate-300 inline-block cursor-pointer hover:border-blue-500" onClick={copyRoomId}>
                     <div className="text-xs text-slate-400 mb-1">房间 ID (点击复制)</div>
                     <div className="font-mono text-xl font-bold text-blue-600">{gameState.roomId}</div>
                  </div>
               </div>
            ) : gameState.phase === 'GAME_END' ? (
               <div className="text-center animate-in zoom-in duration-500">
                  <div className="text-8xl mb-4">🏆</div>
                  <h2 className="text-4xl font-black text-slate-800 mb-2">获胜者</h2>
                  <div className="text-2xl font-bold text-blue-600 mb-8">
                     {gameState.players.find(p => p.id === gameState.winnerId)?.name}
                  </div>
                  {isHost && (
                     <button onClick={resetGame} className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold shadow-xl hover:bg-blue-500">
                        再来一局
                     </button>
                  )}
               </div>
            ) : gameState.phase === 'CHOOSING_WORD' && isDrawer ? (
               <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
                  {gameState.wordChoices.map(word => (
                     <button
                       key={word}
                       onClick={() => {
                          if (isHost) startRound(word);
                          else sendMessage({ type: 'CHOOSE_WORD', payload: word }, connectionsRef.current.get(gameState.roomId));
                       }}
                       className="h-32 bg-white rounded-2xl shadow-lg border-2 border-slate-200 hover:border-blue-500 hover:scale-105 transition-all flex items-center justify-center text-2xl font-bold text-slate-700"
                     >
                        {word}
                     </button>
                  ))}
               </div>
            ) : (
               <GameCanvas 
                  paths={gameState.drawingData}
                  isDrawer={isDrawer && gameState.phase === 'DRAWING'}
                  onDraw={handleDraw}
                  onClear={handleClear}
               />
            )}
         </div>
      </div>

      {/* RIGHT: CHAT */}
      <div className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 h-64 md:h-auto">
         <div className="p-3 border-b border-slate-100 font-bold text-slate-700 bg-slate-50">
            聊天 / 猜词
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {gameState.chatHistory.map(msg => (
               <div key={msg.id} className={`flex flex-col ${msg.type === 'SYSTEM' ? 'items-center' : 'items-start'}`}>
                  {msg.type === 'SYSTEM' ? (
                     <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{msg.text}</span>
                  ) : msg.type === 'GUESS_CORRECT' ? (
                     <div className="w-full bg-green-100 text-green-700 p-2 rounded-lg text-sm text-center font-bold">
                        🎉 {msg.playerName} 猜对了!
                     </div>
                  ) : (
                     <div className="w-full">
                        <span className="text-xs text-slate-400 mr-2">{msg.playerName}</span>
                        <div className={`inline-block px-3 py-2 rounded-lg text-sm ${msg.playerId === myId ? 'bg-blue-100 text-blue-900' : 'bg-white border border-slate-200 text-slate-800'}`}>
                           {msg.text}
                        </div>
                     </div>
                  )}
               </div>
            ))}
         </div>
         <form onSubmit={handleChat} className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <input
               value={chatInput}
               onChange={e => setChatInput(e.target.value)}
               placeholder={gameState.phase === 'DRAWING' && !isDrawer ? "输入你的猜测..." : "聊天..."}
               className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
               disabled={gameState.phase !== 'DRAWING' && gameState.phase !== 'LOBBY' && gameState.phase !== 'ROUND_END'}
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors disabled:bg-slate-300"
            >
               <Send size={18} />
            </button>
         </form>
      </div>

    </div>
  );
}
