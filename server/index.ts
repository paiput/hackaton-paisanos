import http from 'http';
import { GameServer } from './network/GameServer';

// Create HTTP server
const httpServer = http.createServer((req, res) => {
    if (req.url === '/ping') {
        res.writeHead(200);
        res.end('pong');
        return;
    }
});

// Create and start game server
const gameServer = new GameServer(httpServer);
gameServer.start(); 