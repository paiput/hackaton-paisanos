import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { playerId } = await request.json()

    if (!playerId) {
      return NextResponse.json({ success: false, error: "Player ID requerido" }, { status: 400 })
    }

    // Eliminar jugador de la base de datos
    const { error } = await supabase.from("players").delete().eq("id", playerId)

    if (error) {
      console.error("Error removing player:", error)
      return NextResponse.json({ success: false, error: "Error al eliminar jugador" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in leave-game:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}
