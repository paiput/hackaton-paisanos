import { Socket, io } from 'socket.io-client';
import { GameState, Player, MoveEvent, ShootEvent, PlayerShotEvent } from './types';
import { SocketEvents } from './events';
import { NetworkGameState, NetworkPlayer, PlayerUpdateEvent, ThrowPizzaEvent, PizzaUpdateEvent, VehicleUpdateEvent, GameStartEvent, GameOverEvent, PlayerCollisionEvent } from './pizza-game-types';

export type GameClientCallbacks = {
    onConnect?: (playerId: string) => void;
    onDisconnect?: () => void;
    onGameState?: (state: GameState) => void;
    onPlayerJoined?: (player: Player) => void;
    onPlayerMoved?: (player: Player) => void;
    onPlayerShot?: (data: PlayerShotEvent) => void;
    onPlayerLeft?: (playerId: string) => void;
    onLatencyUpdate?: (latency: number) => void;
    // Pizza Game specific callbacks
    onGameStart?: (data: GameStartEvent) => void;
    onGameOver?: (data: GameOverEvent) => void;
    onPlayerUpdate?: (data: PlayerUpdateEvent) => void;
    onPizzaThrown?: (data: ThrowPizzaEvent) => void;
    onPizzaUpdate?: (data: PizzaUpdateEvent) => void;
    onVehicleUpdate?: (data: VehicleUpdateEvent) => void;
    onPlayerCollision?: (data: PlayerCollisionEvent) => void;
    onDeliveryComplete?: (playerId: string, points: number) => void;
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

        this.socket.on(SocketEvents.GameStart, (data: GameStartEvent) => {
            this.callbacks.onGameStart?.(data);
        });

        this.socket.on(SocketEvents.GameOver, (data: GameOverEvent) => {
            this.callbacks.onGameOver?.(data);
        });

        this.socket.on(SocketEvents.PlayerUpdate, (data: PlayerUpdateEvent) => {
            this.callbacks.onPlayerUpdate?.(data);
        });

        this.socket.on(SocketEvents.ThrowPizza, (data: ThrowPizzaEvent) => {
            this.callbacks.onPizzaThrown?.(data);
        });

        this.socket.on(SocketEvents.PizzaUpdate, (data: PizzaUpdateEvent) => {
            this.callbacks.onPizzaUpdate?.(data);
        });

        this.socket.on(SocketEvents.VehicleUpdate, (data: VehicleUpdateEvent) => {
            this.callbacks.onVehicleUpdate?.(data);
        });

        this.socket.on(SocketEvents.PlayerCollision, (data: PlayerCollisionEvent) => {
            this.callbacks.onPlayerCollision?.(data);
        });

        this.socket.on(SocketEvents.DeliveryComplete, (data: { playerId: string; points: number }) => {
            this.callbacks.onDeliveryComplete?.(data.playerId, data.points);
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

    public updatePlayer(data: PlayerUpdateEvent): void {
        this.socket?.emit(SocketEvents.PlayerUpdate, data);
    }

    public throwPizza(data: ThrowPizzaEvent): void {
        this.socket?.emit(SocketEvents.ThrowPizza, data);
    }

    public signalCharge(isCharging: boolean, power: number): void {
        this.socket?.emit(SocketEvents.PlayerCharge, { isCharging, power });
    }

    public signalBrake(isBraking: boolean): void {
        this.socket?.emit(SocketEvents.PlayerBrake, { isBraking });
    }

    public readyToStart(): void {
        this.socket?.emit(SocketEvents.ReadyToStart);
    }

    public resetGame(): void {
        this.socket?.emit(SocketEvents.GameReset);
    }

    public get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    public get id(): string | null {
        return this.socket?.id ?? null;
    }
} 