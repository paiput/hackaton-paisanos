"use client"

import { useGame } from "@/hooks/useGame"
import { JoinForm } from "@/components/join-form"
import { GameCanvas } from "@/components/game-canvas"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Game() {
  const { players, currentPlayer, isConnected, joinGame, leaveGame } = useGame()

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <JoinForm onJoin={joinGame} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">
              🎮 Jugando como: <span className="text-blue-600">{currentPlayer?.name}</span>
            </CardTitle>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Jugadores conectados: {players.length}</span>
              <Button variant="outline" onClick={leaveGame}>
                Salir del juego
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="flex justify-center">
          <GameCanvas players={players} currentPlayer={currentPlayer} />
        </div>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-gray-600">
              <p>
                <strong>Controles:</strong> Usa WASD o las flechas del teclado para moverte
              </p>
              <p>
                <strong>Tu cuadrado:</strong> Tiene un borde blanco más grueso
              </p>
              <p>
                <strong>Otros jugadores:</strong> Aparecen en tiempo real cuando se mueven
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
