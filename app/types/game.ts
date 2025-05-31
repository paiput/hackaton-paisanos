export interface PlayerPosition {
  playerId: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface Shot {
  id: string;
  playerId: string; // Who shot
  x: number; // Initial x
  y: number; // Initial y
  dx: number; // Direction x vector (normalized)
  dy: number; // Direction y vector (normalized)
  spawnTime: number; // Timestamp of when it was fired
  // Potentially add speed, damage, etc. later
}

export interface GameEvent {
  eventId: string;
  type: 'shoot' | 'collision'; // Add other event types as needed
  payload: Shot | any; // Use Shot for shoot events, refine for others
  timestamp: number;
  senderId?: string; // Optional: to identify who sent the event
}

export interface GameRoomState {
  roomId: string;
  players: Record<string, PlayerPosition>;
  // activeShots: Record<string, Shot>; // We can manage shots visually in the component for now
  // Add other game-specific state properties here, e.g., score, game status
} 