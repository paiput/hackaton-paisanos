export interface Player {
  id: string
  name: string
  x: number
  y: number
  color: string
  last_seen: string
  created_at: string
}

export interface GameState {
  players: Player[]
  currentPlayer: Player | null
}
