import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
console.log("process.env.NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log("process.env.SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { playerId, pointX, pointY } = await request.json()

    if (!playerId) {
      return NextResponse.json({ success: false, error: "Player ID requerido" }, { status: 400 })
    }

    // Verificar que el jugador existe y obtener su posición
    const { data: player, error: playerError } = await supabase.from("players").select("*").eq("id", playerId).single()

    if (playerError || !player) {
      return NextResponse.json({ success: false, error: "Jugador no encontrado" }, { status: 404 })
    }

    // Validar que el jugador está cerca del punto (anti-cheat)
    const distance = Math.sqrt(Math.pow(player.x - pointX, 2) + Math.pow(player.y - pointY, 2))
    const maxCollectionDistance = 40 // píxeles

    if (distance > maxCollectionDistance) {
      return NextResponse.json({ success: false, error: "Demasiado lejos del punto" }, { status: 400 })
    }

    // Verificar si el punto aún existe (no fue recogido por otro jugador)
    const { data: existingPoint, error: pointError } = await supabase
      .from("game_points")
      .select("*")
      .eq("x", pointX)
      .eq("y", pointY)
      .eq("collected", false)
      .single()

    if (pointError || !existingPoint) {
      return NextResponse.json({ success: false, error: "Punto ya recogido o no existe" }, { status: 404 })
    }

    // Marcar punto como recogido y actualizar puntuación del jugador
    const { error: updateError } = await supabase
      .from("game_points")
      .update({ collected: true, collected_by: playerId, collected_at: new Date().toISOString() })
      .eq("id", existingPoint.id)

    if (updateError) {
      return NextResponse.json({ success: false, error: "Error al recoger punto" }, { status: 500 })
    }

    // Actualizar puntuación del jugador
    const { error: scoreError } = await supabase
      .from("players")
      .update({
        score: (player.score || 0) + existingPoint.value,
        last_seen: new Date().toISOString(),
      })
      .eq("id", playerId)

    if (scoreError) {
      console.error("Error updating score:", scoreError)
    }

    return NextResponse.json({
      success: true,
      pointsEarned: existingPoint.value,
      newScore: (player.score || 0) + existingPoint.value,
    })
  } catch (error) {
    console.error("Error in collect-point:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}
