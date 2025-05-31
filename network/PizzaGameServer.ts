import { Server, Socket } from 'socket.io';
import http from 'http';
import { NetworkGameState, NetworkPlayer, PlayerUpdateEvent, ThrowPizzaEvent, GameStartEvent, GameOverEvent, PlayerCollisionEvent } from './pizza-game-types';
import { SocketEvents } from './events';
import { Vector2, Pizza, DeliveryPoint, Vehicle, Building, Route } from '../types/game';
import { generateCity, generateDeliveryPoints, generateVehicles } from '../utils/generators';

const GAME_DURATION = 300; // 5 minutos
const TOTAL_PIZZAS = 15;
const REQUIRED_DELIVERIES = 10;
const CITY_WIDTH = 2400;
const CITY_HEIGHT = 1600;

export class PizzaGameServer {
    private io: Server;
    private gameState: NetworkGameState;
    private readyPlayers: Set<string>;
    private gameLoopInterval: NodeJS.Timeout | null = null;
    private vehicleUpdateInterval: NodeJS.Timeout | null = null;

    constructor(httpServer: http.Server) {
        this.gameState = {
            players: {},
            pizzas: [],
            deliveryPoints: [],
            vehicles: [],
            buildings: [],
            timeLeft: GAME_DURATION,
            gameStarted: false,
            gameOver: false
        };
        
        this.readyPlayers = new Set();
        
        this.io = new Server(httpServer, {
            cors: {
                origin: "*", // Configurar apropiadamente para producción
                methods: ["GET", "POST"],
            },
        });

        this.setupSocketHandlers();
    }

    private setupSocketHandlers(): void {
        this.io.on(SocketEvents.Connect, (socket: Socket) => {
            console.log(`Player connected: ${socket.id}`);
            this.handlePlayerJoin(socket);

            socket.on(SocketEvents.PlayerUpdate, (data: PlayerUpdateEvent) => this.handlePlayerUpdate(socket, data));
            socket.on(SocketEvents.ThrowPizza, (data: ThrowPizzaEvent) => this.handleThrowPizza(socket, data));
            socket.on(SocketEvents.PlayerCharge, (data: { isCharging: boolean, power: number }) => this.handlePlayerCharge(socket, data));
            socket.on(SocketEvents.PlayerBrake, (data: { isBraking: boolean }) => this.handlePlayerBrake(socket, data));
            socket.on(SocketEvents.ReadyToStart, () => this.handlePlayerReady(socket));
            socket.on(SocketEvents.GameReset, () => this.handleGameReset(socket));
            socket.on(SocketEvents.PingEvent, (startTime: number) => this.handlePing(socket, startTime));
            socket.on(SocketEvents.Disconnect, () => this.handlePlayerDisconnect(socket));
            socket.on(SocketEvents.SetPlayerName, (name: string) => this.handleSetPlayerName(socket, name));
        });
    }

    private handlePlayerJoin(socket: Socket): void {
        // Crear nuevo jugador con posición aleatoria
        const startX = Math.random() * (CITY_WIDTH - 100) + 50;
        const startY = Math.random() * (CITY_HEIGHT - 100) + 50;
        console.log(`Player joined: ${socket.id} at position (${startX}, ${startY})`);
        console.log('Current players:', Object.keys(this.gameState.players));

        const player: NetworkPlayer = {
            id: socket.id,
            name: `Player ${socket.id.slice(0, 4)}`,  // Default name until player sets it
            position: { x: startX, y: startY },
            velocity: { x: 0, y: 0 },
            rotation: 0,
            size: { x: 20, y: 12 },
            isCharging: false,
            chargePower: 0,
            stunned: 0,
            pizzasRemaining: TOTAL_PIZZAS,
            deliveriesCompleted: 0,
            isBraking: false,
            currentSpeed: 2.0,
            maxSpeed: 2.0,
            score: 0
        };

        // Agregar jugador al estado del juego
        this.gameState.players[socket.id] = player;
        console.log('Players after join:', Object.keys(this.gameState.players));

        // Enviar estado actual del juego al nuevo jugador
        socket.emit(SocketEvents.GameState, this.gameState);

        // Notificar a otros jugadores
        socket.broadcast.emit(SocketEvents.PlayerJoined, player);
    }

    private handlePlayerUpdate(socket: Socket, data: PlayerUpdateEvent): void {
        const player = this.gameState.players[socket.id];
        if (!player) {
            console.log('Player not found for update:', socket.id);
            return;
        }

        // Actualizar estado del jugador
        player.position = data.position;
        player.rotation = data.rotation;
        player.velocity = data.velocity;
        player.isCharging = data.isCharging;
        player.chargePower = data.chargePower;

        // Log the update
        console.log(`Player ${socket.id} updated:`, {
            position: player.position,
            rotation: player.rotation
        });

        // Broadcast actualización a otros jugadores
        socket.broadcast.emit(SocketEvents.PlayerUpdate, {
            ...data,
            id: socket.id  // Ensure we're sending the correct ID
        });
    }

