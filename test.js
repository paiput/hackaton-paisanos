const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer((req, res) => {
  res.end("Socket.IO server is running");
});

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Client connected");
});

server.listen(5000, "192.168.1.52", () => {
  console.log("🚀 Escuchando en http://192.168.1.52:5000");
});
