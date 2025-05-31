import { Socket, io } from 'socket.io-client';
import { GameState, Player, MoveEvent, ShootEvent, PlayerShotEvent } from '../types';
import { SocketEvents } from '../events';

export type GameClientCallbacks = {
    onConnect?: (playerId: string) => void;
    onDisconnect?: () => void;
    onGameState?: (state: GameState) => void;
    onPlayerJoined?: (player: Player) => void;
    onPlayerMoved?: (player: Player) => void;
    onPlayerShot?: (data: PlayerShotEvent) => void;
    onPlayerLeft?: (playerId: string) => void;
    onLatencyUpdate?: (latency: number) => void;
}

export class GameClient {
    private socket: Socket | null = null;
    private callbacks: GameClientCallbacks = {};
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(private serverUrl: string) {}

    public connect(callbacks: GameClientCallbacks = {}): void {
        if (this.socket?.connected) {
            console.warn('Client is already connected');
            return;
        }

        this.callbacks = callbacks;
        this.socket = io(this.serverUrl);
        this.setupEventHandlers();
        this.startPingInterval();
    }

    public disconnect(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.socket?.disconnect();
        this.socket = null;
    }

    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on(SocketEvents.Connect, () => {
            if (this.socket?.id) {
                this.callbacks.onConnect?.(this.socket.id);
            }
        });

        this.socket.on(SocketEvents.Disconnect, () => {
            this.callbacks.onDisconnect?.();
        });

        this.socket.on(SocketEvents.GameState, (state: GameState) => {
            this.callbacks.onGameState?.(state);
        });

        this.socket.on(SocketEvents.PlayerJoined, (player: Player) => {
            this.callbacks.onPlayerJoined?.(player);
        });

        this.socket.on(SocketEvents.PlayerMoved, (player: Player) => {
            this.callbacks.onPlayerMoved?.(player);
        });

        this.socket.on(SocketEvents.PlayerShot, (data: PlayerShotEvent) => {
            this.callbacks.onPlayerShot?.(data);
        });

        this.socket.on(SocketEvents.PlayerLeft, (playerId: string) => {
            this.callbacks.onPlayerLeft?.(playerId);
        });

        this.socket.on(SocketEvents.PongEvent, (startTime: number) => {
            const latency = Date.now() - startTime;
            this.callbacks.onLatencyUpdate?.(latency);
        });
    }

    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            this.socket?.emit(SocketEvents.PingEvent, Date.now());
        }, 2000);
    }

    public move(data: MoveEvent): void {
        this.socket?.emit(SocketEvents.Move, data);
    }

    public shoot(data: ShootEvent): void {
        this.socket?.emit(SocketEvents.Shoot, data);
    }

    public get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    public get id(): string | null {
        return this.socket?.id ?? null;
    }
} 