    private handleThrowPizza(socket: Socket, data: ThrowPizzaEvent): void {
        const player = this.gameState.players[socket.id];
        if (!player || player.pizzasRemaining <= 0) return;

        // Crear nueva pizza
        const pizza: Pizza = {
            position: data.position,
            velocity: data.velocity,
            active: true,
            delivered: false,
            sliding: true,
            playerId: socket.id
        };

        // Agregar pizza al juego
        this.gameState.pizzas.push(pizza);
        player.pizzasRemaining--;

        // Broadcast lanzamiento a todos los jugadores
        this.io.emit(SocketEvents.ThrowPizza, data);
    }

    private handlePlayerCharge(socket: Socket, data: { isCharging: boolean, power: number }): void {
        const player = this.gameState.players[socket.id];
        if (!player) return;

        player.isCharging = data.isCharging;
        player.chargePower = data.power;

        // Broadcast estado de carga a otros jugadores
        socket.broadcast.emit(SocketEvents.PlayerCharge, { playerId: socket.id, ...data });
    }

    private handlePlayerBrake(socket: Socket, data: { isBraking: boolean }): void {
        const player = this.gameState.players[socket.id];
        if (!player) return;

        player.isBraking = data.isBraking;

        // Broadcast estado de freno a otros jugadores
        socket.broadcast.emit(SocketEvents.PlayerBrake, { playerId: socket.id, isBraking: data.isBraking });
    }

    private handlePlayerReady(socket: Socket): void {
        this.readyPlayers.add(socket.id);

        // Si todos los jugadores están listos, iniciar juego
        if (this.readyPlayers.size === Object.keys(this.gameState.players).length) {
            this.startGame();
        }
    }

    private handleGameReset(socket: Socket): void {
        // Reiniciar estado del juego
        this.gameState = {
            players: {},
            pizzas: [],
            deliveryPoints: [],
            vehicles: [],
            buildings: [],
            timeLeft: GAME_DURATION,
            gameStarted: false,
            gameOver: false
        };

        this.readyPlayers.clear();
        this.stopGameLoop();

        // Notificar a todos los jugadores
        this.io.emit(SocketEvents.GameReset);
    }

    private handlePing(socket: Socket, startTime: number): void {
        socket.emit(SocketEvents.PongEvent, startTime);
    }

    private handlePlayerDisconnect(socket: Socket): void {
        console.log(`Player disconnected: ${socket.id}`);
        delete this.gameState.players[socket.id];
        this.readyPlayers.delete(socket.id);
        this.io.emit(SocketEvents.PlayerLeft, socket.id);

        // Si no quedan jugadores, reiniciar juego
        if (Object.keys(this.gameState.players).length === 0) {
            this.handleGameReset(socket);
        }
    }

    private handleSetPlayerName(socket: Socket, name: string): void {
        const player = this.gameState.players[socket.id];
        if (!player) return;

        // Update player name
        player.name = name.trim() || player.name;  // Use existing name if new name is empty

        // Notify all clients about the name change
        this.io.emit(SocketEvents.PlayerUpdate, {
            id: socket.id,
            position: player.position,
            rotation: player.rotation,
            velocity: player.velocity,
            isCharging: player.isCharging,
            chargePower: player.chargePower,
            name: player.name
        });
    }

    private startGame(): void {
        // Generar elementos del juego
        this.gameState.buildings = generateCity();
        this.gameState.deliveryPoints = generateDeliveryPoints(this.gameState.buildings);
        this.gameState.vehicles = generateVehicles(this.gameState.buildings);
        this.gameState.timeLeft = GAME_DURATION;
        this.gameState.gameStarted = true;
        this.gameState.gameOver = false;

        // Notificar inicio del juego a todos los jugadores
        const startEvent: GameStartEvent = {
            buildings: this.gameState.buildings,
            deliveryPoints: this.gameState.deliveryPoints,
            vehicles: this.gameState.vehicles,
            timeLeft: GAME_DURATION
        };
        this.io.emit(SocketEvents.GameStart, startEvent);

        // Iniciar game loop
        this.startGameLoop();
    }

    private startGameLoop(): void {
        // Game loop principal (60 FPS)
        this.gameLoopInterval = setInterval(() => {
            if (!this.gameState.gameStarted || this.gameState.gameOver) {
                this.stopGameLoop();
                return;
            }

            // Actualizar tiempo
            this.gameState.timeLeft -= 1/60;

            // Verificar fin del juego
            if (this.gameState.timeLeft <= 0) {
                this.endGame();
                return;
            }

            // Actualizar pizzas
            this.updatePizzas();

            // Broadcast estado de pizzas
            this.io.emit(SocketEvents.PizzaUpdate, { pizzas: this.gameState.pizzas });

        }, 1000/60);

        // Actualización de vehículos (10 FPS)
        this.vehicleUpdateInterval = setInterval(() => {
            if (this.gameState.gameStarted && !this.gameState.gameOver) {
                this.updateVehicles();
                this.io.emit(SocketEvents.VehicleUpdate, { vehicles: this.gameState.vehicles });
            }
        }, 1000/10);
    }

