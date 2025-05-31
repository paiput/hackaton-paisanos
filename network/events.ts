export enum SocketEvents {
    // Connection events
    Connect = 'connect',
    Disconnect = 'disconnect',

    // Game state events
    GameState = 'gameState',
    PlayerJoined = 'playerJoined',
    PlayerLeft = 'playerLeft',
    
    // Player actions
    Move = 'move',
    PlayerMoved = 'playerMoved',
    Shoot = 'shoot',
    PlayerShot = 'playerShot',
    
    // Network diagnostics
    PingEvent = 'ping_event',
    PongEvent = 'pong_event'
} 