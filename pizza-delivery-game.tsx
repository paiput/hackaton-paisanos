"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// ===== INTERFACES Y TIPOS =====
// Definición de vector 2D para posiciones y velocidades
interface Vector2 {
  x: number
  y: number
}

// Objeto base del juego con propiedades físicas
interface GameObject {
  position: Vector2
  velocity: Vector2
  rotation: number
  size: Vector2
}

// Pizza lanzada por el jugador
interface Pizza {
  position: Vector2
  velocity: Vector2
  active: boolean // Si la pizza está en juego
  delivered: boolean // Si fue entregada exitosamente
  sliding: boolean // Si aún se está deslizando
}

// Punto de entrega en el mapa
interface DeliveryPoint {
  position: Vector2
  active: boolean // Si es el objetivo actual
  radius: number // Radio del área de entrega
}

// Vehículos que se mueven por la ciudad
interface Vehicle {
  position: Vector2
  velocity: Vector2
  rotation: number
  size: Vector2
  type: "car" | "truck" // Tipo de vehículo
  color: string // Color del sprite
  speed: number
  targetDirection: Vector2 // Dirección objetivo
  lastIntersection: Vector2 // Última intersección visitada
  route: Route // Nueva propiedad para la ruta
  routeProgress: number // Progreso en la ruta actual
  minDistanceToOtherVehicles: number // Distancia mínima a otros vehículos
}

// Nueva interfaz para las rutas
interface Route {
  points: Vector2[] // Puntos de la ruta
  type: "circular" | "linear" | "random" // Tipo de ruta
  currentPointIndex: number // Índice del punto actual
  isLooping: boolean // Si la ruta es circular
}

// Edificios y decoraciones de la ciudad
interface Building {
  x: number
  y: number
  width: number
  height: number
  type: "building" | "decoration"
  style: number // Variante de estilo para edificios
}

// Estado completo del juego
interface GameState {
  player: GameObject
  pizzas: Pizza[]
  deliveryPoints: DeliveryPoint[]
  vehicles: Vehicle[]
  buildings: Building[]
  currentDelivery: number
  score: number
  timeLeft: number
  gameStarted: boolean
  gameOver: boolean
  isCharging: boolean
  chargePower: number
  stunned: number
  mousePos: Vector2
  pizzasRemaining: number
  deliveriesCompleted: number
  playerPreviousRotation: number
  isBraking: boolean
  brakeCooldown: number
  currentSpeed: number
  isTurning: boolean
  turnFrictionPhase: "idle" | "decelerating" | "accelerating"
  turnFrictionTimer: number
  collisionRecoveryTimer: number
  speedLevel: "min" | "normal" | "max"
  targetSpeed: number
  spinTimer: number // frames restantes de giro
  spinCount: number // vueltas restantes
  targetMaxSpeed: number
  spinAngularSpeed: number; // velocidad angular actual
  maxSpeed: number // velocidad máxima alcanzable actual
}

// ===== CONSTANTES DEL JUEGO =====
const CANVAS_WIDTH = 1200 // Ancho del canvas
const CANVAS_HEIGHT = 800 // Alto del canvas
const CITY_WIDTH = 2400 // Ancho total de la ciudad
const CITY_HEIGHT = 1600 // Alto total de la ciudad
const PLAYER_SPEED_MIN = 0.7;
const PLAYER_SPEED_NORMAL = 2.0;
const PLAYER_SPEED_MAX = 3.2;
const PLAYER_TURN_SPEED = 0.06 // Sensibilidad de giro reducida
const PLAYER_BRAKE_SPEED = 0.8 // Velocidad durante el frenado
const PLAYER_BRAKE_DURATION = 120 // Duración máxima del frenado en frames (2 segundos)
const PLAYER_BRAKE_COOLDOWN = 600 // Tiempo de espera entre frenados en frames (10 segundos)
const MAX_CHARGE_POWER = 15 // Máxima potencia de lanzamiento
const STUN_DURATION = 60 // Duración del aturdimiento reducida (1 segundo)
const GAME_DURATION = 300 // Duración del juego en segundos
const TOTAL_PIZZAS = 15 // Total de pizzas disponibles
const REQUIRED_DELIVERIES = 10 // Entregas necesarias para ganar
const BLOCK_SIZE = 200 // Tamaño de cada bloque de ciudad
const STREET_WIDTH = 100 // Ancho de las calles (aumentado de 60 a 100)
const CAMERA_ZOOM = 1.3 // Factor de zoom de la cámara (nuevo)
const RECOVERY_SPEED = 0.08 // Velocidad de recuperación aumentada
const SPEED_TRANSITION_FRAMES = 90; // 1.5 segundos a 60fps
const SPEED_STEP = 0.56; // ~20 km/h en unidades de tu juego (ajusta según escala)
const SPEED_MIN = 0.7;
const SPEED_MAX = 5.0;

// Constantes para el sistema de rutas
const ROUTE_TYPES = {
  CIRCULAR: "circular",
  LINEAR: "linear",
  RANDOM: "random",
} as const

const MIN_VEHICLE_DISTANCE = 50 // Distancia mínima entre vehículos
const ROUTE_UPDATE_INTERVAL = 60 // Frames entre actualizaciones de ruta
const ROUTE_POINT_RADIUS = 30 // Radio para considerar que se alcanzó un punto

