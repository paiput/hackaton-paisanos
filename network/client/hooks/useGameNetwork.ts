import { useEffect, useRef, useState, useCallback } from 'react';
import { GameClient, GameClientCallbacks } from '../GameClient';
import { GameState, ClientPlayerData, MoveEvent, ShootEvent } from '../../types';

interface UseGameNetworkProps {
    serverUrl: string;
    autoConnect?: boolean;
}

interface UseGameNetworkReturn {
    isConnected: boolean;
    playerId: string | null;
    players: { [id: string]: ClientPlayerData };
    latency: number;
    connect: () => void;
    disconnect: () => void;
    move: (data: MoveEvent) => void;
    shoot: (data: ShootEvent) => void;
}

export function useGameNetwork({ 
    serverUrl, 
    autoConnect = true 
}: UseGameNetworkProps): UseGameNetworkReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [players, setPlayers] = useState<{ [id: string]: ClientPlayerData }>({});
    const [latency, setLatency] = useState(0);
    
    const clientRef = useRef<GameClient | null>(null);

    const setupCallbacks = useCallback((): GameClientCallbacks => ({
        onConnect: (id: string) => {
            setIsConnected(true);
            setPlayerId(id);
        },
        onDisconnect: () => {
            setIsConnected(false);
            setPlayerId(null);
            setPlayers({});
        },
        onGameState: (state: GameState) => {
            const clientPlayers: { [id: string]: ClientPlayerData } = {};
            Object.entries(state.players).forEach(([id, player]) => {
                clientPlayers[id] = {
                    ...player,
                    targetX: player.x,
                    targetY: player.y,
                };
            });
            setPlayers(clientPlayers);
        },
        onPlayerJoined: (player) => {
            setPlayers(prev => ({
                ...prev,
                [player.id]: {
                    ...player,
                    targetX: player.x,
                    targetY: player.y,
                },
            }));
        },
        onPlayerMoved: (player) => {
            setPlayers(prev => {
                if (!prev[player.id]) return prev;
                return {
                    ...prev,
                    [player.id]: {
                        ...prev[player.id]!,
                        ...player,
                        targetX: player.x,
                        targetY: player.y,
                    },
                };
            });
        },
        onPlayerLeft: (id) => {
            setPlayers(prev => {
                const { [id]: _, ...rest } = prev;
                return rest;
            });
        },
        onLatencyUpdate: (newLatency) => {
            setLatency(newLatency);
        },
    }), []);

    const connect = useCallback(() => {
        if (!clientRef.current) {
            clientRef.current = new GameClient(serverUrl);
        }
        clientRef.current.connect(setupCallbacks());
    }, [serverUrl, setupCallbacks]);

    const disconnect = useCallback(() => {
        clientRef.current?.disconnect();
        clientRef.current = null;
    }, []);

    const move = useCallback((data: MoveEvent) => {
        clientRef.current?.move(data);
    }, []);

    const shoot = useCallback((data: ShootEvent) => {
        clientRef.current?.shoot(data);
    }, []);

    useEffect(() => {
        if (autoConnect) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    return {
        isConnected,
        playerId,
        players,
        latency,
        connect,
        disconnect,
        move,
        shoot,
    };
} 