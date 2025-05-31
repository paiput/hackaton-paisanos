// Definición de vector 2D para posiciones y velocidades
export interface Vector2 {
  x: number;
  y: number;
}

// Objeto base del juego con propiedades físicas
export interface GameObject {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: Vector2;
}

// Pizza lanzada por el jugador
export interface Pizza {
  position: Vector2;
  velocity: Vector2;
  active: boolean; // Si la pizza está en juego
  delivered: boolean; // Si fue entregada exitosamente
  sliding: boolean; // Si aún se está deslizando
  playerId?: string; // ID del jugador que lanzó la pizza
}

// Punto de entrega en el mapa
export interface DeliveryPoint {
  position: Vector2;
  active: boolean; // Si es el objetivo actual
  radius: number; // Radio del área de entrega
}

// Vehículos que se mueven por la ciudad
export interface Vehicle {
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  size: Vector2;
  type: "car" | "truck"; // Tipo de vehículo
  color: string; // Color del sprite
  speed: number;
  targetDirection: Vector2; // Dirección objetivo
  lastIntersection: Vector2; // Última intersección visitada
  route: Route; // Nueva propiedad para la ruta
  routeProgress: number; // Progreso en la ruta actual
  minDistanceToOtherVehicles: number; // Distancia mínima a otros vehículos
}

// Nueva interfaz para las rutas
export interface Route {
  points: Vector2[]; // Puntos de la ruta
  type: "circular" | "linear" | "random"; // Tipo de ruta
  currentPointIndex: number; // Índice del punto actual
  isLooping: boolean; // Si la ruta es circular
}

// Edificios y decoraciones de la ciudad
export interface Building {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "building" | "decoration";
  style: number; // Variante de estilo para edificios
}

// Estado completo del juego
export interface GameState {
  player: GameObject;
  pizzas: Pizza[];
  deliveryPoints: DeliveryPoint[];
  vehicles: Vehicle[];
  buildings: Building[];
  currentDelivery: number;
  score: number;
  timeLeft: number;
  gameStarted: boolean;
  gameOver: boolean;
  isCharging: boolean;
  chargePower: number;
  stunned: number;
  mousePos: Vector2;
  pizzasRemaining: number;
  deliveriesCompleted: number;
  playerPreviousRotation: number;
  isBraking: boolean;
  brakeCooldown: number;
  currentSpeed: number;
  isTurning: boolean;
  turnFrictionPhase: "idle" | "decelerating" | "accelerating";
  turnFrictionTimer: number;
  collisionRecoveryTimer: number;
  speedLevel: "min" | "normal" | "max";
  targetSpeed: number;
  spinTimer: number; // frames restantes de giro
  spinCount: number; // vueltas restantes
  targetMaxSpeed: number;
  spinAngularSpeed: number; // velocidad angular actual
  maxSpeed: number; // velocidad máxima alcanzable actual
} 