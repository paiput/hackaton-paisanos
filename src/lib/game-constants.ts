// ===== CONSTANTES DEL JUEGO =====
export const CANVAS_WIDTH = 1200 // Ancho del canvas
export const CANVAS_HEIGHT = 800 // Alto del canvas
export const CITY_WIDTH = 2400 // Ancho total de la ciudad
export const CITY_HEIGHT = 1600 // Alto total de la ciudad
export const PLAYER_SPEED = 2.0 // Velocidad base reducida
export const PLAYER_TURN_SPEED = 0.06 // Sensibilidad de giro reducida
export const PLAYER_BRAKE_SPEED = 0.8 // Velocidad durante el frenado
export const PLAYER_BRAKE_DURATION = 120 // Duración máxima del frenado en frames (2 segundos)
export const PLAYER_BRAKE_COOLDOWN = 600 // Tiempo de espera entre frenados en frames (10 segundos)
export const MAX_CHARGE_POWER = 15 // Máxima potencia de lanzamiento
export const STUN_DURATION = 60 // Duración del aturdimiento reducida (1 segundo)
export const GAME_DURATION = 300 // Duración del juego en segundos
export const TOTAL_PIZZAS = 15 // Total de pizzas disponibles
export const REQUIRED_DELIVERIES = 10 // Entregas necesarias para ganar
export const BLOCK_SIZE = 200 // Tamaño de cada bloque de ciudad
export const STREET_WIDTH = 100 // Ancho de las calles (aumentado de 60 a 100)
export const CAMERA_ZOOM = 1.3 // Factor de zoom de la cámara (nuevo)
export const RECOVERY_SPEED = 0.08 // Velocidad de recuperación aumentada

// Constantes para el sistema de rutas
export const ROUTE_TYPES = {
  CIRCULAR: 'circular',
  LINEAR: 'linear',
  RANDOM: 'random',
} as const

export const MIN_VEHICLE_DISTANCE = 50 // Distancia mínima entre vehículos
export const ROUTE_UPDATE_INTERVAL = 60 // Frames entre actualizaciones de ruta
export const ROUTE_POINT_RADIUS = 30 // Radio para considerar que se alcanzó un punto
