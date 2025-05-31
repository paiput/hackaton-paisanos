'use client';

import React, { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface PlayerData {
    id: string;
    x: number; // Coordenadas del juego (ej. -500 a 500)
    y: number; // Coordenadas del juego
}

interface GameState {
    players: { [id: string]: PlayerData };
}

const PLAYER_SIZE = 25;
const WORLD_MIN_X = -500;
const WORLD_MAX_X = 500;
const WORLD_MIN_Y = -500;
const WORLD_MAX_Y = 500;
const WORLD_DIV_WIDTH = WORLD_MAX_X - WORLD_MIN_X; // 1000
const WORLD_DIV_HEIGHT = WORLD_MAX_Y - WORLD_MIN_Y; // 1000

const MOVEMENT_SPEED = 5; 
const CAMERA_LERP_FACTOR = 0.1;
const MOVE_EMIT_INTERVAL = 16; // ms, ~60 FPS
const LOCAL_PLAYER_CORRECTION_LERP_FACTOR = 0.15; // Para suavizar la corrección del servidor

const worldToCssX = (worldX: number) => worldX - WORLD_MIN_X;
const worldToCssY = (worldY: number) => worldY - WORLD_MIN_Y;

export default function GamePage() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [players, setPlayers] = useState<{ [id: string]: PlayerData }>({});
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [latency, setLatency] = useState<number>(0);

    const gameAreaRef = useRef<HTMLDivElement>(null);
    const worldRef = useRef<HTMLDivElement>(null);
    const playerElementsRef = useRef<{ [id: string]: HTMLDivElement | null }>({});
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    const animationFrameIdRef = useRef<number | null>(null);
    const lastMoveEmitTimeRef = useRef<number>(0);
    const localPlayerPosRef = useRef<{x: number, y: number} | null>(null);
    const serverAuthoritativeStateRef = useRef<{x: number, y: number} | null>(null);

    useEffect(() => {
        const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:5000');
        setSocket(newSocket);

        newSocket.on('connect', () => { if (newSocket.id) setPlayerId(newSocket.id); });
        newSocket.on('pong_event', (st: number) => setLatency(Date.now() - st));
        newSocket.on('gameState', (gs: GameState) => {
            setPlayers(gs.players);
            if (newSocket.id && gs.players[newSocket.id]) {
                const myInitialState = gs.players[newSocket.id]!;
                if (!localPlayerPosRef.current) {
                    localPlayerPosRef.current = { x: myInitialState.x, y: myInitialState.y };
                }
                serverAuthoritativeStateRef.current = { x: myInitialState.x, y: myInitialState.y };
            }
        });
        newSocket.on('playerJoined', (p: PlayerData) => setPlayers(prev => ({ ...prev, [p.id]: p })));
        
        newSocket.on('playerMoved', (p: PlayerData) => {
            if (newSocket.id && p.id === newSocket.id) { // Jugador local
                serverAuthoritativeStateRef.current = { x: p.x, y: p.y };
            } else { // Jugadores remotos
                setPlayers(prev => ({ ...prev, [p.id]: p })); 
            }
        });

        newSocket.on('playerLeft', (id: string) => setPlayers(prev => {
            const { [id]: _, ...rest } = prev;
            if (playerElementsRef.current[id]) delete playerElementsRef.current[id];
            return rest;
        }));
        newSocket.on('playerShot', (data: { playerId: string, angle?: number }) => {
            const shooterElement = playerElementsRef.current[data.playerId];
            if (shooterElement) {
                shooterElement.classList.add('shooting-animation');
                setTimeout(() => shooterElement.classList.remove('shooting-animation'), 150);
            }
        });
        newSocket.on('disconnect', () => { /* Manejar limpieza si es necesario */ });

        return () => {
            newSocket.disconnect();
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        };
    }, []); // Cambiado de [playerId] a [] para evitar el bucle de conexión

    useEffect(() => {
        if (socket && playerId) {
            const intervalId = setInterval(() => socket.emit('ping_event', Date.now()), 2000);
            return () => clearInterval(intervalId);
        }
    }, [socket, playerId]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => { keysPressedRef.current[event.key.toLowerCase()] = true; };
        const handleKeyUp = (event: KeyboardEvent) => { keysPressedRef.current[event.key.toLowerCase()] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // useEffect para la inicialización única de localPlayerPosRef si no se hizo en gameState
    useEffect(() => {
        if (playerId && players[playerId] && !localPlayerPosRef.current) {
            localPlayerPosRef.current = { x: players[playerId]!.x, y: players[playerId]!.y };
            // También inicializar serverAuthoritativeStateRef si no lo hizo gameState
            if (!serverAuthoritativeStateRef.current) {
                serverAuthoritativeStateRef.current = { x: players[playerId]!.x, y: players[playerId]!.y };
            }
        }
    }, [playerId, players]);

    useEffect(() => {
        if (!socket || !playerId) return;

        const gameLoop = () => {
            if (!playerId || !localPlayerPosRef.current) { 
                // Esperar a que localPlayerPosRef se inicialice
                animationFrameIdRef.current = requestAnimationFrame(gameLoop);
                return;
            }

            let { x: currentX, y: currentY } = localPlayerPosRef.current;
            let newX = currentX;
            let newY = currentY;
            let movedByInput = false;

            if (keysPressedRef.current['w'] || keysPressedRef.current['arrowup']) { newY -= MOVEMENT_SPEED; movedByInput = true; }
            if (keysPressedRef.current['s'] || keysPressedRef.current['arrowdown']) { newY += MOVEMENT_SPEED; movedByInput = true; }
            if (keysPressedRef.current['a'] || keysPressedRef.current['arrowleft']) { newX -= MOVEMENT_SPEED; movedByInput = true; }
            if (keysPressedRef.current['d'] || keysPressedRef.current['arrowright']) { newX += MOVEMENT_SPEED; movedByInput = true; }

            // Aplicar movimiento predictivo
            if(movedByInput){
                localPlayerPosRef.current = { x: newX, y: newY };
            }

            // Aplicar corrección suave del servidor si existe estado autoritativo
            if (serverAuthoritativeStateRef.current) {
                localPlayerPosRef.current.x += 
                    (serverAuthoritativeStateRef.current.x - localPlayerPosRef.current.x) * LOCAL_PLAYER_CORRECTION_LERP_FACTOR;
                localPlayerPosRef.current.y += 
                    (serverAuthoritativeStateRef.current.y - localPlayerPosRef.current.y) * LOCAL_PLAYER_CORRECTION_LERP_FACTOR;
            }
            
            // Aplicar límites del mundo a la posición potencialmente corregida
            localPlayerPosRef.current.x = Math.max(WORLD_MIN_X, Math.min(localPlayerPosRef.current.x, WORLD_MAX_X - PLAYER_SIZE));
            localPlayerPosRef.current.y = Math.max(WORLD_MIN_Y, Math.min(localPlayerPosRef.current.y, WORLD_MAX_Y - PLAYER_SIZE));

            // Actualizar el estado de React para renderizar (predicción + corrección suave)
            // Y determinar si hubo un cambio real para emitir al servidor
            const posChanged = localPlayerPosRef.current.x !== currentX || localPlayerPosRef.current.y !== currentY;

            if (posChanged) {
                 setPlayers(prev => {
                    if (!playerId || !prev[playerId]) return prev; 
                    return { 
                        ...prev, 
                        [playerId]: { 
                            ...prev[playerId]!, 
                            x: localPlayerPosRef.current!.x, 
                            y: localPlayerPosRef.current!.y 
                        }
                    };
                });
            }

            // Emitir movimiento al servidor
            // Solo emitir si hubo movimiento por input, o si la corrección del servidor nos movió significativamente.
            // La condición `posChanged` ya cubre esto.
            if (posChanged) { // Podríamos usar `movedByInput` o refinar esta condición
                const now = Date.now();
                if (now - lastMoveEmitTimeRef.current > MOVE_EMIT_INTERVAL) {
                    socket.emit('move', { x: localPlayerPosRef.current.x, y: localPlayerPosRef.current.y });
                    lastMoveEmitTimeRef.current = now;
                }
            }

            // Lógica de la cámara
            if (gameAreaRef.current && localPlayerPosRef.current) {
                const gameAreaNode = gameAreaRef.current;
                const playerWorldX = localPlayerPosRef.current.x;
                const playerWorldY = localPlayerPosRef.current.y;
                const playerCssX = worldToCssX(playerWorldX);
                const playerCssY = worldToCssY(playerWorldY);
                const halfScreenWidth = gameAreaNode.offsetWidth / 2;
                const halfScreenHeight = gameAreaNode.offsetHeight / 2;
                let targetScrollX = playerCssX - halfScreenWidth + (PLAYER_SIZE / 2);
                let targetScrollY = playerCssY - halfScreenHeight + (PLAYER_SIZE / 2);
                targetScrollX = Math.max(0, Math.min(targetScrollX, WORLD_DIV_WIDTH - gameAreaNode.offsetWidth));
                targetScrollY = Math.max(0, Math.min(targetScrollY, WORLD_DIV_HEIGHT - gameAreaNode.offsetHeight));
                gameAreaNode.scrollLeft += (targetScrollX - gameAreaNode.scrollLeft) * CAMERA_LERP_FACTOR;
                gameAreaNode.scrollTop += (targetScrollY - gameAreaNode.scrollTop) * CAMERA_LERP_FACTOR;
            }
            animationFrameIdRef.current = requestAnimationFrame(gameLoop);
        };

        animationFrameIdRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        };
    }, [socket, playerId]); // `players` ya no es dependencia directa aquí, la inicialización se maneja arriba.

    useEffect(() => {
        if (!socket || !playerId || !worldRef.current || !gameAreaRef.current) return;
        
        const currentPlayerData = players[playerId]; 
        if (!currentPlayerData) return; 

        const worldNode = worldRef.current;
        // const gameAreaNode = gameAreaRef.current; // No se usa gameAreaNode aquí
        const handleShoot = (event: MouseEvent) => {
            const playerSelf = players[playerId]; 
            if (!playerSelf) return;

            const worldRect = worldNode.getBoundingClientRect();
            const clickCssX = event.clientX - worldRect.left;
            const clickCssY = event.clientY - worldRect.top;
            const clickWorldX = clickCssX + WORLD_MIN_X;
            const clickWorldY = clickCssY + WORLD_MIN_Y;
            const playerCenterX = playerSelf.x + PLAYER_SIZE / 2;
            const playerCenterY = playerSelf.y + PLAYER_SIZE / 2;
            const deltaX = clickWorldX - playerCenterX;
            const deltaY = clickWorldY - playerCenterY;
            const angle = Math.atan2(deltaY, deltaX);
            socket.emit('shoot', { angle });
        };
        worldNode.addEventListener('mousedown', handleShoot);
        return () => worldNode.removeEventListener('mousedown', handleShoot);
    }, [socket, playerId, players]); 

    const currentPlayerForDisplay = playerId ? players[playerId] : null;

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#333' }}>
            <div style={{
                position: 'absolute', top: '10px', left: '10px', zIndex: 10,
                color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: '8px',
                fontFamily: 'monospace', fontSize: '14px', display: 'flex', gap: '15px'
            }}>
                <span>ID: {playerId || 'N/A'}</span>
                <span style={{ marginRight: '15px', marginLeft: '15px' }}>Latency: {latency} ms</span>
                {currentPlayerForDisplay && (
                    <>
                        <span>X: {currentPlayerForDisplay.x.toFixed(0)}</span>
                        <span>Y: {currentPlayerForDisplay.y.toFixed(0)}</span>
                    </>
                )}
            </div>
            <div style={{
                position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: '0.8em',
                fontFamily: 'monospace'
            }}>
                <p>WASD/Arrows: Move. Click: Shoot.</p>
            </div>
            <div
                ref={gameAreaRef}
                className="game-area-no-scrollbar"
                style={{
                    width: '100%', height: '100%', overflow: 'auto', 
                    backgroundColor: '#2a2a2a', cursor: 'crosshair', position: 'relative'
                }}
            >
                <div
                    ref={worldRef}
                    style={{
                        position: 'relative', 
                        width: `${WORLD_DIV_WIDTH}px`, height: `${WORLD_DIV_HEIGHT}px`,
                    }}
                >
                    {Object.values(players).map((player) => {
                        if (!player || !player.id) return null;
                        const cssX = worldToCssX(player.x);
                        const cssY = worldToCssY(player.y);
                        return (
                            <div
                                key={player.id}
                                ref={el => { 
                                    if (player.id) { 
                                        if(el) playerElementsRef.current[player.id] = el; 
                                        else delete playerElementsRef.current[player.id];
                                    }
                                }}
                                id={`player-${player.id}`}
                                style={{
                                    position: 'absolute',
                                    left: `${cssX}px`,
                                    top: `${cssY}px`,
                                    width: `${PLAYER_SIZE}px`,
                                    height: `${PLAYER_SIZE}px`,
                                    backgroundColor: player.id === playerId ? 'hsl(200, 100%, 60%)' : 'hsl(0, 70%, 50%)',
                                    borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.7)',
                                    boxShadow: player.id === playerId ? '0 0 10px hsl(200, 100%, 75%)' : '0 0 5px black',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '12px', fontWeight: 'bold',
                                    zIndex: player.id === playerId ? 3 : 1, 
                                    transition: player.id === playerId ? 'none' : 'left 0.06s linear, top 0.06s linear',
                                }}
                                title={`Player ${player.id}`}
                            >
                            </div>
                        );
                    })}
                </div>
            </div>
            <style>{`
                body { margin: 0; background-color: #121212; overscroll-behavior: none; }
                .game-area-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
                .game-area-no-scrollbar::-webkit-scrollbar { display: none; }
                .shooting-animation {
                    box-shadow: 0 0 20px 10px hsl(50, 100%, 60%) !important;
                    transform: scale(1.05);
                }
            `}</style>
        </div>
    );
} 