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
    PongEvent = 'pong_event',

    // Pizza Game specific events
    GameStart = 'game_start',
    GameOver = 'game_over',
    PlayerUpdate = 'player_update',
    ThrowPizza = 'throw_pizza',
    PizzaUpdate = 'pizza_update',
    VehicleUpdate = 'vehicle_update',
    PlayerCollision = 'player_collision',
    PlayerCharge = 'player_charge',
    PlayerBrake = 'player_brake',
    DeliveryComplete = 'delivery_complete',
    ReadyToStart = 'ready_to_start',
    GameReset = 'game_reset'
} 