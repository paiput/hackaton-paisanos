'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGameRoom } from '../hooks/useGameRoom';
import { PlayerPosition, Shot, GameEvent } from '../types/game';

interface GameRoomProps {
  roomId: string;
  playerId: string;
}

const PLAYER_COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'brown', 'pink', 'cyan'];
const PLAYER_SIZE = 25; // Slightly larger player
const GAME_AREA_WIDTH = 1200; // Much larger map
const GAME_AREA_HEIGHT = 800; // Much larger map
const MOVE_SPEED = 3; // Pixels per frame for smoother movement
const SHOT_SPEED = 7;
const SHOT_LIFETIME_MS = 1500; // Shots disappear after 1.5 seconds
const SHOT_SIZE = 6;

const GameRoom: React.FC<GameRoomProps> = ({ roomId, playerId }) => {
  const { gameRoomState, sendPlayerPosition, sendGameEvent, isPresent } = useGameRoom({
    roomId,
    playerId,
  });

  const initialX = Math.floor(Math.random() * (GAME_AREA_WIDTH - PLAYER_SIZE));
  const initialY = Math.floor(Math.random() * (GAME_AREA_HEIGHT - PLAYER_SIZE));
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number }>({
    x: initialX,
    y: initialY,
  });

  const [activeShots, setActiveShots] = useState<Record<string, Shot>>({});
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef<{x: number, y: number}>({ x: 0, y: 0});

  const movementKeys = useRef({ w: false, a: false, s: false, d: false });
  const gameLoopRef = useRef<number>();

  const localPlayerColor = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
  }, [playerId]);

  // Send position updates when localPosition changes and client is present
  useEffect(() => {
    if (isPresent) {
      sendPlayerPosition({ x: localPosition.x, y: localPosition.y });
    }
  }, [isPresent, localPosition, sendPlayerPosition]);

  // Game loop for continuous movement
  useEffect(() => {
    const updateGame = () => {
      const now = Date.now();
      if (!isPresent) {
        gameLoopRef.current = requestAnimationFrame(updateGame);
        return;
      }

      let dx = 0;
      let dy = 0;

      if (movementKeys.current.w) dy -= MOVE_SPEED;
      if (movementKeys.current.s) dy += MOVE_SPEED;
      if (movementKeys.current.a) dx -= MOVE_SPEED;
      if (movementKeys.current.d) dx += MOVE_SPEED;

      if (dx !== 0 || dy !== 0) {
        setLocalPosition((prev) => ({
          x: Math.max(0, Math.min(prev.x + dx, GAME_AREA_WIDTH - PLAYER_SIZE)),
          y: Math.max(0, Math.min(prev.y + dy, GAME_AREA_HEIGHT - PLAYER_SIZE)),
        }));
      }

      // Update and filter shots
      setActiveShots(prevShots => {
        const updatedShots: Record<string, Shot> = {};
        for (const id in prevShots) {
          const shot = prevShots[id];
          if (now - shot.spawnTime < SHOT_LIFETIME_MS) {
            updatedShots[id] = {
              ...shot,
              x: shot.x + shot.dx * SHOT_SPEED,
              y: shot.y + shot.dy * SHOT_SPEED,
            };
          }
        }
        return updatedShots;
      });

      gameLoopRef.current = requestAnimationFrame(updateGame);
    };

    gameLoopRef.current = requestAnimationFrame(updateGame);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [isPresent]); // Rerun loop logic if presence changes

  // Event listeners for key presses
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          movementKeys.current.w = true;
          break;
        case 's':
        case 'arrowdown':
          movementKeys.current.s = true;
          break;
        case 'a':
        case 'arrowleft':
          movementKeys.current.a = true;
          break;
        case 'd':
        case 'arrowright':
          movementKeys.current.d = true;
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          movementKeys.current.w = false;
          break;
        case 's':
        case 'arrowdown':
          movementKeys.current.s = false;
          break;
        case 'a':
        case 'arrowleft':
          movementKeys.current.a = false;
          break;
        case 'd':
        case 'arrowright':
          movementKeys.current.d = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  // Mouse move listener for aiming
  useEffect(() => {
    const area = gameAreaRef.current;
    if (!area) return;

    const handleMouseMove = (event: MouseEvent) => {
        const rect = area.getBoundingClientRect();
        mousePositionRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };
    area.addEventListener('mousemove', handleMouseMove);
    return () => area.removeEventListener('mousemove', handleMouseMove);
  }, [gameAreaRef.current]); // Re-add if gameAreaRef changes (it shouldn't after mount)

  const handleManualMove = useCallback((dx: number, dy: number) => {
     if (!isPresent) return;
      setLocalPosition((prev) => ({
        x: Math.max(0, Math.min(prev.x + dx * MOVE_SPEED * 3, GAME_AREA_WIDTH - PLAYER_SIZE)), // Buttons x3 speed factor
        y: Math.max(0, Math.min(prev.y + dy * MOVE_SPEED * 3, GAME_AREA_HEIGHT - PLAYER_SIZE)),
      }));
  }, [isPresent]);

  const handleShoot = useCallback(() => {
    if (!isPresent || !gameAreaRef.current) return;

    const playerCenterX = localPosition.x + PLAYER_SIZE / 2;
    const playerCenterY = localPosition.y + PLAYER_SIZE / 2;

    const angle = Math.atan2(mousePositionRef.current.y - playerCenterY, mousePositionRef.current.x - playerCenterX);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const newShot: Shot = {
      id: `${playerId}-${Date.now()}`,
      playerId,
      x: playerCenterX - SHOT_SIZE / 2, // Start shot from player center
      y: playerCenterY - SHOT_SIZE / 2,
      dx,
      dy,
      spawnTime: Date.now(),
    };

    setActiveShots(prev => ({ ...prev, [newShot.id]: newShot }));
    sendGameEvent({
      type: 'shoot',
      payload: newShot,
    });
  }, [isPresent, localPosition, playerId, sendGameEvent]);
  
  // Click listener for shooting
  useEffect(() => {
    const area = gameAreaRef.current;
    if (!area) return;

    const handleClick = (event: MouseEvent) => {
        // Optional: check if click is within bounds if needed, though gameAreaRef covers it
        handleShoot();
    };

    area.addEventListener('click', handleClick);
    return () => area.removeEventListener('click', handleClick);
  }, [handleShoot]); // Re-add if handleShoot changes

  const getPlayerColor = useCallback((pId: string) => {
    if (pId === playerId) return localPlayerColor;
    let hash = 0;
    for (let i = 0; i < pId.length; i++) {
      hash = pId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
  }, [playerId, localPlayerColor]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2>Game Room: {roomId}</h2>
      <p>Your Player ID: <span style={{fontWeight: 'bold', color: localPlayerColor}}>{playerId}</span></p>
      <p>Status: {isPresent ? <span style={{color: 'green'}}>Connected & Present</span> : <span style={{color: 'red'}}>Disconnected/Joining...</span>}</p>
      
      <div style={{ margin: '10px 0' }}>
        <button onClick={() => handleManualMove(0, -1)} disabled={!isPresent} style={{margin: '2px'}}>Up</button>
        <button onClick={() => handleManualMove(0, 1)} disabled={!isPresent} style={{margin: '2px'}}>Down</button>
        <button onClick={() => handleManualMove(-1, 0)} disabled={!isPresent} style={{margin: '2px'}}>Left</button>
        <button onClick={() => handleManualMove(1, 0)} disabled={!isPresent} style={{margin: '2px'}}>Right</button>
      </div>
      <p style={{fontSize: '0.9em', color: '#555'}}>Use WASD/Arrows to move. Click in game area to shoot.</p>

      {/* Game Area */} 
      <div 
        ref={gameAreaRef}
        style={{
            width: `${GAME_AREA_WIDTH}px`, 
            height: `${GAME_AREA_HEIGHT}px`, 
            border: '2px solid #333', 
            position: 'relative',
            backgroundColor: '#e0e0e0', // Lighter gray for better contrast with more colors
            overflow: 'hidden',
            cursor: 'crosshair' // Indicate aiming
        }}
      >
        {/* Render active shots */}
        {Object.values(activeShots).map(shot => (
            <div key={shot.id} style={{
                position: 'absolute',
                left: `${shot.x}px`,
                top: `${shot.y}px`,
                width: `${SHOT_SIZE}px`,
                height: `${SHOT_SIZE}px`,
                backgroundColor: getPlayerColor(shot.playerId), // Shot color matches player
                borderRadius: '50%',
                boxShadow: '0 0 2px #000'
            }} />
        ))}

        {/* Render other players from gameRoomState */}
        {Object.values(gameRoomState.players)
          .filter(player => player.playerId !== playerId)
          .map((player) => (
          <div
            key={player.playerId}
            title={`${player.playerId} (X: ${player.x}, Y: ${player.y})`}
            style={{
              position: 'absolute',
              left: `${player.x}px`,
              top: `${player.y}px`,
              width: `${PLAYER_SIZE}px`,
              height: `${PLAYER_SIZE}px`,
              backgroundColor: getPlayerColor(player.playerId),
              borderRadius: '50%',
              transition: 'left 0.1s linear, top 0.1s linear', // Slightly faster transition for remote players
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'white',
              fontWeight: 'bold',
              boxShadow: '0px 0px 3px rgba(0,0,0,0.5)'
            }}
          >{player.playerId.substring(0,2).toUpperCase()}</div>
        ))}
        {/* Render local player directly for immediate feedback */}
        {isPresent && (
             <div
                key={playerId}
                title={`You: ${playerId} (X: ${localPosition.x}, Y: ${localPosition.y})`}
                style={{
                  position: 'absolute',
                  left: `${localPosition.x}px`,
                  top: `${localPosition.y}px`,
                  width: `${PLAYER_SIZE}px`,
                  height: `${PLAYER_SIZE}px`,
                  backgroundColor: localPlayerColor,
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxSizing: 'border-box',
                  boxShadow: '0 0 8px white, 0px 0px 5px rgba(0,0,0,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'white',
                  fontWeight: 'bold',
                  zIndex: 10
                }}
            >{playerId.substring(0,2).toUpperCase()}</div>
        )}
      </div>
      <p style={{marginTop: '10px', fontSize: '0.9em', color: '#555'}}>Players in room: {Object.keys(gameRoomState.players).length} (You are {isPresent ? 'in' : 'not in'} this count)</p>
      <p style={{fontSize: '0.8em', color: '#777'}}>Game Area: {GAME_AREA_WIDTH}x{GAME_AREA_HEIGHT}</p>
      <p style={{fontSize: '0.8em', color: '#777'}}>Mouse: ({Math.round(mousePositionRef.current.x)}, {Math.round(mousePositionRef.current.y)})</p>
      <p style={{fontSize: '0.8em', color: '#777'}}>Active Shots: {Object.keys(activeShots).length}</p>
    </div>
  );
};

// Component to allow setting roomId and playerId
const GameLauncher: React.FC = () => {
  const [roomId, setRoomId] = useState('default-room');
  const [playerId, setPlayerId] = useState(() => {
    const adj = ['Swift', 'Crafty', 'Silent', 'Dizzy', 'Epic', 'Mad', 'Lazy', 'Hyper'];
    const nouns = ['Fox', 'Ninja', 'Ghost', 'Bot', 'Hero', 'Alien', 'Wizard', 'Llama'];
    return `${adj[Math.floor(Math.random() * adj.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 90) + 10}`;
  });
  const [joined, setJoined] = useState(false);

  if (joined) {
    return <GameRoom roomId={roomId} playerId={playerId} />;
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', justifyContent: 'center', minHeight: '90vh', background: '#f4f4f8' }}>
      <div style={{textAlign: 'center', marginBottom: '30px'}}>
        <h1 style={{fontSize: '2.5em', color: '#333'}}>Realtime Multiplayer Demo</h1>
        <p style={{fontSize: '1.1em', color: '#555'}}>Powered by Supabase Realtime</p>
      </div>
      <div style={{display: 'flex', flexDirection:'column', gap: '15px', padding: '30px', border: '1px solid #ddd', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '320px'}}>
        <h2 style={{textAlign: 'center', marginBottom:'10px', color: '#333'}}>Join Game Room</h2>
        <div>
          <label htmlFor="roomId" style={{marginRight: '5px', display:'block', marginBottom:'5px', fontWeight:'bold', color: '#444'}}>Room ID: </label>
          <input 
            type="text" 
            id="roomId" 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)} 
            style={{padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box'}}
          />
        </div>
        <div>
          <label htmlFor="playerId" style={{marginRight: '5px', display:'block', marginBottom:'5px', fontWeight:'bold', color: '#444'}}>Your Player Name: </label>
          <input 
            type="text" 
            id="playerId" 
            value={playerId} 
            onChange={(e) => setPlayerId(e.target.value)} 
            style={{padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box'}}
          />
        </div>
        <button 
            onClick={() => {if(roomId && playerId) setJoined(true)}}
            disabled={!roomId || !playerId}
            style={{
                padding: '12px 20px', 
                borderRadius: '6px', 
                border: 'none', 
                backgroundColor: (!roomId || !playerId) ? '#bdc3c7' : '#3498db', 
                color: 'white', 
                cursor: (!roomId || !playerId) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => { if (roomId && playerId) (e.currentTarget.style.backgroundColor = '#2980b9')}}
            onMouseOut={(e) => { if (roomId && playerId) (e.currentTarget.style.backgroundColor = '#3498db')}}
        >
          Join Room
        </button>
      </div>
    </div>
  );
};

export default GameLauncher; 