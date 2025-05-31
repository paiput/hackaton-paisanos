"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { Player } from "@/types/game"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface InterpolatedPlayer extends Player {
  targetX: number
  targetY: number
  interpolationProgress: number
}

// Define tipos para Presence
interface PlayerPresence {
  id: string
  x: number
  y: number
  updated_at: string
}

export function useGame() {
  const [players, setPlayers] = useState<InterpolatedPlayer[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const keysPressed = useRef<Set<string>>(new Set())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const interpolationRef = useRef<NodeJS.Timeout | null>(null)

  // Generar color aleatorio
  const generateRandomColor = () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffa500", "#800080"]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // Interpolación suave entre posiciones
  const interpolatePlayers = useCallback(() => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => {
        if (currentPlayer && player.id === currentPlayer.id) {
          // No interpolar el jugador actual, usar posición directa
          return {
            ...player,
            x: currentPlayer.x,
            y: currentPlayer.y,
            targetX: currentPlayer.x,
            targetY: currentPlayer.y,
            interpolationProgress: 1,
          }
        }

        // Interpolar otros jugadores
        const progress = Math.min(player.interpolationProgress + 0.15, 1)
        const newX = player.x + (player.targetX - player.x) * 0.15
        const newY = player.y + (player.targetY - player.y) * 0.15

        return {
          ...player,
          x: newX,
          y: newY,
          interpolationProgress: progress,
        }
      }),
    )
  }, [currentPlayer])

  // Configurar suscripción en tiempo real
  const setupRealtimeSubscription = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    channelRef.current = supabase
      .channel("players-realtime")
      // Suscribirse a Presence para posiciones en tiempo real
      .on('presence', { event: 'sync' }, () => {
        if (!channelRef.current) return;
        
        const presenceState = channelRef.current.presenceState();
        
        // Extraer datos de presence de todos los jugadores conectados
        Object.entries(presenceState).forEach(([userId, userStates]) => {
          if (userStates.length > 0) {
            const userPresence = userStates[0] as any;
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
      .on('broadcast', { event: 'player-movement' }, (payload: any) => {
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
      .on(
        "postgres_changes",
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
        },
        (payload) => {
          const updatedPlayer = payload.new as Player
          setPlayers((prev) =>
            prev.map((player) => {
              if (player.id === updatedPlayer.id) {
                // Si es el jugador actual, no interpolar
                if (currentPlayer && player.id === currentPlayer.id) {
                  return player
                }
                // Para otros jugadores, establecer objetivo de interpolación
                return {
                  ...player,
                  targetX: updatedPlayer.x,
                  targetY: updatedPlayer.y,
                  interpolationProgress: 0,
                  color: updatedPlayer.color,
                  name: updatedPlayer.name,
                  last_seen: updatedPlayer.last_seen,
                }
              }
              return player
            }),
          )
        },
      )
      .on(
        "postgres_changes",
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
  }, [currentPlayer])

  // Validar movimiento en el servidor
  const validateMovement = useCallback(
    async (newX: number, newY: number) => {
      if (!currentPlayer) return false

      try {
        const response = await fetch("/api/validate-movement", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerId: currentPlayer.id,
            currentX: currentPlayer.x,
            currentY: currentPlayer.y,
            newX,
            newY,
          }),
        })

        const result = await response.json()
        return result.valid
      } catch (error) {
        console.error("Error validating movement:", error)
        return false
      }
    },
    [currentPlayer],
  )

  // Unirse al juego
  const joinGame = useCallback(
    async (playerName: string) => {
      try {
        const response = await fetch("/api/join-game", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: playerName,
          }),
        })

        const result = await response.json()
        if (!result.success) throw new Error(result.error)

        setCurrentPlayer(result.player)
        setIsConnected(true)

        // Configurar suscripción después de unirse
        setupRealtimeSubscription()

        // Cargar jugadores existentes
        await loadPlayers()
      } catch (error) {
        console.error("Error joining game:", error)
      }
    },
    [setupRealtimeSubscription],
  )

  // Actualizar posición del jugador con validación del servidor y Realtime
  const updatePlayerPosition = useCallback(
    async (x: number, y: number) => {
      if (!currentPlayer || !channelRef.current) return

      const now = Date.now()
      // Limitar actualizaciones a máximo 20 por segundo
      if (now - lastUpdateRef.current < 50) return
      lastUpdateRef.current = now

      // Broadcast para movimiento fluido a otros clientes
      channelRef.current.send({
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
      channelRef.current.track({
        player: {
          id: currentPlayer.id,
          x,
          y,
          updated_at: new Date().toISOString()
        }
      });

      // Validar movimiento en el servidor
      const isValid = await validateMovement(x, y)
      if (!isValid) {
        console.log("Movimiento inválido rechazado por el servidor")
        return
      }

      try {
        // Actualizar la base de datos con menos frecuencia para reducir carga
        if (now % 200 < 50) { // Solo cada ~200ms
          const { error } = await supabase
            .from("players")
            .update({ x, y, last_seen: new Date().toISOString() })
            .eq("id", currentPlayer.id)

          if (error) throw error
        }
      } catch (error) {
        console.error("Error updating position:", error)
      }
    },
    [currentPlayer, validateMovement],
  )

  // Cargar jugadores existentes
  const loadPlayers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .gte("last_seen", new Date(Date.now() - 30000).toISOString())

      if (error) throw error
      const playersWithInterpolation = (data || []).map((player) => ({
        ...player,
        targetX: player.x,
        targetY: player.y,
        interpolationProgress: 1,
      }))
      setPlayers(playersWithInterpolation)
    } catch (error) {
      console.error("Error loading players:", error)
    }
  }, [])

  // Manejar movimiento con teclado
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    keysPressed.current.add(event.key.toLowerCase())
  }, [])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysPressed.current.delete(event.key.toLowerCase())
  }, [])

  // Procesar movimiento con predicción del cliente
  const processMovement = useCallback(() => {
    if (!currentPlayer) return

    let newX = currentPlayer.x
    let newY = currentPlayer.y
    const speed = 3 // Reducido para movimiento más suave

    if (keysPressed.current.has("w") || keysPressed.current.has("arrowup")) {
      newY = Math.max(0, newY - speed)
    }
    if (keysPressed.current.has("s") || keysPressed.current.has("arrowdown")) {
      newY = Math.min(570, newY + speed)
    }
    if (keysPressed.current.has("a") || keysPressed.current.has("arrowleft")) {
      newX = Math.max(0, newX - speed)
    }
    if (keysPressed.current.has("d") || keysPressed.current.has("arrowright")) {
      newX = Math.min(770, newX + speed)
    }

    if (newX !== currentPlayer.x || newY !== currentPlayer.y) {
      // Predicción del cliente: actualizar inmediatamente la posición local
      setCurrentPlayer((prev) => (prev ? { ...prev, x: newX, y: newY } : null))
      // Enviar al servidor para validación
      updatePlayerPosition(newX, newY)
    }
  }, [currentPlayer, updatePlayerPosition])

  // Salir del juego
  const leaveGame = useCallback(async () => {
    if (!currentPlayer) return

    try {
      await fetch("/api/leave-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: currentPlayer.id,
        }),
      })

      // Limpiar suscripción
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      setCurrentPlayer(null)
      setIsConnected(false)
      setPlayers([])
    } catch (error) {
      console.error("Error leaving game:", error)
    }
  }, [currentPlayer])

  // Efectos
  useEffect(() => {
    if (!isConnected) return

    // Loop de interpolación para movimiento suave
    interpolationRef.current = setInterval(interpolatePlayers, 16) // 60 FPS

    return () => {
      if (interpolationRef.current) {
        clearInterval(interpolationRef.current)
      }
    }
  }, [isConnected, interpolatePlayers])

  useEffect(() => {
    if (!isConnected) return

    // Event listeners para teclado
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    // Procesar movimiento cada frame
    const gameLoop = setInterval(processMovement, 16) // ~60 FPS

    // Limpiar al salir
    const handleBeforeUnload = () => {
      leaveGame()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      clearInterval(gameLoop)
    }
  }, [isConnected, handleKeyDown, handleKeyUp, processMovement, leaveGame])

  // Actualizar periódicamente la posición del jugador en Presence
  useEffect(() => {
    if (!isConnected || !currentPlayer || !channelRef.current) return

    // Actualizar Presence cada 2 segundos para mantener la conexión viva
    const presenceInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.track({
          player: {
            id: currentPlayer.id,
            x: currentPlayer.x,
            y: currentPlayer.y,
            updated_at: new Date().toISOString()
          }
        });
      }
    }, 2000);

    return () => {
      clearInterval(presenceInterval);
    }
  }, [isConnected, currentPlayer]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      
      if (interpolationRef.current) {
        clearInterval(interpolationRef.current)
      }
    }
  }, [])

  return {
    players,
    currentPlayer,
    isConnected,
    joinGame,
    leaveGame,
  }
}
