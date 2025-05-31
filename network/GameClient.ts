import { Socket, io } from 'socket.io-client';
import { GameState, Player, MoveEvent, ShootEvent, PlayerShotEvent } from './types';
import { SocketEvents } from './events';
import { NetworkGameState, NetworkPlayer, PlayerUpdateEvent, ThrowPizzaEvent, PizzaUpdateEvent, VehicleUpdateEvent, GameStartEvent, GameOverEvent, PlayerCollisionEvent } from './pizza-game-types';

export type GameClientCallbacks = {
    onConnect?: (playerId: string) => void;
    onDisconnect?: () => void;
    onGameState?: (state: NetworkGameState) => void;
    onPlayerJoined?: (player: NetworkPlayer) => void;
    onPlayerMoved?: (player: NetworkPlayer) => void;
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
    private playerId: string = '';
    private playerName: string = '';
    private isReady: boolean = false;
    private callbacks: GameClientCallbacks = {};
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(private serverUrl: string) {
        this.socket = io(this.serverUrl);
    }

    public connect(callbacks: GameClientCallbacks = {}): void {
        this.callbacks = callbacks;

        if (!this.socket) {
            this.socket = io(this.serverUrl);
        }

        this.socket.on(SocketEvents.Connect, () => {
            if (this.socket?.id) {
                this.playerId = this.socket.id;
                this.callbacks.onConnect?.(this.playerId);
            }
        });

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

        this.socket.on(SocketEvents.Disconnect, () => {
            this.callbacks.onDisconnect?.();
        });

        this.socket.on(SocketEvents.GameState, (state: NetworkGameState) => {
            this.callbacks.onGameState?.(state);
        });

        this.socket.on(SocketEvents.PlayerJoined, (player: NetworkPlayer) => {
            this.callbacks.onPlayerJoined?.(player);
        });

        this.socket.on(SocketEvents.PlayerMoved, (player: NetworkPlayer) => {
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
        if (this.socket) {
            this.socket.emit(SocketEvents.PlayerUpdate, {
                ...data,
                name: this.playerName,
                isReady: this.isReady
            });
        }
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

    public getId(): string | null {
        return this.playerId;
    }

    public setPlayerName(name: string): void {
        this.playerName = name;
        this.socket?.emit(SocketEvents.SetPlayerName, name);
    }

    public setReady(ready: boolean) {
        this.isReady = ready;
        this.updatePlayer({
            id: this.playerId,
            position: { x: 0, y: 0 },
            rotation: 0,
            velocity: { x: 0, y: 0 },
            isCharging: false,
            chargePower: 0,
            name: this.playerName,
            isReady: ready
        });
    }

    public signalDeliveryComplete(points: number): void {
        this.socket?.emit(SocketEvents.DeliveryComplete, {
            playerId: this.playerId,
            points
        });
    }
}