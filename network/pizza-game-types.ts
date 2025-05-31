import { Vector2, GameObject, Pizza, DeliveryPoint, Vehicle, Building, Route } from '../types/game';

// Estado del jugador en red
export interface NetworkPlayer {
    id: string;
    name: string;
    position: Vector2;
    velocity: Vector2;
    rotation: number;
    size: Vector2;
    isCharging: boolean;
    chargePower: number;
    stunned: number;
    pizzasRemaining: number;
    deliveriesCompleted: number;
    isBraking: boolean;
    currentSpeed: number;
    maxSpeed: number;
    score: number;
    isReady: boolean;
}

// Estado completo del juego en red
export interface NetworkGameState {
    players: { [id: string]: NetworkPlayer };
    pizzas: Pizza[];
    deliveryPoints: DeliveryPoint[];
    vehicles: Vehicle[];
    buildings: Building[];
    timeLeft: number;
    gameStarted: boolean;
    gameOver: boolean;
}

// Eventos específicos del juego
export interface PlayerUpdateEvent {
    id: string;
    position: Vector2;
    rotation: number;
    velocity: Vector2;
    isCharging: boolean;
    chargePower: number;
    name?: string;
    isReady: boolean;
}

export interface ThrowPizzaEvent {
    playerId: string;
    position: Vector2;
    velocity: Vector2;
}

export interface PizzaUpdateEvent {
    pizzas: Pizza[];
}

export interface VehicleUpdateEvent {
    vehicles: Vehicle[];
}

export interface GameStartEvent {
    buildings: Building[];
    deliveryPoints: DeliveryPoint[];
    vehicles: Vehicle[];
    timeLeft: number;
}

export interface GameOverEvent {
    scores: { [playerId: string]: number };
    deliveries: { [playerId: string]: number };
}

export interface PlayerCollisionEvent {
    playerId: string;
    type: 'building' | 'vehicle';
    position: Vector2;
}