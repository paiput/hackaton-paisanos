// Game world constants
export const PLAYER_SIZE = 25;
export const WORLD_MIN_X = -500;
export const WORLD_MAX_X = 500;
export const WORLD_MIN_Y = -500;
export const WORLD_MAX_Y = 500;
export const WORLD_WIDTH_SPAN = WORLD_MAX_X - WORLD_MIN_X;
export const WORLD_HEIGHT_SPAN = WORLD_MAX_Y - WORLD_MIN_Y;

// Player and game state interfaces
export interface Player {
    id: string;
    x: number;
    y: number;
    lastShotTime: number;
}

export interface GameState {
    players: { [id: string]: Player };
}

// Event types
export interface MoveEvent {
    x: number;
    y: number;
}

export interface ShootEvent {
    angle?: number;
}

export interface PlayerShotEvent {
    playerId: string;
    angle?: number;
}

// Client-specific player data
export interface ClientPlayerData extends Player {
    targetX?: number;
    targetY?: number;
} 