import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

// Enums and Types
type Role = 'NONE' | 'HOST' | 'PLAYER';

interface QuizMetadata {
  id: string;
  title: string;
  description: string;
  questionsCount: string;
}

interface Question {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'DEBUGGING';
  options: string[];
  correctOptionIndices: number[];
  timerSeconds: number;
  doublePoints: boolean;
  codeSnippet?: string;
}

interface PlayerData {
  sessionId: string;
  nickname: string;
  score: number;
  streak: number;
  scoreChange: number;
  lastAnswerCorrect: boolean;
}

export default function App() {
  const [role, setRole] = useState<Role>('NONE');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Host specific states
  const [quizzes, setQuizzes] = useState<QuizMetadata[]>([]);
  const [gamePin, setGamePin] = useState<string>('');
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [quizDescription, setQuizDescription] = useState<string>('');
  const [lobbyPlayers, setLobbyPlayers] = useState<PlayerData[]>([]);
  const [hostGameState, setHostGameState] = useState<'LOBBY' | 'PREVIEW' | 'ACTIVE' | 'RESULTS' | 'LEADERBOARD' | 'PODIUM'>('LOBBY');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [activeTimer, setActiveTimer] = useState<number>(0);
  const [answersCount, setAnswersCount] = useState<number>(0);
  const [answerStats, setAnswerStats] = useState<Record<number, number>>({});
  const [correctOptionIndices, setCorrectOptionIndices] = useState<number[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerData[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Player specific states
  const [playerPinInput, setPlayerPinInput] = useState<string>('');
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [playerNickname, setPlayerNickname] = useState<string>('');
  const [playerGameState, setPlayerGameState] = useState<'JOIN' | 'LOBBY' | 'PREVIEW' | 'ACTIVE' | 'ANSWERED' | 'RESULT' | 'RANK' | 'GAMEOVER'>('JOIN');
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [playerScoreChange, setPlayerScoreChange] = useState<number>(0);
  const [playerIsCorrect, setPlayerIsCorrect] = useState<boolean>(false);
  const [playerPlace, setPlayerPlace] = useState<number>(1);

  // Host login & Auth states
  const [isHostLoggedIn, setIsHostLoggedIn] = useState<boolean>(false);
  const [showHostLogin, setShowHostLogin] = useState<boolean>(false);
  const [hostUsernameInput, setHostUsernameInput] = useState<string>('');
  const [hostPasswordInput, setHostPasswordInput] = useState<string>('');

  // Ref to hold WebSocket connection to prevent closure capturing issues
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-fill PIN and check host login from localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('pin');
    if (pin) {
      setPlayerPinInput(pin);
      setRole('PLAYER');
    }
    const loggedIn = localStorage.getItem('isHostLoggedIn') === 'true';
    if (loggedIn) {
      setIsHostLoggedIn(true);
    }
  }, []);

  // Connect to backend WebSocket
  const connectWebSocket = (onOpenCallback: (socket: WebSocket) => void) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      onOpenCallback(wsRef.current);
      return;
    }

    setConnectionStatus('CONNECTING');
    // Dynamically resolve WebSocket URL
    const envWsUrl = import.meta.env.VITE_WS_URL;
    let socket: WebSocket;
    if (envWsUrl) {
      socket = new WebSocket(envWsUrl);
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      // During local dev, if Vite runs on 5173, connect to backend on 8080.
      const wsHost = loc.port === '5173' ? `${loc.hostname}:8080` : loc.host;
      socket = new WebSocket(`${protocol}//${wsHost}/ws`);
    }

    socket.onopen = () => {
      setConnectionStatus('CONNECTED');
      setWs(socket);
      wsRef.current = socket;
      onOpenCallback(socket);
    };

    socket.onmessage = (event) => {
      handleSocketMessage(JSON.parse(event.data));
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      setErrorMsg('Failed to connect to the game server.');
      setConnectionStatus('DISCONNECTED');
    };

    socket.onclose = () => {
      setConnectionStatus('DISCONNECTED');
      setWs(null);
      wsRef.current = null;
    };
  };

  // Keyboard shortcut listener for host controls (Space & Right Arrow)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (role !== 'HOST') return;
      if (e.code === 'Space' || e.code === 'ArrowRight') {
        // Prevent default spacebar scrolling
        e.preventDefault();
        triggerHostNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [role, hostGameState, gamePin]);

  // Handle incoming WS messages
  const handleSocketMessage = (msg: any) => {
    switch (msg.type) {
      case 'QUIZZES_LIST':
        setQuizzes(msg.quizzes);
        break;
      case 'GAME_CREATED':
        setGamePin(msg.gamePin);
        setQuizTitle(msg.quizTitle);
        setQuizDescription(msg.quizDescription);
        setHostGameState('LOBBY');
        // Generate QR code URL
        const joinUrl = `${window.location.protocol}//${window.location.host}/?pin=${msg.gamePin}`;
        QRCode.toDataURL(joinUrl, { width: 250, margin: 2 })
          .then(url => setQrCodeUrl(url))
          .catch(err => console.error('Error generating QR code', err));
        break;
      case 'JOIN_SUCCESS':
        setGamePin(msg.gamePin);
        setPlayerNickname(msg.nickname);
        setPlayerGameState('LOBBY');
        break;
      case 'PLAYER_LIST_UPDATE':
        setLobbyPlayers(msg.players);
        break;
      case 'ANSWER_COUNT_UPDATE':
        setAnswersCount(msg.timer); // backend uses timer field to send counts
        break;
      case 'QUESTION_PREVIEW':
        setCurrentQuestion(msg.question);
        setCurrentQuestionIndex(msg.questionIndex);
        setCorrectOptionIndices([]);
        setAnswersCount(0);
        setSelectedOptions([]);
        
        if (role === 'HOST') {
          setHostGameState('PREVIEW');
          // Host automatically transitions preview -> active after 4 seconds to build hype
          setTimeout(() => {
            triggerHostNext();
          }, 4000);
        } else if (role === 'PLAYER') {
          setPlayerGameState('PREVIEW');
        }
        break;
      case 'QUESTION_ACTIVE':
        if (role === 'HOST') {
          setHostGameState('ACTIVE');
        } else if (role === 'PLAYER') {
          setPlayerGameState('ACTIVE');
        }
        setActiveTimer(msg.timer);
        break;
      case 'TIMER_TICK':
        setActiveTimer(msg.timer);
        break;
      case 'ANSWER_RECEIVED':
        // Player's answer has been recorded successfully
        setPlayerGameState('ANSWERED');
        break;
      case 'QUESTION_RESULTS':
        // Host view: show answer statistics and correct options
        setAnswerStats(msg.stats || {});
        setCorrectOptionIndices(msg.correctOptionIndices || []);
        setHostGameState('RESULTS');
        break;
      case 'PLAYER_RESULT':
        // Player view: show correct/incorrect stats
        setPlayerIsCorrect(msg.isCorrect);
        setPlayerScoreChange(msg.scoreChange);
        setPlayerScore(msg.score);
        setCorrectOptionIndices(msg.correctOptionIndices || []);
        setPlayerGameState('RESULT');
        break;
      case 'LEADERBOARD_UPDATE':
        setLeaderboard(msg.leaderboard || []);
        if (role === 'HOST') {
          setHostGameState('LEADERBOARD');
        }
        break;
      case 'PLAYER_RANK':
        setPlayerPlace(msg.place);
        setPlayerScore(msg.score);
        setPlayerGameState('RANK');
        break;
      case 'PODIUM_UPDATE':
        setLeaderboard(msg.leaderboard || []);
        if (role === 'HOST') {
          setHostGameState('PODIUM');
        } else if (role === 'PLAYER') {
          setPlayerGameState('GAMEOVER');
        }
        break;
      case 'GAME_TERMINATED':
        setErrorMsg('The host has closed this game.');
        resetToHome();
        break;
      case 'ERROR':
        setErrorMsg(msg.quizTitle || 'An error occurred.'); // error description is in quizTitle
        break;
      default:
        console.warn('Unhandled message type:', msg.type);
    }
  };

  // Actions
  const handleHostSelect = () => {
    const loggedIn = localStorage.getItem('isHostLoggedIn') === 'true' || isHostLoggedIn;
    if (loggedIn) {
      setRole('HOST');
      connectWebSocket((socket) => {
        socket.send(JSON.stringify({ type: 'GET_QUIZZES' }));
      });
    } else {
      setShowHostLogin(true);
    }
  };

  const handleHostLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (hostUsernameInput.trim() === 'admin' && hostPasswordInput === 'admin123') {
      localStorage.setItem('isHostLoggedIn', 'true');
      setIsHostLoggedIn(true);
      setShowHostLogin(false);
      setRole('HOST');
      connectWebSocket((socket) => {
        socket.send(JSON.stringify({ type: 'GET_QUIZZES' }));
      });
    } else {
      setErrorMsg('Invalid host credentials. Hint: use admin / admin123');
    }
  };

  const handleHostLogout = () => {
    localStorage.removeItem('isHostLoggedIn');
    setIsHostLoggedIn(false);
    setShowHostLogin(false);
    resetToHome();
  };

  const createGame = (quizId: string) => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'HOST_CREATE', gamePin: quizId })); // pass quizId in gamePin field
    }
  };

  const triggerHostStart = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'HOST_START_GAME' }));
    }
  };

  const triggerHostNext = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'HOST_NEXT' }));
    }
  };

  const handlePlayerJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerPinInput || !nicknameInput) {
      setErrorMsg('Game PIN and Nickname are required.');
      return;
    }
    setErrorMsg('');
    connectWebSocket((socket) => {
      socket.send(JSON.stringify({
        type: 'PLAYER_JOIN',
        gamePin: playerPinInput,
        nickname: nicknameInput.trim()
      }));
    });
  };

  // Select / Deselect / Change answer option
  const togglePlayerOption = (optionIndex: number) => {
    if (playerGameState !== 'ACTIVE' && playerGameState !== 'ANSWERED') return;

    let updatedSelection: number[];
    
    // In our system, if it's multiple choice we can allow multi-select,
    // but default for standard is single select. Let's make it single-select by default, 
    // but the player can click again to deselect, or click another to change.
    if (selectedOptions.includes(optionIndex)) {
      // Deselect
      updatedSelection = selectedOptions.filter(idx => idx !== optionIndex);
    } else {
      // Select (replaces existing if single select)
      updatedSelection = [optionIndex];
    }
    
    setSelectedOptions(updatedSelection);

    // Send updated selection to backend immediately to update stats
    if (ws) {
      ws.send(JSON.stringify({
        type: 'PLAYER_ANSWER',
        answerIndices: updatedSelection
      }));
    }
  };

  const resetToHome = () => {
    if (ws) {
      ws.close();
    }
    setRole('NONE');
    setGamePin('');
    setLobbyPlayers([]);
    setHostGameState('LOBBY');
    setCurrentQuestion(null);
    setLeaderboard([]);
    setPlayerGameState('JOIN');
    setSelectedOptions([]);
  };

  // Emojis mapping for Kahoot-like button options
  const optionShapes = [
    { shape: '▲', colorClass: 'opt-red' },
    { shape: '◆', colorClass: 'opt-blue' },
    { shape: '●', colorClass: 'opt-yellow' },
    { shape: '■', colorClass: 'opt-green' }
  ];

  // SUB-RENDERERS

  // --- Host Login Screen ---
  if (showHostLogin) {
    return (
      <div className="app-container">
        <form className="glass-card" style={{ maxWidth: '400px' }} onSubmit={handleHostLoginSubmit}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Host Login</h1>
          <p style={{ color: '#a29bfe', marginBottom: '2rem', fontSize: '0.9rem', fontWeight: 500 }}>
            Enter organizer credentials to host quizzes
          </p>
          
          {errorMsg && <p style={{ color: varColorRed(), margin: '1rem 0', fontWeight: 600 }}>{errorMsg}</p>}
          
          <input 
            type="text" 
            className="input-field" 
            placeholder="Username (admin)" 
            value={hostUsernameInput}
            onChange={(e) => setHostUsernameInput(e.target.value)}
            required
          />
          
          <input 
            type="password" 
            className="input-field" 
            placeholder="Password (admin123)" 
            value={hostPasswordInput}
            onChange={(e) => setHostPasswordInput(e.target.value)}
            required
          />

          <button type="submit" className="btn">
            Login
          </button>

          <button 
            type="button" 
            className="btn margin-top-md" 
            style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'none' }} 
            onClick={() => {
              setShowHostLogin(false);
              setErrorMsg('');
            }}
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  // --- Home Screen ---
  if (role === 'NONE') {
    return (
      <div className="app-container">
        <div className="glass-card" style={{ maxWidth: '480px' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>OpenQuiz</h1>
          <p style={{ color: '#a29bfe', marginBottom: '2.5rem', fontWeight: 500 }}>
            Real-time interactive quiz platform for tech events
          </p>

          <button 
            className="btn" 
            style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', boxShadow: '0 4px 15px rgba(56, 239, 125, 0.3)' }}
            onClick={() => setRole('PLAYER')}
          >
            Enter Game PIN
          </button>
          
          <button 
            className="btn" 
            onClick={handleHostSelect}
          >
            Host a Session
          </button>
        </div>
      </div>
    );
  }

  // --- Host Role Views ---
  if (role === 'HOST') {
    // 0. Loading Quizzes Select screen
    if (!gamePin) {
      return (
        <div className="app-container">
          <div className="glass-card" style={{ maxWidth: '650px' }}>
            <h2>Select Quiz to Host</h2>
            {connectionStatus === 'CONNECTING' && <p>Connecting to server...</p>}
            {errorMsg && <p style={{ color: varColorRed(), margin: '1rem 0' }}>{errorMsg}</p>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left', marginTop: '1.5rem' }}>
              {quizzes.map(quiz => (
                <div 
                  key={quiz.id} 
                  className="glass-card" 
                  style={{ padding: '1.5rem', cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)' }}
                  onClick={() => createGame(quiz.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: '#fff', fontSize: '1.25rem' }}>{quiz.title}</h3>
                    <span style={{ background: '#a29bfe', color: '#000', fontSize: '0.8rem', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                      {quiz.questionsCount} Qs
                    </span>
                  </div>
                  <p style={{ color: '#a29bfe', fontSize: '0.9rem', marginTop: '5px' }}>{quiz.description}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'none' }} onClick={resetToHome}>
                Back to Home
              </button>
              <button className="btn" style={{ background: 'rgba(255,100,100,0.15)', color: '#ff4d4d', boxShadow: 'none' }} onClick={handleHostLogout}>
                Logout Host
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 1. Host Lobby View
    if (hostGameState === 'LOBBY') {
      return (
        <div className="app-container">
          <div className="presenter-layout">
            <div className="lobby-header">
              <div>
                <h1 style={{ fontSize: '2.5rem' }}>{quizTitle}</h1>
                <p style={{ color: '#a29bfe', fontWeight: 500 }}>{quizDescription}</p>
              </div>
              <div className="pin-display">
                <div className="pin-label">Join at link or scan QR</div>
                <div className="pin-code">{gamePin}</div>
              </div>
            </div>

            <div className="lobby-main">
              <div className="join-info-card">
                {qrCodeUrl ? (
                  <div className="qr-container">
                    <img src={qrCodeUrl} alt="QR Code to Join" />
                  </div>
                ) : (
                  <p>Generating QR Code...</p>
                )}
                <p style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'center' }}>
                  Scan code to join instantly!
                </p>
              </div>

              <div className="players-grid">
                {lobbyPlayers.length === 0 ? (
                  <div style={{ margin: 'auto', color: '#a29bfe', fontSize: '1.2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👋</p>
                    Waiting for players to join...
                  </div>
                ) : (
                  lobbyPlayers.map((player) => (
                    <div key={player.sessionId} className="player-tag">
                      {player.nickname}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lobby-footer">
              <div className="player-count-badge">
                {lobbyPlayers.length} {lobbyPlayers.length === 1 ? 'Player' : 'Players'}
              </div>
              
              <button 
                className="btn" 
                style={{ width: 'auto', minWidth: '200px' }}
                onClick={triggerHostStart}
                disabled={lobbyPlayers.length === 0}
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. Host Preview View (e.g. "Question 1 incoming...")
    if (hostGameState === 'PREVIEW') {
      return (
        <div className="app-container">
          <div className="glass-card" style={{ maxWidth: '700px' }}>
            <span className="double-points-badge" style={{ animation: 'none' }}>
              Question {currentQuestionIndex} of {quizzes.find(q => q.title === quizTitle)?.questionsCount || 4}
            </span>
            <h1 style={{ fontSize: '2.5rem', margin: '1.5rem 0 2.5rem 0', color: 'white' }}>
              {currentQuestion?.text}
            </h1>
            {currentQuestion?.doublePoints && (
              <div className="double-points-badge">Double Points Enabled!</div>
            )}
            <p style={{ color: '#a29bfe', fontSize: '1.2rem', fontWeight: 600, marginTop: '2rem' }}>
              Starting in a few seconds...
            </p>
          </div>
        </div>
      );
    }

    // 3. Host Active Question View
    if (hostGameState === 'ACTIVE') {
      return (
        <div className="app-container">
          <div className="presenter-layout">
            <div className="question-presenter-card">
              {currentQuestion?.doublePoints && (
                <div className="double-points-badge">2X Points</div>
              )}
              <div className="question-title">{currentQuestion?.text}</div>
              
              {currentQuestion?.codeSnippet && (
                <div className="code-block-container">
                  <pre><code>{currentQuestion.codeSnippet}</code></pre>
                </div>
              )}

              <div className="question-stats-row">
                <div className={`timer-circle ${activeTimer <= 5 ? 'timer-warning' : ''}`}>
                  {activeTimer}
                </div>
                
                <div className="answers-counter">
                  <div className="answers-count-num">{answersCount}</div>
                  <div className="answers-count-lbl">Answers</div>
                </div>
              </div>
            </div>

            <div className="options-grid">
              {currentQuestion?.options.map((opt, index) => (
                <div key={index} className={`option-presenter-box ${optionShapes[index].colorClass}`}>
                  <div className="option-icon">{optionShapes[index].shape}</div>
                  {opt}
                </div>
              ))}
            </div>

            <div className="lobby-footer" style={{ marginTop: '2rem' }}>
              <span style={{ color: '#a29bfe' }}>Press <strong>Space</strong> or <strong>Right Arrow</strong> to skip timer</span>
              <button className="btn" style={{ width: 'auto' }} onClick={triggerHostNext}>
                Skip Timer
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 4. Host Show Answer / Results Chart View
    if (hostGameState === 'RESULTS') {
      // Find maximum score count to scale chart correctly
      const statsValues = Object.values(answerStats);
      const maxAnswers = statsValues.length > 0 ? Math.max(...statsValues, 1) : 1;

      return (
        <div className="app-container">
          <div className="presenter-layout">
            <div className="question-presenter-card" style={{ paddingBottom: '1rem' }}>
              <div className="question-title" style={{ marginBottom: '1rem' }}>{currentQuestion?.text}</div>
              
              <div className="chart-container">
                {currentQuestion?.options.map((_, index) => {
                  const count = answerStats[index] || 0;
                  const percent = (count / maxAnswers) * 80; // max height is 80%
                  const isCorrect = correctOptionIndices.includes(index);

                  return (
                    <div key={index} className="chart-column-wrapper">
                      <div 
                        className={`chart-bar ${optionShapes[index].colorClass}`} 
                        style={{ 
                          height: `${Math.max(10, percent)}%`,
                          border: isCorrect ? '3px solid white' : 'none',
                          boxShadow: isCorrect ? '0 0 15px rgba(255,255,255,0.4)' : 'none'
                        }}
                      >
                        {count}
                      </div>
                      <div className="chart-label-icon" style={{ color: isCorrect ? '#23d160' : 'inherit' }}>
                        {optionShapes[index].shape}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="options-grid">
              {currentQuestion?.options.map((opt, index) => {
                const isCorrect = correctOptionIndices.includes(index);
                return (
                  <div 
                    key={index} 
                    className={`option-presenter-box ${optionShapes[index].colorClass} ${!isCorrect ? 'dimmed' : 'correct-choice'}`}
                  >
                    <div className="option-icon">{optionShapes[index].shape}</div>
                    {opt}
                    {isCorrect && (
                      <span className="correct-badge-indicator">✓ Correct</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="lobby-footer">
              <span>Press <strong>Space</strong> or <strong>Right Arrow</strong> for leaderboard</span>
              <button className="btn" style={{ width: 'auto' }} onClick={triggerHostNext}>
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 5. Host Leaderboard View
    if (hostGameState === 'LEADERBOARD') {
      return (
        <div className="app-container">
          <div className="presenter-layout" style={{ maxWidth: '800px' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '3rem' }}>Leaderboard</h1>
              <p style={{ color: '#a29bfe' }}>Rankings after Question {currentQuestionIndex}</p>
            </div>

            <div className="leaderboard-list">
              {leaderboard.map((player, index) => (
                <div key={player.sessionId} className="leaderboard-row">
                  <div className="leaderboard-left">
                    <span className="leaderboard-rank">#{index + 1}</span>
                    <span className="leaderboard-name">{player.nickname}</span>
                    {player.streak > 1 && (
                      <span className="leaderboard-streak">🔥 {player.streak} Streak</span>
                    )}
                  </div>
                  <span className="leaderboard-score">{player.score} pts</span>
                </div>
              ))}
            </div>

            <div className="lobby-footer">
              <span>Press <strong>Space</strong> or <strong>Right Arrow</strong> to advance</span>
              <button className="btn" style={{ width: 'auto' }} onClick={triggerHostNext}>
                Next Question
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 6. Host Final Podium View
    if (hostGameState === 'PODIUM') {
      const gold = leaderboard[0];
      const silver = leaderboard[1];
      const bronze = leaderboard[2];

      return (
        <div className="app-container">
          <div className="presenter-layout" style={{ maxWidth: '900px', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h1 style={{ fontSize: '4rem', marginBottom: '10px' }}>👑 Podium 👑</h1>
              <p style={{ color: '#a29bfe', fontSize: '1.2rem' }}>Congratulations to the winners!</p>
            </div>

            <div className="podium-container">
              {/* Silver (2nd) */}
              {silver && (
                <div className="podium-place silver">
                  <div className="podium-player-name">{silver.nickname}</div>
                  <div className="podium-player-score">{silver.score} pts</div>
                  <div className="podium-pedestal">
                    <span className="podium-rank-num">2</span>
                  </div>
                </div>
              )}

              {/* Gold (1st) */}
              {gold && (
                <div className="podium-place gold">
                  <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🥇</div>
                  <div className="podium-player-name">{gold.nickname}</div>
                  <div className="podium-player-score">{gold.score} pts</div>
                  <div className="podium-pedestal">
                    <span className="podium-rank-num">1</span>
                  </div>
                </div>
              )}

              {/* Bronze (3rd) */}
              {bronze && (
                <div className="podium-place bronze">
                  <div className="podium-player-name">{bronze.nickname}</div>
                  <div className="podium-player-score">{bronze.score} pts</div>
                  <div className="podium-pedestal">
                    <span className="podium-rank-num">3</span>
                  </div>
                </div>
              )}
            </div>

            <button className="btn margin-top-md" style={{ maxWidth: '300px', margin: '2rem auto 0 auto' }} onClick={resetToHome}>
              Exit Session
            </button>
          </div>
        </div>
      );
    }
  }

  // --- Player Role Views ---
  if (role === 'PLAYER') {
    // 1. Join Game Screen
    if (playerGameState === 'JOIN') {
      return (
        <div className="app-container">
          <form className="glass-card" style={{ maxWidth: '400px' }} onSubmit={handlePlayerJoinSubmit}>
            <h1>Join Quiz</h1>
            {errorMsg && <p style={{ color: varColorRed(), margin: '1rem 0', fontWeight: 600 }}>{errorMsg}</p>}
            
            <input 
              type="text" 
              className="input-field" 
              placeholder="Game PIN" 
              value={playerPinInput}
              onChange={(e) => setPlayerPinInput(e.target.value.replace(/\D/g, '').substring(0, 6))}
              disabled={connectionStatus === 'CONNECTING'}
            />
            
            <input 
              type="text" 
              className="input-field" 
              placeholder="Nickname" 
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value.substring(0, 15))}
              disabled={connectionStatus === 'CONNECTING'}
            />

            <button 
              type="submit" 
              className="btn" 
              disabled={connectionStatus === 'CONNECTING'}
            >
              {connectionStatus === 'CONNECTING' ? 'Joining...' : 'Enter'}
            </button>

            <button type="button" className="btn margin-top-md" style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'none' }} onClick={resetToHome}>
              Cancel
            </button>
          </form>
        </div>
      );
    }

    // 2. Player Lobby View (Joined, waiting for start)
    if (playerGameState === 'LOBBY') {
      return (
        <div className="app-container">
          <div className="glass-card" style={{ maxWidth: '400px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>👍</div>
            <h2>You are in!</h2>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '1.5rem' }}>
              {playerNickname}
            </p>
            <p style={{ color: '#a29bfe' }}>
              Watch the presenter screen. The quiz will start shortly...
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '2rem' }}>
              <div className="player-count-badge" style={{ fontSize: '0.9rem' }}>
                PIN: {gamePin}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. Player Preview Screen
    if (playerGameState === 'PREVIEW') {
      return (
        <div className="app-container">
          <div className="glass-card" style={{ maxWidth: '400px', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3rem', animation: 'bounce 1s infinite alternate', marginBottom: '1rem' }}>⏱️</div>
            <h2>Get Ready!</h2>
            <p style={{ color: '#a29bfe', fontSize: '1.2rem', fontWeight: 600 }}>
              Look at the main screen for the question!
            </p>
          </div>
        </div>
      );
    }

    // 4. Player Active Button Grid Screen (Can select / deselect / change answers)
    if (playerGameState === 'ACTIVE' || playerGameState === 'ANSWERED') {
      const isTF = currentQuestion?.type === 'TRUE_FALSE';

      return (
        <div className="app-container" style={{ padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '500px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 10px' }}>
            <span style={{ fontWeight: 700, color: '#a29bfe' }}>{playerNickname}</span>
            <span className="player-count-badge">Time: {activeTimer}s</span>
          </div>

          <div className={`player-btn-grid ${isTF ? 'tf-layout' : ''}`}>
            {isTF ? (
              // True / False options: 0 = True (Red), 1 = False (Blue)
              <>
                <button 
                  className={`player-opt-btn opt-red ${selectedOptions.includes(0) ? 'selected' : ''}`}
                  onClick={() => togglePlayerOption(0)}
                >
                  <span>▲</span>
                  <span className="player-btn-text">True</span>
                </button>
                <button 
                  className={`player-opt-btn opt-blue ${selectedOptions.includes(1) ? 'selected' : ''}`}
                  onClick={() => togglePlayerOption(1)}
                >
                  <span>◆</span>
                  <span className="player-btn-text">False</span>
                </button>
              </>
            ) : (
              // Multiple Choice: 4 options
              <>
                <button 
                  className={`player-opt-btn opt-red ${selectedOptions.includes(0) ? 'selected' : ''}`}
                  onClick={() => togglePlayerOption(0)}
                >
                  <span>▲</span>
                  <span className="player-btn-text">Option A</span>
                </button>
                <button 
                  className={`player-opt-btn opt-blue ${selectedOptions.includes(1) ? 'selected' : ''}`}
                  onClick={() => togglePlayerOption(1)}
                >
                  <span>◆</span>
                  <span className="player-btn-text">Option B</span>
                </button>
                <button 
                  className={`player-opt-btn opt-yellow ${selectedOptions.includes(2) ? 'selected' : ''}`}
                  onClick={() => togglePlayerOption(2)}
                >
                  <span>●</span>
                  <span className="player-btn-text">Option C</span>
                </button>
                <button 
                  className={`player-opt-btn opt-green ${selectedOptions.includes(3) ? 'selected' : ''}`}
                  onClick={() => togglePlayerOption(3)}
                >
                  <span>■</span>
                  <span className="player-btn-text">Option D</span>
                </button>
              </>
            )}
          </div>
          
          <div style={{ marginTop: '1.5rem', color: '#a29bfe', fontSize: '0.9rem', textAlign: 'center' }}>
            {selectedOptions.length > 0 
              ? "Option selected. Tap again to deselect, or tap another to change!" 
              : "Tap an option above to submit your answer!"}
          </div>
        </div>
      );
    }

    // 5. Player Question Results screen (Correct / Incorrect panels)
    if (playerGameState === 'RESULT') {
      return (
        <div className="app-container" style={{ padding: 0 }}>
          {playerIsCorrect ? (
            <div className="feedback-panel correct">
              <div className="feedback-icon">🎉</div>
              <h2 style={{ fontSize: '2.5rem' }}>Correct!</h2>
              <div className="feedback-points">+{playerScoreChange}</div>
              <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>Total Score: {playerScore}</p>
              <p style={{ marginTop: '1.5rem', fontStyle: 'italic' }}>Keep it up! 🔥</p>
            </div>
          ) : (
            <div className="feedback-panel incorrect">
              <div className="feedback-icon">❌</div>
              <h2 style={{ fontSize: '2.5rem' }}>Incorrect</h2>
              <div className="feedback-points">+0</div>
              <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>Total Score: {playerScore}</p>
              <p style={{ marginTop: '1.5rem', fontStyle: 'italic' }}>You will get the next one! 💪</p>
            </div>
          )}
        </div>
      );
    }

    // 6. Player Rank Screen (Position update)
    if (playerGameState === 'RANK') {
      return (
        <div className="app-container">
          <div className="glass-card" style={{ maxWidth: '400px' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>📊</div>
            <h2>Lobby Standings</h2>
            <p style={{ fontSize: '1.2rem', color: '#a29bfe' }}>Current rank:</p>
            <p style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '0.5rem 0' }}>
              #{playerPlace}
            </p>
            <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#a29bfe' }}>
              {playerScore} points
            </p>
          </div>
        </div>
      );
    }

    // 7. Player Game Over View
    if (playerGameState === 'GAMEOVER') {
      return (
        <div className="app-container">
          <div className="glass-card" style={{ maxWidth: '400px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏆</div>
            <h2>Quiz Finished!</h2>
            <p style={{ color: '#a29bfe', fontSize: '1.1rem' }}>Your final position:</p>
            <p style={{ fontSize: '3.5rem', fontWeight: 900, color: '#ffd700', margin: '0.5rem 0' }}>
              #{playerPlace}
            </p>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '2rem' }}>
              Total Score: {playerScore} pts
            </p>
            
            <button className="btn" onClick={resetToHome}>
              Play Again
            </button>
          </div>
        </div>
      );
    }
  }

  // Fallback helper to styled red color
  function varColorRed() {
    return '#ff3860';
  }

  return null;
}
