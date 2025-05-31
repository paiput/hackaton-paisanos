import { Server, Socket } from 'socket.io';
import http from 'http';

// Definir constantes del mundo y jugador (compartidas conceptualmente con el cliente)
const PLAYER_SIZE = 25;
const WORLD_MIN_X = -500;
const WORLD_MAX_X = 500;
const WORLD_MIN_Y = -500;
const WORLD_MAX_Y = 500;
// El span total es Max - Min
const WORLD_WIDTH_SPAN = WORLD_MAX_X - WORLD_MIN_X; 
const WORLD_HEIGHT_SPAN = WORLD_MAX_Y - WORLD_MIN_Y;

// Define a simple Player interface
interface Player {
    id: string;
    x: number;
    y: number;
    lastShotTime: number;
}

// Define the GameState interface
interface GameState {
    players: { [id: string]: Player };
}

// Initialize the game state
const gameState: GameState = {
    players: {},
};

// Create an HTTP server
const httpServer = http.createServer((req, res) => {
    if (req.url === '/ping') {
        res.writeHead(200);
        res.end('pong');
        return;
    }
});


// Initialize Socket.IO server
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for development. Adjust for production.
        methods: ["GET", "POST"],
    },
});

io.on('connection', (socket: Socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add new player to game state
    gameState.players[socket.id] = {
        id: socket.id,
        // Posición inicial aleatoria dentro de los nuevos límites
        x: Math.floor(Math.random() * WORLD_WIDTH_SPAN + WORLD_MIN_X),
        y: Math.floor(Math.random() * WORLD_HEIGHT_SPAN + WORLD_MIN_Y),
        lastShotTime: 0,
    };

    // Asegurarse que la posición inicial respete los límites considerando el tamaño del jugador
    gameState.players[socket.id].x = Math.max(WORLD_MIN_X, Math.min(gameState.players[socket.id].x, WORLD_MAX_X - PLAYER_SIZE));
    gameState.players[socket.id].y = Math.max(WORLD_MIN_Y, Math.min(gameState.players[socket.id].y, WORLD_MAX_Y - PLAYER_SIZE));

    // Send current game state to the newly connected player
    socket.emit('gameState', gameState);

    // Broadcast new player to all other players
    socket.broadcast.emit('playerJoined', gameState.players[socket.id]);

    // Handle player movement
    socket.on('move', (data: { x: number; y: number }) => {
        const player = gameState.players[socket.id];
        if (player) {
            // El servidor es la autoridad y debe validar los movimientos.
            // Por ahora, confiamos en el cliente, pero aquí se aplicarían los límites.
            player.x = Math.max(WORLD_MIN_X, Math.min(data.x, WORLD_MAX_X - PLAYER_SIZE));
            player.y = Math.max(WORLD_MIN_Y, Math.min(data.y, WORLD_MAX_Y - PLAYER_SIZE));
            // Broadcast updated player position to all players
            io.emit('playerMoved', player);
        }
    });

    // Handle player shooting
    socket.on('shoot', (data: { angle?: number }) => { // Añadir angle como opcional
        const player = gameState.players[socket.id];
        if (player) {
            const currentTime = Date.now();
            if (currentTime - player.lastShotTime > 1000) { // 1-second cooldown
                player.lastShotTime = currentTime;
                console.log(`Player ${socket.id} shot at angle: ${data.angle}`);
                // Broadcast shot event to all players
                io.emit('playerShot', { playerId: socket.id, angle: data.angle });
            }
        }
    });

    // Handle ping from client
    socket.on('ping_event', (startTime: number) => {
        console.log(`[Server] Received ping_event from ${socket.id} with startTime: ${startTime}`);
        socket.emit('pong_event', startTime);
        console.log(`[Server] Sent pong_event to ${socket.id}`);
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete gameState.players[socket.id];
        // Broadcast player disconnection to all other players
        io.emit('playerLeft', socket.id);
    });
});

const PORT = Number(process.env.SOCKET_PORT) || 5001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});