    private stopGameLoop(): void {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        if (this.vehicleUpdateInterval) {
            clearInterval(this.vehicleUpdateInterval);
            this.vehicleUpdateInterval = null;
        }
    }

    private updatePizzas(): void {
        this.gameState.pizzas = this.gameState.pizzas.filter(pizza => {
            if (!pizza.active) return false;

            // Actualizar posición
            pizza.position.x += pizza.velocity.x;
            pizza.position.y += pizza.velocity.y;

            // Aplicar fricción
            pizza.velocity.x *= 0.98;
            pizza.velocity.y *= 0.98;

            // Verificar colisiones con edificios
            for (const building of this.gameState.buildings) {
                if (this.checkPizzaBuildingCollision(pizza, building)) {
                    this.handlePizzaCollision(pizza);
                    break;
                }
            }

            // Verificar colisiones con vehículos
            for (const vehicle of this.gameState.vehicles) {
                if (this.checkPizzaVehicleCollision(pizza, vehicle)) {
                    this.handlePizzaCollision(pizza);
                    break;
                }
            }

            // Verificar entrega
            if (pizza.sliding) {
                const speed = Math.sqrt(pizza.velocity.x * pizza.velocity.x + pizza.velocity.y * pizza.velocity.y);
                if (speed < 0.35) {
                    pizza.sliding = false;
                    this.checkPizzaDelivery(pizza);
                    return false;
                }
            }

            // Verificar límites del mundo
            if (pizza.position.x < 0 || pizza.position.x > CITY_WIDTH ||
                pizza.position.y < 0 || pizza.position.y > CITY_HEIGHT) {
                return false;
            }

            return true;
        });
    }

    private updateVehicles(): void {
        for (const vehicle of this.gameState.vehicles) {
            // Actualizar posición según ruta
            const nextPoint = vehicle.route.points[vehicle.route.currentPointIndex];
            const dx = nextPoint.x - vehicle.position.x;
            const dy = nextPoint.y - vehicle.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 30) {
                // Avanzar al siguiente punto
                vehicle.route.currentPointIndex = (vehicle.route.currentPointIndex + 1) % vehicle.route.points.length;
            } else {
                // Mover hacia el punto actual
                const speed = vehicle.speed;
                vehicle.velocity.x = (dx / distance) * speed;
                vehicle.velocity.y = (dy / distance) * speed;
                vehicle.position.x += vehicle.velocity.x;
                vehicle.position.y += vehicle.velocity.y;
                vehicle.rotation = Math.atan2(vehicle.velocity.y, vehicle.velocity.x);
            }
        }
    }

    private checkPizzaBuildingCollision(pizza: Pizza, building: Building): boolean {
        return pizza.position.x > building.x &&
               pizza.position.x < building.x + building.width &&
               pizza.position.y > building.y &&
               pizza.position.y < building.y + building.height;
    }

    private checkPizzaVehicleCollision(pizza: Pizza, vehicle: Vehicle): boolean {
        const dx = pizza.position.x - vehicle.position.x;
        const dy = pizza.position.y - vehicle.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (vehicle.size.x + vehicle.size.y) / 4;
    }

    private handlePizzaCollision(pizza: Pizza): void {
        // Invertir velocidad y reducir por fricción
        pizza.velocity.x *= -0.7;
        pizza.velocity.y *= -0.7;
    }

    private checkPizzaDelivery(pizza: Pizza): void {
        const activePoint = this.gameState.deliveryPoints.find(point => point.active);
        if (!activePoint) return;

        const dx = pizza.position.x - activePoint.position.x;
        const dy = pizza.position.y - activePoint.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= activePoint.radius) {
            // Entrega exitosa
            pizza.delivered = true;
            activePoint.active = false;

            // Calcular puntos
            const accuracy = 1 - (distance / activePoint.radius);
            const points = Math.floor(accuracy * 150) + 50;

            // Actualizar siguiente punto de entrega
            const nextPointIndex = this.gameState.deliveryPoints.indexOf(activePoint) + 1;
            if (nextPointIndex < this.gameState.deliveryPoints.length) {
                this.gameState.deliveryPoints[nextPointIndex].active = true;
            }

            // Notificar entrega exitosa
            this.io.emit(SocketEvents.DeliveryComplete, {
                playerId: pizza.playerId,
                points: points
            });
        }
    }

    private endGame(): void {
        this.gameState.gameOver = true;
        this.stopGameLoop();

        // Recopilar resultados
        const scores: { [playerId: string]: number } = {};
        const deliveries: { [playerId: string]: number } = {};

        for (const [playerId, player] of Object.entries(this.gameState.players)) {
            scores[playerId] = player.score;
            deliveries[playerId] = player.deliveriesCompleted;
        }

        // Notificar fin del juego
        this.io.emit(SocketEvents.GameOver, { scores, deliveries });
    }

    public start(port: number = 3001): void {
        const serverPort = Number(process.env.SOCKET_PORT) || port;
        this.io.listen(serverPort);
        console.log(`Pizza Delivery Game server listening on port ${serverPort}`);
    }
} 