import { Building, DeliveryPoint, Vehicle, Vector2, Route } from '../types/game';

const BLOCK_SIZE = 200;
const STREET_WIDTH = 100;
const CITY_WIDTH = 2400;
const CITY_HEIGHT = 1600;

/**
 * Genera los edificios y estructura de la ciudad
 */
export function generateCity(): Building[] {
    const buildings: Building[] = [];
    for (let x = 0; x < CITY_WIDTH; x += BLOCK_SIZE) {
        for (let y = 0; y < CITY_HEIGHT; y += BLOCK_SIZE) {
            // Decide aleatoriamente el tipo de manzana
            const type = Math.random();
            if (type < 0.33) {
                // Un solo edificio grande
                buildings.push({
                    x: x + STREET_WIDTH / 2,
                    y: y + STREET_WIDTH / 2,
                    width: BLOCK_SIZE - STREET_WIDTH,
                    height: BLOCK_SIZE - STREET_WIDTH,
                    type: "building",
                    style: Math.floor(Math.random() * 3),
                });
            } else if (type < 0.66) {
                // Dos edificios rectangulares
                buildings.push({
                    x: x + STREET_WIDTH / 2,
                    y: y + STREET_WIDTH / 2,
                    width: (BLOCK_SIZE - STREET_WIDTH) * 0.6,
                    height: BLOCK_SIZE - STREET_WIDTH,
                    type: "building",
                    style: Math.floor(Math.random() * 3),
                });
                buildings.push({
                    x: x + STREET_WIDTH / 2 + (BLOCK_SIZE - STREET_WIDTH) * 0.65,
                    y: y + STREET_WIDTH / 2,
                    width: (BLOCK_SIZE - STREET_WIDTH) * 0.3,
                    height: (BLOCK_SIZE - STREET_WIDTH) * 0.7,
                    type: "building",
                    style: Math.floor(Math.random() * 3),
                });
            } else {
                // Forma L
                buildings.push({
                    x: x + STREET_WIDTH / 2,
                    y: y + STREET_WIDTH / 2,
                    width: (BLOCK_SIZE - STREET_WIDTH) * 0.7,
                    height: (BLOCK_SIZE - STREET_WIDTH) * 0.4,
                    type: "building",
                    style: Math.floor(Math.random() * 3),
                });
                buildings.push({
                    x: x + STREET_WIDTH / 2,
                    y: y + STREET_WIDTH / 2 + (BLOCK_SIZE - STREET_WIDTH) * 0.45,
                    width: (BLOCK_SIZE - STREET_WIDTH) * 0.4,
                    height: (BLOCK_SIZE - STREET_WIDTH) * 0.5,
                    type: "building",
                    style: Math.floor(Math.random() * 3),
                });
            }
        }
    }
    return buildings;
}

/**
 * Verifica si una posición está en la calle (no colisiona con edificios)
 */
function isOnStreet(x: number, y: number, size: Vector2, buildings: Building[]): boolean {
    for (const building of buildings) {
        if (building.type === "building") {
            if (
                x - size.x / 2 < building.x + building.width &&
                x + size.x / 2 > building.x &&
                y - size.y / 2 < building.y + building.height &&
                y + size.y / 2 > building.y
            ) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Genera puntos de entrega aleatorios en posiciones válidas
 */
export function generateDeliveryPoints(buildings: Building[]): DeliveryPoint[] {
    const points: DeliveryPoint[] = [];
    let attempts = 0;
    const REQUIRED_DELIVERIES = 10;

    while (points.length < REQUIRED_DELIVERIES && attempts < 100) {
        const x = Math.random() * (CITY_WIDTH - 200) + 100;
        const y = Math.random() * (CITY_HEIGHT - 200) + 100;

        if (isOnStreet(x, y, { x: 80, y: 80 }, buildings)) {
            points.push({
                position: { x, y },
                active: points.length === 0,
                radius: 40,
            });
        }
        attempts++;
    }

    return points;
}

/**
 * Encuentra la intersección más cercana
 */
function findNearestIntersection(x: number, y: number): Vector2 {
    const blockX = Math.round(x / BLOCK_SIZE) * BLOCK_SIZE;
    const blockY = Math.round(y / BLOCK_SIZE) * BLOCK_SIZE;
    return { x: blockX, y: blockY };
}

/**
 * Genera una ruta para un vehículo
 */
function generateVehicleRoute(startPos: Vector2, buildings: Building[]): Route {
    const points: Vector2[] = [];
    const numPoints = 4;

    const startIntersection = findNearestIntersection(startPos.x, startPos.y);
    points.push(startIntersection);

    let currentPos = { ...startIntersection };
    let currentDirection = Math.random() < 0.5 ? { x: 1, y: 0 } : { x: 0, y: 1 };

    for (let i = 1; i < numPoints; i++) {
        const shouldTurn = Math.random() < 0.3;

        if (shouldTurn) {
            if (currentDirection.x !== 0) {
                currentDirection = { x: 0, y: Math.random() < 0.5 ? 1 : -1 };
            } else {
                currentDirection = { x: Math.random() < 0.5 ? 1 : -1, y: 0 };
            }
        }

        const nextPos = {
            x: currentPos.x + currentDirection.x * BLOCK_SIZE,
            y: currentPos.y + currentDirection.y * BLOCK_SIZE,
        };

        if (
            nextPos.x >= 0 &&
            nextPos.x < CITY_WIDTH &&
            nextPos.y >= 0 &&
            nextPos.y < CITY_HEIGHT &&
            isOnStreet(nextPos.x, nextPos.y, { x: 40, y: 40 }, buildings)
        ) {
            points.push(nextPos);
            currentPos = nextPos;
        } else {
            currentDirection = { x: -currentDirection.x, y: -currentDirection.y };
            i--;
        }
    }

    return {
        points,
        type: "linear",
        currentPointIndex: 0,
        isLooping: true,
    };
}

/**
 * Genera vehículos para la ciudad
 */
export function generateVehicles(buildings: Building[]): Vehicle[] {
    const vehicles: Vehicle[] = [];
    const colors = ["#ff4444", "#4444ff", "#44ff44", "#ffff44", "#ff44ff", "#44ffff"];
    const types: ("car" | "truck")[] = ["car", "car", "car", "truck"];

    for (let i = 0; i < 15; i++) {
        let attempts = 0;
        while (attempts < 50) {
            const x = Math.random() * CITY_WIDTH;
            const y = Math.random() * CITY_HEIGHT;
            const type = types[Math.floor(Math.random() * types.length)];
            const size = type === "truck" ? { x: 40, y: 20 } : { x: 25, y: 15 };

            if (isOnStreet(x, y, size, buildings)) {
                const route = generateVehicleRoute({ x, y }, buildings);

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
                    minDistanceToOtherVehicles: 50,
                });
                break;
            }
            attempts++;
        }
    }
    return vehicles;
} 