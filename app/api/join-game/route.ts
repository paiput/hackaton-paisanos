import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Usar service role key para server authority
)

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Nombre requerido" }, { status: 400 })
    }

    // Validaciones del servidor
    if (name.length > 20) {
      return NextResponse.json({ success: false, error: "Nombre muy largo" }, { status: 400 })
    }

    // Generar posición inicial aleatoria válida
    const x = Math.floor(Math.random() * 700) + 50
    const y = Math.floor(Math.random() * 500) + 50

    // Generar color aleatorio
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffa500", "#800080"]
    const color = colors[Math.floor(Math.random() * colors.length)]

    // Crear jugador en la base de datos
    const { data, error } = await supabase
      .from("players")
      .insert({
        name: name.trim(),
        x,
        y,
        color,
        last_seen: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating player:", error)
      return NextResponse.json({ success: false, error: "Error al crear jugador" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      player: data,
    })
  } catch (error) {
    console.error("Error in join-game:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}