export default function PizzaDeliveryGame() {
  // ===== REFS Y ESTADO =====
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | null>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({ x: 0, y: 0, down: false })

  // Estado de pausa
  const [isPaused, setIsPaused] = useState(false)

  // Estado inicial del juego
  const [gameState, setGameState] = useState<GameState>({
    player: {
      position: { x: CITY_WIDTH / 2, y: CITY_HEIGHT / 2 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      size: { x: 20, y: 12 },
    },
    pizzas: [],
    deliveryPoints: [],
    vehicles: [],
    buildings: [],
    currentDelivery: 0,
    score: 0,
    timeLeft: GAME_DURATION,
    gameStarted: false,
    gameOver: false,
    isCharging: false,
    chargePower: 0,
    stunned: 0,
    mousePos: { x: 0, y: 0 },
    pizzasRemaining: TOTAL_PIZZAS,
    deliveriesCompleted: 0,
    playerPreviousRotation: 0,
    isBraking: false,
    brakeCooldown: 0,
    currentSpeed: PLAYER_SPEED_NORMAL,
    isTurning: false,
    turnFrictionPhase: "idle",
    turnFrictionTimer: 0,
    collisionRecoveryTimer: 0,
    speedLevel: "normal",
    targetSpeed: PLAYER_SPEED_NORMAL,
    spinTimer: 0,
    spinCount: 0,
    targetMaxSpeed: PLAYER_SPEED_NORMAL,
    spinAngularSpeed: 0,
    maxSpeed: PLAYER_SPEED_NORMAL,
  })

  // Cámara que sigue al jugador con zoom
  const camera = useRef<Vector2>({ x: 0, y: 0 })

  // ===== GENERACIÓN DE CIUDAD =====
  /**
   * Genera los edificios y estructura de la ciudad
   * Crea una cuadrícula de bloques con calles entre ellos
   */
  const generateCity = useCallback((): Building[] => {
    const buildings: Building[] = []
    for (let x = 0; x < CITY_WIDTH; x += BLOCK_SIZE) {
      for (let y = 0; y < CITY_HEIGHT; y += BLOCK_SIZE) {
        // Decide aleatoriamente el tipo de manzana
        const type = Math.random()
        if (type < 0.33) {
          // Un solo edificio grande
          buildings.push({
            x: x + STREET_WIDTH / 2,
            y: y + STREET_WIDTH / 2,
            width: BLOCK_SIZE - STREET_WIDTH,
            height: BLOCK_SIZE - STREET_WIDTH,
            type: "building",
            style: Math.floor(Math.random() * 3),
          })
        } else if (type < 0.66) {
          // Dos edificios rectangulares
          buildings.push({
            x: x + STREET_WIDTH / 2,
            y: y + STREET_WIDTH / 2,
            width: (BLOCK_SIZE - STREET_WIDTH) * 0.6,
            height: BLOCK_SIZE - STREET_WIDTH,
            type: "building",
            style: Math.floor(Math.random() * 3),
          })
          buildings.push({
            x: x + STREET_WIDTH / 2 + (BLOCK_SIZE - STREET_WIDTH) * 0.65,
            y: y + STREET_WIDTH / 2,
            width: (BLOCK_SIZE - STREET_WIDTH) * 0.3,
            height: (BLOCK_SIZE - STREET_WIDTH) * 0.7,
            type: "building",
            style: Math.floor(Math.random() * 3),
          })
        } else {
          // Forma L
          buildings.push({
            x: x + STREET_WIDTH / 2,
            y: y + STREET_WIDTH / 2,
            width: (BLOCK_SIZE - STREET_WIDTH) * 0.7,
            height: (BLOCK_SIZE - STREET_WIDTH) * 0.4,
            type: "building",
            style: Math.floor(Math.random() * 3),
          })
          buildings.push({
            x: x + STREET_WIDTH / 2,
            y: y + STREET_WIDTH / 2 + (BLOCK_SIZE - STREET_WIDTH) * 0.45,
            width: (BLOCK_SIZE - STREET_WIDTH) * 0.4,
            height: (BLOCK_SIZE - STREET_WIDTH) * 0.5,
            type: "building",
            style: Math.floor(Math.random() * 3),
          })
        }
        // Puedes agregar decoraciones aquí también
      }
    }
    return buildings
  }, [])

  /**
   * Verifica si una posición está en la calle (no colisiona con edificios)
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @param size - Tamaño del objeto
   * @param buildings - Array de edificios
   */
  const isOnStreet = useCallback((x: number, y: number, size: Vector2, buildings: Building[]): boolean => {
    for (const building of buildings) {
      if (building.type === "building") {
        // Verificar colisión AABB (Axis-Aligned Bounding Box)
        if (
          x - size.x / 2 < building.x + building.width &&
          x + size.x / 2 > building.x &&
          y - size.y / 2 < building.y + building.height &&
          y + size.y / 2 > building.y
        ) {
          return false // Colisión detectada
        }
      }
    }
    return true // No hay colisión, está en la calle
  }, [])

  /**
   * Genera puntos de entrega aleatorios en posiciones válidas (calles)
   */
  const generateDeliveryPoints = useCallback(
    (buildings: Building[]): DeliveryPoint[] => {
      const points: DeliveryPoint[] = []
      let attempts = 0

      while (points.length < REQUIRED_DELIVERIES && attempts < 100) {
        const x = Math.random() * (CITY_WIDTH - 200) + 100
        const y = Math.random() * (CITY_HEIGHT - 200) + 100

        // Verificar que el punto esté en una calle
        if (isOnStreet(x, y, { x: 80, y: 80 }, buildings)) {
          points.push({
            position: { x, y },
            active: points.length === 0, // Solo el primero está activo
            radius: 40,
          })
        }
        attempts++
      }

      return points
    },
    [isOnStreet],
  )

  /**
   * Verifica si hay una calle disponible en una dirección específica
   */
  const isStreetAvailable = useCallback(
    (x: number, y: number, direction: Vector2, buildings: Building[]): boolean => {
      const testDistance = 80 // Aumentar distancia para verificar mejor
      const testX = x + direction.x * testDistance
      const testY = y + direction.y * testDistance

      // Verificar límites del mundo con margen
      if (testX < 50 || testX >= CITY_WIDTH - 50 || testY < 50 || testY >= CITY_HEIGHT - 50) {
        return false
      }

      // Verificar múltiples puntos a lo largo del camino
      for (let i = 0; i <= testDistance; i += 20) {
        const checkX = x + direction.x * i
        const checkY = y + direction.y * i
        if (!isOnStreet(checkX, checkY, { x: 30, y: 20 }, buildings)) {
          return false
        }
      }

      return true
    },
    [isOnStreet],
  )

  /**
   * Encuentra la intersección más cercana
   */
  const findNearestIntersection = useCallback((x: number, y: number): Vector2 => {
    const blockX = Math.round(x / BLOCK_SIZE) * BLOCK_SIZE
    const blockY = Math.round(y / BLOCK_SIZE) * BLOCK_SIZE
    return { x: blockX, y: blockY }
  }, [])

  /**
   * Genera una ruta para un vehículo basada en su posición inicial
   */
  const generateVehicleRoute = useCallback(
    (startPos: Vector2, buildings: Building[]): Route => {
      const points: Vector2[] = []
      const numPoints = 4 // Número fijo de puntos para la ruta

      // Encontrar la intersección más cercana para alinear el vehículo
      const startIntersection = findNearestIntersection(startPos.x, startPos.y)
      points.push(startIntersection)

      // Generar puntos adicionales en líneas rectas
      let currentPos = { ...startIntersection }
      let currentDirection = Math.random() < 0.5 ? { x: 1, y: 0 } : { x: 0, y: 1 } // Comenzar horizontal o vertical

      for (let i = 1; i < numPoints; i++) {
        // Decidir si girar o seguir recto
        const shouldTurn = Math.random() < 0.3 // 30% de probabilidad de girar

        if (shouldTurn) {
          // Girar 90 grados
          if (currentDirection.x !== 0) {
            // Si va horizontal, girar vertical
            currentDirection = { x: 0, y: Math.random() < 0.5 ? 1 : -1 }
          } else {
            // Si va vertical, girar horizontal
            currentDirection = { x: Math.random() < 0.5 ? 1 : -1, y: 0 }
          }
        }

        // Calcular siguiente punto
        const nextPos = {
          x: currentPos.x + currentDirection.x * BLOCK_SIZE,
          y: currentPos.y + currentDirection.y * BLOCK_SIZE,
        }

        // Verificar que el punto esté dentro de los límites y en una calle
        if (
          nextPos.x >= 0 &&
          nextPos.x < CITY_WIDTH &&
          nextPos.y >= 0 &&
          nextPos.y < CITY_HEIGHT &&
          isOnStreet(nextPos.x, nextPos.y, { x: 40, y: 40 }, buildings)
        ) {
          points.push(nextPos)
          currentPos = nextPos
        } else {
          // Si el punto no es válido, invertir dirección
          currentDirection = { x: -currentDirection.x, y: -currentDirection.y }
          i-- // Intentar de nuevo con la nueva dirección
        }
      }

      return {
        points,
        type: "linear",
        currentPointIndex: 0,
        isLooping: true,
      }
    },
    [isOnStreet, findNearestIntersection],
  )

  /**
   * Actualiza la posición de un vehículo siguiendo su ruta
   */
  const updateVehiclePosition = useCallback(
    (vehicle: Vehicle, buildings: Building[], vehicles: Vehicle[]): void => {
      const route = vehicle.route
      if (!route.points.length) return

      const currentPoint = route.points[route.currentPointIndex]
      const dx = currentPoint.x - vehicle.position.x
      const dy = currentPoint.y - vehicle.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Si llegamos al punto actual, avanzar al siguiente
      if (distance < ROUTE_POINT_RADIUS) {
        route.currentPointIndex = (route.currentPointIndex + 1) % route.points.length
      }

      // Calcular dirección hacia el siguiente punto
      const targetPoint = route.points[route.currentPointIndex]
      const targetDx = targetPoint.x - vehicle.position.x
      const targetDy = targetPoint.y - vehicle.position.y

      // Determinar si el movimiento es horizontal o vertical
      const isHorizontal = Math.abs(targetDx) > Math.abs(targetDy)
      const targetDirection = {
        x: isHorizontal ? Math.sign(targetDx) : 0,
        y: isHorizontal ? 0 : Math.sign(targetDy),
      }

      // Actualizar dirección y rotación
      vehicle.targetDirection = targetDirection
      vehicle.rotation = Math.atan2(targetDirection.y, targetDirection.x)

      // Verificar colisiones con otros vehículos
      let shouldSlowDown = false
      for (const otherVehicle of vehicles) {
        if (otherVehicle === vehicle) continue

        const dx = otherVehicle.position.x - vehicle.position.x
        const dy = otherVehicle.position.y - vehicle.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < MIN_VEHICLE_DISTANCE) {
          shouldSlowDown = true
          break
        }
      }

      // Aplicar velocidad
      const speed = shouldSlowDown ? vehicle.speed * 0.5 : vehicle.speed
      vehicle.velocity.x = vehicle.targetDirection.x * speed
      vehicle.velocity.y = vehicle.targetDirection.y * speed

      // Actualizar posición
      const newX = vehicle.position.x + vehicle.velocity.x
      const newY = vehicle.position.y + vehicle.velocity.y

      // Verificar colisiones con edificios
      if (isOnStreet(newX, newY, vehicle.size, buildings)) {
        vehicle.position.x = newX
        vehicle.position.y = newY
      } else {
        // Si hay colisión, buscar una nueva ruta
        vehicle.route = generateVehicleRoute(vehicle.position, buildings)
      }

      // Mantener vehículo dentro de los límites
      vehicle.position.x = Math.max(50, Math.min(CITY_WIDTH - 50, vehicle.position.x))
      vehicle.position.y = Math.max(50, Math.min(CITY_HEIGHT - 50, vehicle.position.y))
    },
    [isOnStreet, generateVehicleRoute],
  )

  // Modificar la función generateVehicles para usar el nuevo sistema de rutas
  const generateVehicles = useCallback(
    (buildings: Building[]): Vehicle[] => {
      const vehicles: Vehicle[] = []
      const colors = ["#ff4444", "#4444ff", "#44ff44", "#ffff44", "#ff44ff", "#44ffff"]
      const types: ("car" | "truck")[] = ["car", "car", "car", "truck"]
      const routeTypes: ("circular" | "linear" | "random")[] = ["circular", "linear", "random"]

      for (let i = 0; i < 15; i++) {
        let attempts = 0
        while (attempts < 50) {
          const x = Math.random() * CITY_WIDTH
          const y = Math.random() * CITY_HEIGHT
          const type = types[Math.floor(Math.random() * types.length)]
          const size = type === "truck" ? { x: 40, y: 20 } : { x: 25, y: 15 }

          if (isOnStreet(x, y, size, buildings)) {
            const routeType = routeTypes[Math.floor(Math.random() * routeTypes.length)]
            const route = generateVehicleRoute({ x, y }, buildings)

            vehicles.push({
              position: { x, y },
              velocity: { x: 0, y: 0 },
              rotation: 0,
              size,
              type,
              color: colors[Math.floor(Math.random() * colors.length)],
              speed: 1 + Math.random() * 0.5,
              targetDirection: { x: 0, y: 0 },
              lastIntersection: { x, y },
              route,
              routeProgress: 0,
              minDistanceToOtherVehicles: MIN_VEHICLE_DISTANCE,
            })
            break
          }
          attempts++
        }
      }
      return vehicles
    },
    [isOnStreet, generateVehicleRoute],
  )

  // ===== INICIALIZACIÓN DEL JUEGO =====
  /**
   * Inicializa un nuevo juego generando la ciudad y colocando elementos
   */
  const initGame = useCallback(() => {
    const buildings = generateCity()
    const deliveryPoints = generateDeliveryPoints(buildings)
    const vehicles = generateVehicles(buildings)

    // Encontrar una posición inicial válida para el jugador
    let startX = CITY_WIDTH / 2
    let startY = CITY_HEIGHT / 2
    let attempts = 0
    while (!isOnStreet(startX, startY, { x: 20, y: 12 }, buildings) && attempts < 100) {
      startX = Math.random() * CITY_WIDTH
      startY = Math.random() * CITY_HEIGHT
      attempts++
    }

    setGameState((prev) => ({
      ...prev,
      player: {
        position: { x: startX, y: startY },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        size: { x: 20, y: 12 },
      },
      pizzas: [],
      deliveryPoints,
      vehicles,
      buildings,
      currentDelivery: 0,
      score: 0,
      timeLeft: GAME_DURATION,
      gameStarted: true,
      gameOver: false,
      isCharging: false,
      chargePower: 0,
      stunned: 0,
      pizzasRemaining: TOTAL_PIZZAS,
      deliveriesCompleted: 0,
      playerPreviousRotation: 0,
      isBraking: false,
      brakeCooldown: 0,
      currentSpeed: PLAYER_SPEED_NORMAL,
      isTurning: false,
      turnFrictionTimer: 0,
      collisionRecoveryTimer: 0,
      speedLevel: "normal",
      targetSpeed: PLAYER_SPEED_NORMAL,
      spinTimer: 0,
      spinCount: 0,
      targetMaxSpeed: PLAYER_SPEED_NORMAL,
      spinAngularSpeed: 0,
      maxSpeed: PLAYER_SPEED_NORMAL,
    }))
    setIsPaused(false)
  }, [generateCity, generateDeliveryPoints, generateVehicles, isOnStreet])

  // ===== MANEJO DE INPUT =====
  /**
   * Configura los event listeners para teclado y mouse
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())

      // Sistema de pausa con ESC
      if (e.key.toLowerCase() === "escape" && gameState.gameStarted && !gameState.gameOver) {
        setIsPaused((prev) => !prev)
      }

      // Sistema de frenado con Shift
      if (e.key.toLowerCase() === "shift" && gameState.gameStarted && !gameState.gameOver) {
        setGameState((prev) => ({
          ...prev,
          isBraking: true,
          brakeCooldown: PLAYER_BRAKE_COOLDOWN,
          maxSpeed: Math.min(SPEED_MAX, prev.maxSpeed + SPEED_STEP)
        }))
      }

      // Sistema de aceleración con Ctrl
      if (e.key.toLowerCase() === "control" && gameState.gameStarted && !gameState.gameOver) {
        setGameState((prev) => ({
          ...prev,
          maxSpeed: Math.max(SPEED_MIN, prev.maxSpeed - SPEED_STEP)
        }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())

      // Liberar freno al soltar Shift
      if (e.key.toLowerCase() === "shift") {
        setGameState((prev) => ({
          ...prev,
          isBraking: false,
        }))
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && !isPaused) {
        // Click izquierdo
        mouseRef.current.down = true
        setGameState((prev) => ({ ...prev, isCharging: true }))
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && !isPaused) {
        // Soltar click izquierdo
        mouseRef.current.down = false
        setGameState((prev) => {
          // Solo lanzar si está cargando, no está aturdido y tiene pizzas
          if (prev.isCharging && prev.stunned <= 0 && prev.pizzasRemaining > 0) {
            // Calcular dirección del lanzamiento (ajustado para el zoom)
            const worldMouseX = (mouseRef.current.x - CANVAS_WIDTH / 2) / CAMERA_ZOOM + prev.player.position.x
            const worldMouseY = (mouseRef.current.y - CANVAS_HEIGHT / 2) / CAMERA_ZOOM + prev.player.position.y

            const dx = worldMouseX - prev.player.position.x
            const dy = worldMouseY - prev.player.position.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 0) {
              const normalizedX = dx / distance
              const normalizedY = dy / distance
              const power = prev.chargePower

              // Crear nueva pizza
              const newPizza: Pizza = {
                position: { ...prev.player.position },
                velocity: {
                  x: normalizedX * power,
                  y: normalizedY * power,
                },
                active: true,
                delivered: false,
                sliding: true,
              }

              return {
                ...prev,
                pizzas: [...prev.pizzas, newPizza],
                isCharging: false,
                chargePower: 0,
                pizzasRemaining: prev.pizzasRemaining - 1,
              }
            }
          }
          return { ...prev, isCharging: false, chargePower: 0 }
        })
      }
    }

    // Registrar event listeners
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [gameState.gameStarted, gameState.gameOver, isPaused])

  /**
   * Verifica colisión entre una pizza y un objeto rectangular
   */
  const checkPizzaRectCollision = useCallback(
    (pizza: Pizza, x: number, y: number, width: number, height: number): boolean => {
      // Encontrar el punto más cercano del rectángulo a la pizza
      const closestX = Math.max(x, Math.min(pizza.position.x, x + width))
      const closestY = Math.max(y, Math.min(pizza.position.y, y + height))

      // Calcular distancia entre la pizza y el punto más cercano
      const distanceX = pizza.position.x - closestX
      const distanceY = pizza.position.y - closestY
      const distanceSquared = distanceX * distanceX + distanceY * distanceY

      // Colisión si la distancia es menor que el radio de la pizza
      return distanceSquared < 64 // Radio de pizza al cuadrado (8^2)
    },
    [],
  )

  /**
   * Calcula el rebote de una pizza al colisionar con un objeto
   */
  const calculatePizzaBounce = useCallback((pizza: Pizza, normalX: number, normalY: number): void => {
    // Normalizar el vector normal
    const length = Math.sqrt(normalX * normalX + normalY * normalY)
    if (length === 0) return

    normalX /= length
    normalY /= length

    // Calcular producto punto entre velocidad y normal
    const dotProduct = pizza.velocity.x * normalX + pizza.velocity.y * normalY

    // Calcular nueva velocidad (reflexión)
    pizza.velocity.x = pizza.velocity.x - 2 * dotProduct * normalX
    pizza.velocity.y = pizza.velocity.y - 2 * dotProduct * normalY

    // Reducir velocidad por fricción
    pizza.velocity.x *= 0.7
    pizza.velocity.y *= 0.7
  }, [])

  // ===== GAME LOOP PRINCIPAL =====
  /**
   * Loop principal del juego que actualiza la lógica a 60 FPS
   */
  useEffect(() => {
    if (!gameState.gameStarted || gameState.gameOver || isPaused) return

    const gameLoop = () => {
      setGameState((prev) => {
        const newState = { ...prev }

        // ===== ACTUALIZAR TIMER =====
        newState.timeLeft -= 1 / 60
        if (
          newState.timeLeft <= 0 ||
          (newState.pizzasRemaining <= 0 && newState.pizzas.filter((p) => p.active).length === 0)
        ) {
          newState.gameOver = true
          return newState
        }

        // ===== ACTUALIZAR FRENADO =====
        if (newState.brakeCooldown > 0) {
          newState.brakeCooldown--
        }

        // Detectar si está girando
        const isTurning = keysRef.current.has("a") || keysRef.current.has("d")

        if (!prev.isTurning && isTurning) {
          // Empezó a girar
          newState.turnFrictionPhase = "decelerating"
          newState.turnFrictionTimer = 15 // 0.25s
        } else if (prev.isTurning && !isTurning) {
          // Dejó de girar
          newState.turnFrictionPhase = "accelerating"
          newState.turnFrictionTimer = 30 // 0.5s
        }

        newState.isTurning = isTurning

        if (newState.turnFrictionPhase === "decelerating") {
          newState.currentSpeed = Math.max(PLAYER_SPEED_MIN, newState.currentSpeed - (PLAYER_SPEED_NORMAL * 0.4) / 15)
          newState.turnFrictionTimer--
          if (newState.turnFrictionTimer <= 0) {
            newState.turnFrictionPhase = "accelerating"
            newState.turnFrictionTimer = 30
          }
        } else if (newState.turnFrictionPhase === "accelerating") {
          newState.currentSpeed = Math.min(PLAYER_SPEED_MAX, newState.currentSpeed + (PLAYER_SPEED_NORMAL * 0.4) / 30)
          newState.turnFrictionTimer--
          if (newState.turnFrictionTimer <= 0) {
            newState.turnFrictionPhase = "idle"
          }
        }

        // Detectar cambios de nivel de velocidad máxima
        if (keysRef.current.has("shift")) {
          newState.targetMaxSpeed = PLAYER_SPEED_MAX;
        } else if (keysRef.current.has("control")) {
          newState.targetMaxSpeed = PLAYER_SPEED_MIN;
        } else {
          newState.targetMaxSpeed = PLAYER_SPEED_NORMAL;
        }

        // Acelera o desacelera progresivamente hacia la nueva velocidad máxima
        if (newState.currentSpeed < newState.maxSpeed) {
          newState.currentSpeed = Math.min(
            newState.maxSpeed,
            newState.currentSpeed + (newState.maxSpeed - newState.currentSpeed) / SPEED_TRANSITION_FRAMES
          );
        } else if (newState.currentSpeed > newState.maxSpeed) {
          newState.currentSpeed = Math.max(
            newState.maxSpeed,
            newState.currentSpeed - (newState.currentSpeed - newState.maxSpeed) / SPEED_TRANSITION_FRAMES
          );
        }

        // TOPE DURO: nunca superar la velocidad máxima
        if (newState.currentSpeed > newState.maxSpeed) {
          newState.currentSpeed = newState.maxSpeed;
        }

        // ===== VERIFICAR CONDICIÓN DE VICTORIA =====
        if (newState.deliveriesCompleted >= REQUIRED_DELIVERIES) {
          newState.gameOver = true
          newState.score += Math.floor(newState.timeLeft * 10) // Bonus por tiempo
          return newState
        }

        // ===== ACTUALIZAR CARGA DE POTENCIA =====
        if (newState.isCharging && newState.stunned <= 0) {
          newState.chargePower += 0.3;
          if (newState.chargePower > MAX_CHARGE_POWER) {
            newState.chargePower = 0; // Reinicia la barra
          }
        }

        // ===== ACTUALIZAR ATURDIMIENTO =====
        if (newState.stunned > 0) {
          newState.stunned--
        }

        // ===== MOVIMIENTO DEL JUGADOR =====
        if (newState.stunned <= 0 && newState.spinCount === 0) {
          // Guardar la rotación actual antes de cualquier cambio
          newState.playerPreviousRotation = newState.player.rotation

          let rotationChange = 0

          // Control de rotación con A/D
          if (keysRef.current.has("a")) rotationChange -= PLAYER_TURN_SPEED
          if (keysRef.current.has("d")) rotationChange += PLAYER_TURN_SPEED
          if (keysRef.current.has("w")) rotationChange += 0 // W no hace nada (siempre avanza)
          if (keysRef.current.has("s")) rotationChange += Math.PI * 0.02 // S hace giro brusco

          newState.player.rotation += rotationChange

          // La moto SIEMPRE se mueve hacia adelante con la velocidad actual
          newState.player.velocity.x = Math.cos(newState.player.rotation) * newState.currentSpeed
          newState.player.velocity.y = Math.sin(newState.player.rotation) * newState.currentSpeed
        } else if (newState.spinCount > 0) {
          // Gira en su lugar y desacelera el giro
          newState.player.rotation += newState.spinAngularSpeed;
          newState.spinAngularSpeed *= 0.97; // desacelera el giro cada frame
          newState.player.velocity.x = 0;
          newState.player.velocity.y = 0;
          newState.spinTimer--;
          if (newState.spinTimer <= 0) {
            newState.spinCount--;
            newState.spinTimer = 60; // siguiente vuelta
            if (newState.spinCount === 0) {
              newState.stunned = 0; // permite input
              newState.spinAngularSpeed = 0;
              newState.currentSpeed = 0; // queda quieto
            }
          }
        } else {
          // Efecto de giro cuando está aturdido (legacy, por si acaso)
          newState.player.rotation += 0.3
          newState.player.velocity.x *= 0.95
          newState.player.velocity.y *= 0.95

          // Recuperación gradual hacia la dirección previa cuando está por terminar el aturdimiento
          if (newState.stunned < 30) {
            const targetRotation = newState.playerPreviousRotation
            const currentRotation = newState.player.rotation

            // Calcular la diferencia angular más corta
            let angleDiff = targetRotation - currentRotation
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

            // Aplicar recuperación gradual
            newState.player.rotation += angleDiff * RECOVERY_SPEED
          }
        }

        // ===== VERIFICAR COLISIONES DEL JUGADOR =====
        const newPlayerX = newState.player.position.x + newState.player.velocity.x
        const newPlayerY = newState.player.position.y + newState.player.velocity.y

        // Verificar colisión con edificios
        if (isOnStreet(newPlayerX, newPlayerY, newState.player.size, newState.buildings)) {
          newState.player.position.x = newPlayerX
          newState.player.position.y = newPlayerY
        } else {
          // Colisión con edificio - efecto de aturdimiento
          if (newState.stunned <= 0) {
            newState.stunned = STUN_DURATION
            newState.isCharging = false
            newState.chargePower = 0
            newState.spinCount = 3;
            newState.spinTimer = 60; // 1s por vuelta (ajusta si quieres más rápido)
            newState.spinAngularSpeed = 0.35; // velocidad angular inicial
            newState.currentSpeed = 0; // queda quieto
          }
        }

        // Mantener jugador dentro de los límites del mundo
        newState.player.position.x = Math.max(20, Math.min(CITY_WIDTH - 20, newState.player.position.x))
        newState.player.position.y = Math.max(20, Math.min(CITY_HEIGHT - 20, newState.player.position.y))

        // ===== ACTUALIZAR VEHÍCULOS =====
        newState.vehicles.forEach((vehicle) => {
          updateVehiclePosition(vehicle, newState.buildings, newState.vehicles)

          // Verificar colisión con jugador
          const dxPlayer = vehicle.position.x - newState.player.position.x
          const dyPlayer = vehicle.position.y - newState.player.position.y
          const distancePlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer)

          if (distancePlayer < 25 && newState.stunned <= 0) {
            // Guardar la rotación actual antes del aturdimiento
            newState.playerPreviousRotation = newState.player.rotation
            newState.stunned = STUN_DURATION
            newState.isCharging = false
            newState.chargePower = 0
          }
        })

        // ===== ACTUALIZAR PIZZAS =====
        newState.pizzas = newState.pizzas.filter((pizza) => {
          if (!pizza.active) return false

          // Actualizar posición de la pizza
          pizza.position.x += pizza.velocity.x
          pizza.position.y += pizza.velocity.y

          // Efecto magnético suave hacia el punto de entrega cuando está cerca
          const currentPoint = newState.deliveryPoints[newState.currentDelivery]
          if (currentPoint && currentPoint.active && pizza.sliding) {
            const dx = currentPoint.position.x - pizza.position.x
            const dy = currentPoint.position.y - pizza.position.y
            const distanceToPoint = Math.sqrt(dx * dx + dy * dy)

            if (distanceToPoint < currentPoint.radius * 1.5) { // Radio de influencia magnética
              const magnetStrength = 0.015
              pizza.velocity.x += (dx / distanceToPoint) * magnetStrength
              pizza.velocity.y += (dy / distanceToPoint) * magnetStrength
            }
          }

          // Fricción reducida
          pizza.velocity.x *= 0.98
          pizza.velocity.y *= 0.98

          // Colisión con edificios
          let hasCollided = false
          for (const building of newState.buildings) {
            if (building.type === "building") {
              if (checkPizzaRectCollision(pizza, building.x, building.y, building.width, building.height)) {
                // Calcular normal de colisión
                const centerX = building.x + building.width / 2
                const centerY = building.y + building.height / 2
                const normalX = pizza.position.x - centerX
                const normalY = pizza.position.y - centerY

                // Aplicar rebote
                calculatePizzaBounce(pizza, normalX, normalY)
                hasCollided = true
                break
              }
            }
          }

          // Colisión con vehículos
          if (!hasCollided) {
            for (const vehicle of newState.vehicles) {
              const dx = pizza.position.x - vehicle.position.x
              const dy = pizza.position.y - vehicle.position.y
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance < vehicle.size.x / 2 + 8) {
                // Aplicar rebote
                calculatePizzaBounce(pizza, dx, dy)
                hasCollided = true
                break
              }
            }
          }

          // Verificar si la pizza dejó de deslizarse (umbral aumentado)
          const speed = Math.sqrt(pizza.velocity.x * pizza.velocity.x + pizza.velocity.y * pizza.velocity.y)
          if (speed < 0.35 && pizza.sliding) {
            pizza.sliding = false

            // ===== CALCULAR PUNTUACIÓN FINAL =====
            const currentPoint = newState.deliveryPoints[newState.currentDelivery]
            if (currentPoint && currentPoint.active) { // Verificar que el punto esté activo
              const dx = pizza.position.x - currentPoint.position.x
              const dy = pizza.position.y - currentPoint.position.y
              const distance = Math.sqrt(dx * dx + dy * dy)
              const PIZZA_RADIUS = 8 // Radio de la pizza

              // Considerar el radio de la pizza para la detección
              if (distance <= currentPoint.radius + PIZZA_RADIUS) {
                // ===== ENTREGA EXITOSA =====
                pizza.delivered = true
                pizza.active = false

                // Calcular puntos basados en precisión (ajustado para considerar el radio de la pizza)
                const effectiveDistance = Math.max(0, distance - PIZZA_RADIUS)
                const accuracy = 1 - effectiveDistance / currentPoint.radius
                const points = Math.floor(accuracy * 150) + 50 // 50-200 puntos
                newState.score += points

                // Actualizar contador de entregas de forma segura
                newState.deliveriesCompleted = Number(newState.deliveriesCompleted || 0) + 1

                // Desactivar el punto actual y activar el siguiente
                currentPoint.active = false

                // Avanzar a la siguiente entrega si hay más puntos disponibles
                if (newState.currentDelivery < newState.deliveryPoints.length - 1) {
                  newState.currentDelivery++
                  newState.deliveryPoints[newState.currentDelivery].active = true
                }

                console.log('Pizza entregada exitosamente:', {
                  deliveriesCompleted: newState.deliveriesCompleted,
                  currentDelivery: newState.currentDelivery,
                  points,
                  accuracy
                })

                return false
              }
            }
            // Pizza falló la entrega
            console.log('Pizza falló la entrega')
            pizza.delivered = false
            pizza.active = false
            return false
          }

          // Remover pizza si sale de los límites
          if (
            pizza.position.x < 0 ||
            pizza.position.x > CITY_WIDTH ||
            pizza.position.y < 0 ||
            pizza.position.y > CITY_HEIGHT
          ) {
            console.log('Pizza fuera de límites')
            pizza.active = false
            pizza.delivered = false
            if (pizza.sliding) {
              newState.score = Math.max(0, newState.score - 30) // Penalización por salir del mapa
            }
            return false
          }

          return true
        })

        // En el game loop, recuperación progresiva:
        if (newState.collisionRecoveryTimer > 0) {
          newState.collisionRecoveryTimer--
          newState.currentSpeed = Math.min(
            PLAYER_SPEED_NORMAL,
            newState.currentSpeed + PLAYER_SPEED_NORMAL / 30
          )
        }

        if (newState.spinCount > 0) {
          // Gira en su lugar y desacelera el giro
          newState.player.rotation += newState.spinAngularSpeed;
          newState.spinAngularSpeed *= 0.97; // desacelera el giro cada frame
          newState.player.velocity.x = 0;
          newState.player.velocity.y = 0;
          newState.spinTimer--;
          if (newState.spinTimer <= 0) {
            newState.spinCount--;
            newState.spinTimer = 60; // siguiente vuelta
            if (newState.spinCount === 0) {
              newState.stunned = 0; // permite input
              newState.spinAngularSpeed = 0;
              newState.currentSpeed = 0; // queda quieto
            }
          }
        }

        return newState
      })

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [
    gameState.gameStarted,
    gameState.gameOver,
    isPaused,
    isOnStreet,
    checkPizzaRectCollision,
    calculatePizzaBounce,
    updateVehiclePosition,
  ])

  // ===== SISTEMA DE RENDERIZADO =====
  /**
   * Dibuja sprites pixel art en el canvas
   * @param ctx - Contexto del canvas
   * @param x - Posición X
   * @param y - Posición Y
   * @param width - Ancho del sprite
   * @param height - Alto del sprite
   * @param type - Tipo de sprite a dibujar
   * @param style - Variante de estilo (0-2)
   * @param rotation - Rotación en radianes
   */
  const drawSprite = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      type: string,
      style = 0,
      rotation = 0,
    ) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)

      switch (type) {
        case "moto":
          // Sprite de la moto del jugador (mejorado)
          ctx.fillStyle = "#339af0"
          ctx.fillRect(-width / 2, -height / 2, width, height)

          // Cuerpo de la moto
          ctx.fillStyle = "#1c7ed6"
          ctx.fillRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4)

          // Ruedas
          ctx.fillStyle = "#212529"
          ctx.fillRect(-width / 2 + 2, -height / 2, 4, height)
          ctx.fillRect(width / 2 - 6, -height / 2, 4, height)

          // Faro
          ctx.fillStyle = "#fff"
          ctx.fillRect(width / 2 - 4, -2, 3, 4)

          // Conductor
          ctx.fillStyle = "#495057"
          ctx.fillRect(-2, -4, 4, 8)
          ctx.fillStyle = "#ff6b6b"
          ctx.fillRect(-1, -2, 2, 4)
          break

        case "car":
          // Sprite de auto (mejorado)
          const carColors = ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419"]
          ctx.fillStyle = carColors[style % carColors.length]

          // Cuerpo del auto
          ctx.fillRect(-width / 2, -height / 2, width, height)

          // Ventanas
          ctx.fillStyle = "#212529"
          ctx.fillRect(-width / 2 + 4, -height / 2 + 2, width - 8, height - 4)

          // Luces
          ctx.fillStyle = "#fff"
          ctx.fillRect(-width / 2 + 2, -height / 2 + 2, 2, 2)
          ctx.fillRect(-width / 2 + 2, height / 2 - 4, 2, 2)
          ctx.fillRect(width / 2 - 4, -height / 2 + 2, 2, 2)
          ctx.fillRect(width / 2 - 4, height / 2 - 4, 2, 2)
          break

        case "truck":
          // Sprite de camión (mejorado)
          ctx.fillStyle = "#fd7e14"

          // Cabina
          ctx.fillRect(-width / 2, -height / 2, width / 3, height)

          // Carga
          ctx.fillStyle = "#e67700"
          ctx.fillRect(-width / 2 + width / 3, -height / 2, (width * 2) / 3, height)

          // Ventanas
          ctx.fillStyle = "#212529"
          ctx.fillRect(-width / 2 + 2, -height / 2 + 2, width / 3 - 4, height / 2 - 2)

          // Luces
          ctx.fillStyle = "#fff"
          ctx.fillRect(-width / 2 + 2, height / 2 - 4, 2, 2)
          ctx.fillRect(-width / 2 + width / 3 - 4, height / 2 - 4, 2, 2)
          break

        case "building":
          // Sprite de edificio minimalista (sin luces animadas)
          const buildingColors = ["#868e96", "#6c757d", "#495057", "#343a40"]
          ctx.fillStyle = buildingColors[style % buildingColors.length]

          // Cuerpo del edificio
          ctx.fillRect(-width / 2, -height / 2, width, height)
          ctx.strokeStyle = "#343a40"
          ctx.lineWidth = 1
          ctx.strokeRect(-width / 2, -height / 2, width, height)

          // Ventanas estáticas (sin animación)
          ctx.fillStyle = "#495057" // Color fijo para ventanas
          const windowSize = 4
          const windowSpacing = 12

          for (let wx = -width / 2 + 8; wx < width / 2 - 8; wx += windowSpacing) {
            for (let wy = -height / 2 + 8; wy < height / 2 - 8; wy += windowSpacing) {
              // Patrón fijo de ventanas (sin random)
              if ((wx + wy) % 24 === 0) {
                ctx.fillRect(wx, wy, windowSize, windowSize)
              }
            }
          }

          // Puerta
          ctx.fillStyle = "#212529"
          ctx.fillRect(-5, height / 2 - 10, 10, 10)
          break

        case "decoration":
          // Decoraciones minimalistas
          if (style === 0) {
            // Árbol simple
            ctx.fillStyle = "#2b8a3e"
            ctx.beginPath()
            ctx.arc(0, 0, width / 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = "#6f4e37"
            ctx.fillRect(-2, height / 2 - 6, 4, 6)
          } else if (style === 1) {
            // Poste de luz simple
            ctx.fillStyle = "#adb5bd"
            ctx.fillRect(-1, -height / 2, 2, height)
            ctx.fillStyle = "#495057"
            ctx.beginPath()
            ctx.arc(0, -height / 2, 3, 0, Math.PI * 2)
            ctx.fill()
          } else {
            // Buzón simple
            ctx.fillStyle = "#fa5252"
            ctx.fillRect(-width / 2, -height / 2, width, height)
            ctx.fillStyle = "#212529"
            ctx.fillRect(-width / 2 + 2, -2, width - 4, 3)
          }
          break
      }

      ctx.restore()
    },
    [],
  )

  // ===== RENDERIZADO PRINCIPAL =====
  /**
   * Renderiza todo el juego en el canvas con zoom aplicado
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // ===== ACTUALIZAR CÁMARA CON ZOOM =====
    // La cámara sigue al jugador
    camera.current.x = gameState.player.position.x - CANVAS_WIDTH / (2 * CAMERA_ZOOM)
    camera.current.y = gameState.player.position.y - CANVAS_HEIGHT / (2 * CAMERA_ZOOM)

    // Mantener cámara dentro de los límites
    camera.current.x = Math.max(0, Math.min(CITY_WIDTH - CANVAS_WIDTH / CAMERA_ZOOM, camera.current.x))
    camera.current.y = Math.max(0, Math.min(CITY_HEIGHT - CANVAS_HEIGHT / CAMERA_ZOOM, camera.current.y))

    // Aplicar zoom
    ctx.save()
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM)

    // ===== DIBUJAR FONDO (CALLES) =====
    ctx.fillStyle = "#6c757d" // Color de asfalto más claro y uniforme
    ctx.fillRect(
      -camera.current.x,
      -camera.current.y,
      CANVAS_WIDTH / CAMERA_ZOOM + camera.current.x,
      CANVAS_HEIGHT / CAMERA_ZOOM + camera.current.y,
    )

    // ===== DIBUJAR CUADRÍCULA DE CALLES (simplificada) =====
    ctx.strokeStyle = "#495057"
    ctx.lineWidth = 1
    for (let x = 0; x < CITY_WIDTH; x += BLOCK_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x - camera.current.x, -camera.current.y)
      ctx.lineTo(x - camera.current.x, CANVAS_HEIGHT / CAMERA_ZOOM - camera.current.y)
      ctx.stroke()
    }
    for (let y = 0; y < CITY_HEIGHT; y += BLOCK_SIZE) {
      ctx.beginPath()
      ctx.moveTo(-camera.current.x, y - camera.current.y)
      ctx.lineTo(CANVAS_WIDTH / CAMERA_ZOOM - camera.current.x, y - camera.current.y)
      ctx.stroke()
    }

    // Eliminar las marcas viales punteadas para simplificar

    // ===== DIBUJAR EDIFICIOS =====
    gameState.buildings.forEach((building) => {
      const screenX = building.x - camera.current.x + building.width / 2
      const screenY = building.y - camera.current.y + building.height / 2

      // Solo dibujar si está visible en pantalla (ajustado para zoom)
      if (
        screenX > -100 &&
        screenX < CANVAS_WIDTH / CAMERA_ZOOM + 100 &&
        screenY > -100 &&
        screenY < CANVAS_HEIGHT / CAMERA_ZOOM + 100
      ) {
        if (building.type === "building") {
          drawSprite(ctx, screenX, screenY, building.width, building.height, "building", building.style)
        } else {
          // Decoración (árboles, postes, etc.)
          drawSprite(ctx, screenX, screenY, building.width, building.height, "decoration", building.style)
        }
      }
    })

    // ===== DIBUJAR PUNTOS DE ENTREGA =====
    gameState.deliveryPoints.forEach((point, index) => {
      if (!point.active) return; // Solo dibujar el activo

      const screenX = point.position.x - camera.current.x
      const screenY = point.position.y - camera.current.y

      if (
        screenX > -50 &&
        screenX < CANVAS_WIDTH / CAMERA_ZOOM + 50 &&
        screenY > -50 &&
        screenY < CANVAS_HEIGHT / CAMERA_ZOOM + 50
      ) {
        // Punto de entrega activo SIN efecto de pulsación
        ctx.fillStyle = "#ff6b6b"
        ctx.strokeStyle = "#ff4444"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(screenX, screenY, point.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Dibujar número del punto
        ctx.fillStyle = "white"
        ctx.font = "bold 16px monospace"
        ctx.textAlign = "center"
        ctx.fillText((index + 1).toString(), screenX, screenY + 5)
      }
    })

    // ===== DIBUJAR VEHÍCULOS =====
    gameState.vehicles.forEach((vehicle) => {
      const screenX = vehicle.position.x - camera.current.x
      const screenY = vehicle.position.y - camera.current.y

      if (
        screenX > -50 &&
        screenX < CANVAS_WIDTH / CAMERA_ZOOM + 50 &&
        screenY > -50 &&
        screenY < CANVAS_HEIGHT / CAMERA_ZOOM + 50
      ) {
        drawSprite(ctx, screenX, screenY, vehicle.size.x, vehicle.size.y, vehicle.type, 0, vehicle.rotation)
      }
    })

    // ===== DIBUJAR PIZZAS =====
    gameState.pizzas.forEach((pizza) => {
      if (pizza.active) {
        const screenX = pizza.position.x - camera.current.x
        const screenY = pizza.position.y - camera.current.y

        // Sprite de pizza mejorado
        ctx.fillStyle = "#ffd43b"
        ctx.strokeStyle = "#fab005"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Ingredientes de la pizza
        ctx.fillStyle = "#e03131"
        ctx.beginPath()
        ctx.arc(screenX - 2, screenY - 2, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(screenX + 2, screenY + 1, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(screenX - 1, screenY + 3, 1.5, 0, Math.PI * 2)
        ctx.fill()

        // Efecto de rastro cuando se desliza
        if (pizza.sliding) {
          ctx.strokeStyle = "rgba(255, 212, 59, 0.5)"
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(screenX - pizza.velocity.x * 3, screenY - pizza.velocity.y * 3)
          ctx.lineTo(screenX, screenY)
          ctx.stroke()
        }
      }
    })

    // ===== DIBUJAR JUGADOR =====
    const playerScreenX = gameState.player.position.x - camera.current.x
    const playerScreenY = gameState.player.position.y - camera.current.y

    if (gameState.stunned > 0) {
      // Efecto visual cuando está aturdido
      ctx.save()
      ctx.translate(playerScreenX, playerScreenY)
      ctx.rotate(gameState.player.rotation)
      drawSprite(ctx, 0, 0, gameState.player.size.x, gameState.player.size.y, "moto")
      ctx.restore()
    } else {
      drawSprite(
        ctx,
        playerScreenX,
        playerScreenY,
        gameState.player.size.x,
        gameState.player.size.y,
        "moto",
        0,
        gameState.player.rotation,
      )
    }

    // ===== DIBUJAR INDICADOR DE CARGA =====
    if (gameState.isCharging && gameState.pizzasRemaining > 0) {
      // Línea de apuntado (ajustada para zoom)
      const worldMouseX = (mouseRef.current.x - CANVAS_WIDTH / 2) / CAMERA_ZOOM + gameState.player.position.x
      const worldMouseY = (mouseRef.current.y - CANVAS_HEIGHT / 2) / CAMERA_ZOOM + gameState.player.position.y

      ctx.strokeStyle = "#ff6b6b"
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(playerScreenX, playerScreenY)
      ctx.lineTo(worldMouseX - camera.current.x, worldMouseY - camera.current.y)
      ctx.stroke()
      ctx.setLineDash([])

      // Barra de potencia
      const powerPercent = gameState.chargePower / MAX_CHARGE_POWER
      ctx.fillStyle = `hsl(${120 * powerPercent}, 100%, 50%)`
      ctx.fillRect(playerScreenX - 20, playerScreenY - 30, 40 * powerPercent, 6)
      ctx.strokeStyle = "#333"
      ctx.lineWidth = 2
      ctx.strokeRect(playerScreenX - 20, playerScreenY - 30, 40, 6)
    }

    // Restaurar transformación
    ctx.restore()

    // ===== DIBUJAR MINIMAPA (sin zoom) =====
    const minimapSize = 150
    const minimapX = CANVAS_WIDTH - minimapSize - 20
    const minimapY = 20

    // Fondo del minimapa
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
    ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize)
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 2
    ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize)

    // Edificios en el minimapa
    gameState.buildings.forEach((building) => {
      if (building.type === "building") {
        const minimapBuildingX = minimapX + (building.x / CITY_WIDTH) * minimapSize
        const minimapBuildingY = minimapY + (building.y / CITY_HEIGHT) * minimapSize
        const minimapBuildingW = (building.width / CITY_WIDTH) * minimapSize
        const minimapBuildingH = (building.height / CITY_HEIGHT) * minimapSize

        ctx.fillStyle = "#495057"
        ctx.fillRect(minimapBuildingX, minimapBuildingY, minimapBuildingW, minimapBuildingH)
      }
    })

    // Jugador en el minimapa
    const minimapPlayerX = minimapX + (gameState.player.position.x / CITY_WIDTH) * minimapSize
    const minimapPlayerY = minimapY + (gameState.player.position.y / CITY_HEIGHT) * minimapSize
    ctx.fillStyle = "#339af0"
    ctx.beginPath()
    ctx.arc(minimapPlayerX, minimapPlayerY, 3, 0, Math.PI * 2)
    ctx.fill()

    // Después de dibujar los edificios en el minimapa
    const activePoint = gameState.deliveryPoints.find((p) => p.active);
    if (activePoint) {
      const minimapPointX = minimapX + (activePoint.position.x / CITY_WIDTH) * minimapSize;
      const minimapPointY = minimapY + (activePoint.position.y / CITY_HEIGHT) * minimapSize;
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.arc(minimapPointX, minimapPointY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [gameState, drawSprite, findNearestIntersection])

  // ===== FUNCIONES AUXILIARES =====
  /**
   * Formatea el tiempo en formato MM:SS
   */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  /**
   * Determina el resultado del juego basado en el estado actual
   */
  const getGameResult = () => {
    if (gameState.deliveriesCompleted >= REQUIRED_DELIVERIES) {
      return { title: "¡Victoria!", message: "¡Completaste todas las entregas!" }
    } else if (gameState.pizzasRemaining <= 0 && gameState.pizzas.filter((p) => p.active).length === 0) {
      return { title: "Sin pizzas", message: "Te quedaste sin pizzas para lanzar" }
    } else {
      return { title: "Tiempo agotado", message: "Se acabó el tiempo" }
    }
  }

  // ===== RENDERIZADO DEL COMPONENTE =====
  return (
    <div className="flex flex-col items-center bg-gray-900 h-screen p-2 relative">
      {/* ===== HUD PRINCIPAL ===== */}
      <div className="flex gap-6 items-center text-white bg-gray-800 px-6 py-2 rounded-lg mb-2">
        <div className="text-xl font-bold">🍕 Pizza Delivery Rush</div>
        {gameState.gameStarted && (
          <>
            <div className="flex items-center gap-2">
              <span>⏰</span>
              <span>{formatTime(gameState.timeLeft)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🍕</span>
              <span>{gameState.pizzasRemaining}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📦</span>
              <span>
                {gameState.deliveriesCompleted}/{REQUIRED_DELIVERIES}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>💰</span>
              <span>{gameState.score}</span>
            </div>
            {/* Indicador de velocidad máxima */}
            <div className="flex items-center gap-2">
              <span>🚦</span>
              <span>
                Velocidad: {(gameState.currentSpeed * 36).toFixed(0)}/{(gameState.maxSpeed * 36).toFixed(0)} km/h
              </span>
            </div>
            {gameState.stunned > 0 && <div className="text-red-400 font-bold animate-pulse">💫 ¡ATURDIDO!</div>}
          </>
        )}
      </div>

      {/* ===== CANVAS DEL JUEGO ===== */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-gray-600 bg-gray-700 max-h-[calc(100vh-8rem)]"
          style={{ imageRendering: "pixelated", aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
        />
      </div>

      {/* ===== PANTALLA DE INICIO ===== */}
      {!gameState.gameStarted && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
          <Card className="p-6 text-center max-w-lg">
            <h2 className="text-2xl font-bold mb-4">🍕 Pizza Delivery Rush</h2>
            <div className="text-left mb-4 space-y-2">
              <p>
                <strong>Objetivo:</strong> Entrega 10 pizzas en 5 minutos
              </p>
              <p>
                <strong>Pizzas disponibles:</strong> 15 (puedes fallar hasta 5)
              </p>
              <p>
                <strong>Controles:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>
                  <strong>A/D:</strong> Girar izquierda/derecha
                </li>
                <li>
                  <strong>Mouse:</strong> Apuntar dirección de lanzamiento
                </li>
                <li>
                  <strong>Click y mantener:</strong> Cargar potencia
                </li>
                <li>
                  <strong>Soltar:</strong> Lanzar pizza
                </li>
                <li>
                  <strong>ESC:</strong> Pausar juego
                </li>
              </ul>
              <p>
                <strong>Reglas:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>La moto siempre avanza hacia adelante</li>
                <li>Evita chocar con edificios y vehículos</li>
                <li>Las pizzas se puntúan cuando dejan de deslizarse</li>
                <li>Las pizzas rebotan en edificios y vehículos</li>
                <li>Más cerca del centro = más propina</li>
              </ul>
            </div>
            <Button onClick={initGame} className="w-full">
              🚀 Comenzar Entrega
            </Button>
          </Card>
        </div>
      )}

      {/* ===== PANTALLA DE GAME OVER ===== */}
      {gameState.gameOver && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
          <Card className="p-6 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">{getGameResult().title}</h2>
            <p className="mb-4">{getGameResult().message}</p>
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-semibold">Puntuación Final</div>
                  <div className="text-2xl font-bold text-blue-600">{gameState.score}</div>
                </div>
                <div>
                  <div className="font-semibold">Entregas</div>
                  <div className="text-2xl font-bold text-green-600">
                    {gameState.deliveriesCompleted}/{REQUIRED_DELIVERIES}
                  </div>
                </div>
                <div>
                  <div className="font-semibold">Pizzas Usadas</div>
                  <div className="text-lg">
                    {TOTAL_PIZZAS - gameState.pizzasRemaining}/{TOTAL_PIZZAS}
                  </div>
                </div>
                <div>
                  <div className="font-semibold">Tiempo Restante</div>
                  <div className="text-lg">{formatTime(gameState.timeLeft)}</div>
                </div>
              </div>
            </div>
            <Button onClick={initGame} className="w-full">
              🔄 Jugar de Nuevo
            </Button>
          </Card>
        </div>
      )}

      {/* ===== PANTALLA DE PAUSA ===== */}
      {isPaused && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-900 bg-opacity-80 z-50">
          <Card className="p-6 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">Juego Pausado</h2>
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-semibold">Puntuación Actual</div>
                  <div className="text-2xl font-bold text-blue-600">{gameState.score}</div>
                </div>
                <div>
                  <div className="font-semibold">Entregas</div>
                  <div className="text-2xl font-bold text-green-600">
                    {gameState.deliveriesCompleted}/{REQUIRED_DELIVERIES}
                  </div>
                </div>
                <div>
                  <div className="font-semibold">Pizzas Restantes</div>
                  <div className="text-lg">{gameState.pizzasRemaining}</div>
                </div>
                <div>
                  <div className="font-semibold">Tiempo Restante</div>
                  <div className="text-lg">{formatTime(gameState.timeLeft)}</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Button onClick={() => setIsPaused(false)} className="w-full">
                ▶️ Reanudar Partida
              </Button>
              <Button onClick={initGame} className="w-full">
                🔄 Reiniciar Partida
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== CONSEJOS ===== */}
      <div className="text-sm text-gray-400 text-center max-w-3xl mt-2">
        <p>
          <strong>💡 Consejos:</strong> Mantén la velocidad constante • Planifica tu ruta • Usa el minimapa • ¡La
          precisión es clave para las propinas! • Presiona ESC para pausar
        </p>
      </div>
    </div>
  )
}
