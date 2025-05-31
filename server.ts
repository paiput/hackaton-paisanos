import http from 'http';
import express from 'express';
import { PizzaGameServer } from './network/PizzaGameServer';

const app = express();
const server = http.createServer(app);

// Configurar CORS y otros middlewares si es necesario
app.use(express.json());

// Crear y arrancar el servidor de juego
const gameServer = new PizzaGameServer(server);
const PORT = Number(process.env.SOCKET_PORT) || 5001;
gameServer.start(PORT);