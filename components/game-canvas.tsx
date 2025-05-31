"use client"

import { useEffect, useRef } from "react"
import type { Player } from "@/types/game"

interface GameCanvasProps {
  players: Player[]
  currentPlayer: Player | null
}

export function GameCanvas({ players, currentPlayer }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Limpiar canvas
    ctx.fillStyle = "#1a1a1a"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Dibujar grid pixelado
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Dibujar jugadores
    players.forEach((player) => {
      // Cuadrado del jugador
      ctx.fillStyle = player.color
      ctx.fillRect(player.x, player.y, 30, 30)

      // Borde más grueso para el jugador actual
      if (currentPlayer && player.id === currentPlayer.id) {
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 3
        ctx.strokeRect(player.x, player.y, 30, 30)
      } else {
        ctx.strokeStyle = "#000000"
        ctx.lineWidth = 1
        ctx.strokeRect(player.x, player.y, 30, 30)
      }

      // Nombre del jugador
      ctx.fillStyle = "#ffffff"
      ctx.font = "12px monospace"
      ctx.textAlign = "center"
      ctx.fillText(player.name, player.x + 15, player.y - 5)
    })
  }, [players, currentPlayer])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="border-2 border-gray-600 bg-gray-900"
      style={{ imageRendering: "pixelated" }}
    />
  )
}
