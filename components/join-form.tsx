"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface JoinFormProps {
  onJoin: (name: string) => void
}

export function JoinForm({ onJoin }: JoinFormProps) {
  const [playerName, setPlayerName] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (playerName.trim()) {
      onJoin(playerName.trim())
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">🎮 Juego Pixelado Multiplayer</CardTitle>
        <CardDescription>Ingresa tu nombre para unirte al juego</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Tu nombre de jugador"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="text-center"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!playerName.trim()}>
            ¡Jugar!
          </Button>
        </form>
        <div className="mt-4 text-sm text-gray-600 text-center">
          <p>Controles: WASD o flechas para moverse</p>
        </div>
      </CardContent>
    </Card>
  )
}
