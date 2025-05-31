'use client';

import React, { useRef, useEffect } from 'react';
import { useGameNetwork } from '@/network/client/hooks/useGameNetwork';
import { 
    PLAYER_SIZE, 
    WORLD_MIN_X, 
    WORLD_MAX_X, 
    WORLD_MIN_Y, 
    WORLD_MAX_Y,
    ClientPlayerData 
} from '@/network/types';
import { Player } from './components/Player';

// Constants for the game world
const WORLD_DIV_WIDTH = WORLD_MAX_X - WORLD_MIN_X;
const WORLD_DIV_HEIGHT = WORLD_MAX_Y - WORLD_MIN_Y;
const MOVEMENT_SPEED = 5;
const CAMERA_LERP_FACTOR = 0.1;

// Helper functions
const worldToCssX = (worldX: number) => worldX - WORLD_MIN_X;
const worldToCssY = (worldY: number) => worldY - WORLD_MIN_Y;

export default function MultiplayerPage() {
    // Network state
    const { 
        isConnected,
        playerId,
        players,
        latency,
        move,
        shoot 
    } = useGameNetwork({
        serverUrl: process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:5000',
        autoConnect: true
    });

    // Refs for DOM elements and game state
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const worldRef = useRef<HTMLDivElement>(null);
    const playerElementsRef = useRef<{ [id: string]: HTMLDivElement | null }>({});
    const keysPressedRef = useRef<{ [key: string]: boolean }>({});
    const animationFrameIdRef = useRef<number | null>(null);
    const lastMoveTimeRef = useRef<number>(0);

    // Handle keyboard input
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            keysPressedRef.current[event.key.toLowerCase()] = true;
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            keysPressedRef.current[event.key.toLowerCase()] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Game loop
    useEffect(() => {
        if (!playerId || !players[playerId]) return;

        const gameLoop = () => {
            const currentPlayer = players[playerId];
            if (!currentPlayer) {
                animationFrameIdRef.current = requestAnimationFrame(gameLoop);
                return;
            }

            let newX = currentPlayer.x;
            let newY = currentPlayer.y;
            let moved = false;

            // Handle movement
            if (keysPressedRef.current['w'] || keysPressedRef.current['arrowup']) {
                newY -= MOVEMENT_SPEED;
                moved = true;
            }
            if (keysPressedRef.current['s'] || keysPressedRef.current['arrowdown']) {
                newY += MOVEMENT_SPEED;
                moved = true;
            }
            if (keysPressedRef.current['a'] || keysPressedRef.current['arrowleft']) {
                newX -= MOVEMENT_SPEED;
                moved = true;
            }
            if (keysPressedRef.current['d'] || keysPressedRef.current['arrowright']) {
                newX += MOVEMENT_SPEED;
                moved = true;
            }

            // Apply movement with rate limiting
            if (moved) {
                const now = Date.now();
                if (now - lastMoveTimeRef.current > 16) { // ~60 FPS
                    move({ x: newX, y: newY });
                    lastMoveTimeRef.current = now;
                }
            }

            // Camera follow
            if (gameAreaRef.current && currentPlayer) {
                const gameAreaNode = gameAreaRef.current;
                const playerCssX = worldToCssX(currentPlayer.x);
                const playerCssY = worldToCssY(currentPlayer.y);
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
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, [playerId, players, move]);

    // Handle shooting
    useEffect(() => {
        if (!playerId || !worldRef.current) return;

        const handleShoot = (event: MouseEvent) => {
            const currentPlayer = players[playerId];
            if (!currentPlayer || !worldRef.current) return;

            const worldRect = worldRef.current.getBoundingClientRect();
            const clickCssX = event.clientX - worldRect.left;
            const clickCssY = event.clientY - worldRect.top;
            const clickWorldX = clickCssX + WORLD_MIN_X;
            const clickWorldY = clickCssY + WORLD_MIN_Y;
            const playerCenterX = currentPlayer.x + PLAYER_SIZE / 2;
            const playerCenterY = currentPlayer.y + PLAYER_SIZE / 2;
            const angle = Math.atan2(clickWorldY - playerCenterY, clickWorldX - playerCenterX);
            
            shoot({ angle });
        };

        worldRef.current.addEventListener('mousedown', handleShoot);
        return () => worldRef.current?.removeEventListener('mousedown', handleShoot);
    }, [playerId, players, shoot]);

    const handlePlayerRef = (id: string, ref: HTMLDivElement | null) => {
        if (ref) {
            playerElementsRef.current[id] = ref;
        } else {
            delete playerElementsRef.current[id];
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#333' }}>
            {/* HUD */}
            <div style={{
                position: 'absolute', top: '10px', left: '10px', zIndex: 10,
                color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '8px 12px',
                borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px',
                display: 'flex', gap: '15px'
            }}>
                <span>Status: {isConnected ? 'Connected' : 'Disconnected'}</span>
                <span>ID: {playerId || 'N/A'}</span>
                <span>Latency: {latency}ms</span>
                <span>Players: {Object.keys(players).length}</span>
                <span>X: {playerId && players[playerId] ? Math.round(players[playerId].x) : 'N/A'}</span>
                <span>Y: {playerId && players[playerId] ? Math.round(players[playerId].y) : 'N/A'}</span>
            </div>

            {/* Controls info */}
            <div style={{
                position: 'absolute', bottom: '10px', left: '50%',
                transform: 'translateX(-50%)', zIndex: 10,
                color: 'rgba(255,255,255,0.7)', textAlign: 'center',
                fontSize: '0.8em', fontFamily: 'monospace'
            }}>
                <p>WASD/Arrows: Move • Click: Shoot</p>
            </div>

            {/* Game Area */}
            <div
                ref={gameAreaRef}
                className="game-area-no-scrollbar"
                style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'auto',
                    backgroundColor: '#2a2a2a',
                    cursor: 'crosshair',
                }}
            >
                <div
                    ref={worldRef}
                    style={{
                        position: 'relative',
                        width: `${WORLD_DIV_WIDTH}px`,
                        height: `${WORLD_DIV_HEIGHT}px`,
                    }}
                >
                    {/* Players */}
                    {Object.values(players).map((player: ClientPlayerData) => (
                        <Player
                            key={player.id}
                            player={player}
                            isCurrentPlayer={player.id === playerId}
                            worldToCssX={worldToCssX}
                            worldToCssY={worldToCssY}
                            onRef={handlePlayerRef}
                        />
                    ))}
                </div>
            </div>

            {/* Styles */}
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