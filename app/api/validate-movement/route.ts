import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { playerId, currentX, currentY, newX, newY } = await request.json()

    // Validaciones del servidor
    if (!playerId) {
      return NextResponse.json({ valid: false, error: "Player ID requerido" })
    }

    // Verificar que el jugador existe
    const { data: player, error: playerError } = await supabase.from("players").select("*").eq("id", playerId).single()

    if (playerError || !player) {
      return NextResponse.json({ valid: false, error: "Jugador no encontrado" })
    }

    // Validar límites del mapa
    if (newX < 0 || newX > 770 || newY < 0 || newY > 570) {
      return NextResponse.json({ valid: false, error: "Fuera de límites" })
    }

    // Validar velocidad máxima (anti-cheat)
    const maxSpeed = 5 // píxeles por frame
    const distance = Math.sqrt(Math.pow(newX - currentX, 2) + Math.pow(newY - currentY, 2))

    if (distance > maxSpeed) {
      return NextResponse.json({ valid: false, error: "Movimiento demasiado rápido" })
    }

    // Validar que no haya pasado mucho tiempo desde la última actualización
    const lastSeen = new Date(player.last_seen).getTime()
    const now = Date.now()
    const timeDiff = now - lastSeen

    if (timeDiff > 5000) {
      // 5 segundos
      return NextResponse.json({ valid: false, error: "Sesión expirada" })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error("Error validating movement:", error)
    return NextResponse.json({ valid: false, error: "Error interno del servidor" })
  }
}
