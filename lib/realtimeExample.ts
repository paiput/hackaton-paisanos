/**
 * Este archivo es un ejemplo de cómo implementar las funciones Realtime de Supabase
 * para lograr un movimiento más fluido entre jugadores.
 * 
 * Instrucciones:
 * 1. Actualiza supabase.ts para habilitar funciones realtime con más frecuencia
 * 2. Integra las funciones de Presence y Broadcast en tu useGame.ts
 * 3. Actualiza el manejo de la posición de los jugadores
 */

import { supabase } from './supabase'
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { Player } from "@/types/game"

// Paso 1: Actualiza tu cliente de Supabase (ya implementado)
// export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
//   realtime: {
//     params: {
//       eventsPerSecond: 30 // Aumentar la frecuencia de eventos realtime
//     }
//   }
// })

// Paso 2: Define tipos para Presence
interface PlayerPresence {
  id: string
  x: number
  y: number
  updated_at: string
}

interface InterpolatedPlayer extends Player {
  targetX: number
  targetY: number
  interpolationProgress: number
}

// Paso 3: Implementa la configuración de canal realtime con Presence
function setupRealtimeChannel(
  channelRef: React.MutableRefObject<RealtimeChannel | null>,
  currentPlayer: Player | null,
  setPlayers: (callback: (prev: InterpolatedPlayer[]) => InterpolatedPlayer[]) => void
) {
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current)
  }

  channelRef.current = supabase
    .channel("players-realtime")
    // Configurar Presence para posiciones en tiempo real
    .on('presence', { event: 'sync' }, () => {
      if (!channelRef.current) return;
      
      const presenceState = channelRef.current.presenceState();
      
      // Extraer datos de presence de todos los jugadores conectados
      Object.entries(presenceState).forEach(([userId, userStates]) => {
        if (userStates.length > 0) {
          const userPresence = userStates[0] as { player: PlayerPresence };
          if (userPresence.player && userPresence.player.id && userPresence.player.id !== currentPlayer?.id) {
            // Actualizar posiciones basadas en datos de presence
            setPlayers(prev => 
              prev.map(player => {
                if (player.id === userPresence.player.id) {
                  return {
                    ...player,
                    targetX: userPresence.player.x,
                    targetY: userPresence.player.y,
                    interpolationProgress: 0,
                    last_seen: userPresence.player.updated_at
                  };
                }
                return player;
              })
            );
          }
        }
      });
    })
    // Escuchar broadcast para movimientos más rápidos
    .on('broadcast', { event: 'player-movement' }, (payload: { 
      player: { id: string, x: number, y: number, updated_at: string } 
    }) => {
      const { player } = payload;
      
      if (player && player.id !== currentPlayer?.id) {
        setPlayers(prev => prev.map(p => {
          if (p.id === player.id) {
            return {
              ...p,
              targetX: player.x,
              targetY: player.y,
              interpolationProgress: 0,
              last_seen: player.updated_at
            };
          }
          return p;
        }));
      }
    })
    // Mantener las suscripciones a postgres_changes para entradas/salidas
    .on("postgres_changes", 
      {
        event: "INSERT",
        schema: "public",
        table: "players",
      },
      (payload) => {
        console.log("Nuevo jugador:", payload.new)
        const newPlayer = payload.new as Player
        setPlayers((prev) => {
          const exists = prev.find((p) => p.id === newPlayer.id)
          if (exists) return prev
          return [
            ...prev,
            {
              ...newPlayer,
              targetX: newPlayer.x,
              targetY: newPlayer.y,
              interpolationProgress: 1,
            },
          ]
        })
      },
    )
    .on("postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "players",
      },
      (payload) => {
        console.log("Jugador eliminado:", payload.old)
        setPlayers((prev) => prev.filter((player) => player.id !== payload.old.id))
      },
    );
  
  // Si hay un jugador actual, registrarse en Presence
  if (currentPlayer) {
    channelRef.current.track({
      player: {
        id: currentPlayer.id,
        x: currentPlayer.x,
        y: currentPlayer.y,
        updated_at: new Date().toISOString(),
      }
    });
  }

  channelRef.current.subscribe((status) => {
    console.log("Estado de suscripción realtime:", status)
  });

  return channelRef.current;
}

// Paso 4: Función para actualizar la posición con Broadcast
async function updatePlayerPositionRealtime(
  channel: RealtimeChannel | null,
  currentPlayer: Player | null,
  x: number,
  y: number,
  validateMovement: (x: number, y: number) => Promise<boolean>,
  lastUpdateRef: React.MutableRefObject<number>
) {
  if (!currentPlayer || !channel) return;

  const now = Date.now();
  // Limitar actualizaciones a máximo 20 por segundo
  if (now - lastUpdateRef.current < 50) return;
  lastUpdateRef.current = now;

  // Broadcast para movimiento fluido a otros clientes
  channel.send({
    type: 'broadcast',
    event: 'player-movement',
    payload: {
      player: {
        id: currentPlayer.id,
        x,
        y,
        updated_at: new Date().toISOString()
      }
    }
  });

  // Actualizar Presence con la nueva posición
  channel.track({
    player: {
      id: currentPlayer.id,
      x,
      y,
      updated_at: new Date().toISOString()
    }
  });

  // Validar movimiento en el servidor (esto puede ejecutarse menos frecuentemente)
  const isValid = await validateMovement(x, y);
  if (!isValid) {
    console.log("Movimiento inválido rechazado por el servidor");
    return;
  }

  try {
    // Actualizar la base de datos con menos frecuencia para reducir carga
    // Solo actualiza la DB cada ~200ms en lugar de cada frame
    if (now % 200 < 50) {
      const { error } = await supabase
        .from("players")
        .update({ x, y, last_seen: new Date().toISOString() })
        .eq("id", currentPlayer.id);

      if (error) throw error;
    }
  } catch (error) {
    console.error("Error updating position:", error);
  }
}

export { setupRealtimeChannel, updatePlayerPositionRealtime };
