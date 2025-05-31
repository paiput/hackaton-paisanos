import { Server, Socket } from 'socket.io';
import http from 'http';
import { 
    GameState, 
    Player, 
    MoveEvent, 
    ShootEvent,
    WORLD_MIN_X,
    WORLD_MAX_X,
    WORLD_MIN_Y,
    WORLD_MAX_Y,
    WORLD_WIDTH_SPAN,
    WORLD_HEIGHT_SPAN,
    PLAYER_SIZE
} from './types';
import { SocketEvents } from './events';

export class GameServer {
    private io: Server;
    private gameState: GameState;
    private readonly SHOT_COOLDOWN = 1000; // 1 second

    constructor(httpServer: http.Server) {
        this.gameState = { players: {} };
        
        this.io = new Server(httpServer, {
            cors: {
                origin: "*", // Configure appropriately for production
                methods: ["GET", "POST"],
            },
        });

        this.setupSocketHandlers();
    }

    private setupSocketHandlers(): void {
        this.io.on(SocketEvents.Connect, (socket: Socket) => {
            console.log(`Player connected: ${socket.id}`);
            this.handlePlayerJoin(socket);

            socket.on(SocketEvents.Move, (data: MoveEvent) => this.handlePlayerMove(socket, data));
            socket.on(SocketEvents.Shoot, (data: ShootEvent) => this.handlePlayerShoot(socket, data));
            socket.on(SocketEvents.PingEvent, (startTime: number) => this.handlePing(socket, startTime));
            socket.on(SocketEvents.Disconnect, () => this.handlePlayerDisconnect(socket));
        });
    }

    private handlePlayerJoin(socket: Socket): void {
        // Create new player with random position
        const player: Player = {
            id: socket.id,
            x: Math.floor(Math.random() * WORLD_WIDTH_SPAN + WORLD_MIN_X),
            y: Math.floor(Math.random() * WORLD_HEIGHT_SPAN + WORLD_MIN_Y),
            lastShotTime: 0,
        };

        // Ensure player position respects boundaries
        player.x = Math.max(WORLD_MIN_X, Math.min(player.x, WORLD_MAX_X - PLAYER_SIZE));
        player.y = Math.max(WORLD_MIN_Y, Math.min(player.y, WORLD_MAX_Y - PLAYER_SIZE));

        // Add player to game state
        this.gameState.players[socket.id] = player;

        // Send current game state to new player
        socket.emit(SocketEvents.GameState, this.gameState);

        // Broadcast new player to others
        socket.broadcast.emit(SocketEvents.PlayerJoined, player);
    }

    private handlePlayerMove(socket: Socket, data: MoveEvent): void {
        const player = this.gameState.players[socket.id];
        if (!player) return;

        // Update player position with boundary checks
        player.x = Math.max(WORLD_MIN_X, Math.min(data.x, WORLD_MAX_X - PLAYER_SIZE));
        player.y = Math.max(WORLD_MIN_Y, Math.min(data.y, WORLD_MAX_Y - PLAYER_SIZE));

        // Broadcast updated position
        this.io.emit(SocketEvents.PlayerMoved, player);
    }

    private handlePlayerShoot(socket: Socket, data: ShootEvent): void {
        const player = this.gameState.players[socket.id];
        if (!player) return;

        const currentTime = Date.now();
        if (currentTime - player.lastShotTime > this.SHOT_COOLDOWN) {
            player.lastShotTime = currentTime;
            console.log(`Player ${socket.id} shot at angle: ${data.angle}`);
            this.io.emit(SocketEvents.PlayerShot, { playerId: socket.id, angle: data.angle });
        }
    }

    private handlePing(socket: Socket, startTime: number): void {
        console.log(`[Server] Received ping_event from ${socket.id} with startTime: ${startTime}`);
        socket.emit(SocketEvents.PongEvent, startTime);
        console.log(`[Server] Sent pong_event to ${socket.id}`);
    }

    private handlePlayerDisconnect(socket: Socket): void {
        console.log(`Player disconnected: ${socket.id}`);
        delete this.gameState.players[socket.id];
        this.io.emit(SocketEvents.PlayerLeft, socket.id);
    }

    public start(port: number = 5000): void {
        const serverPort = Number(process.env.SOCKET_PORT) || port;
        this.io.listen(serverPort);
        console.log(`Game server listening on port ${serverPort}`);
    }
} 