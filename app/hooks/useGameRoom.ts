import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PlayerPosition, GameEvent, GameRoomState, Shot } from '../types/game';
import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';

interface UseGameRoomOptions {
  roomId: string;
  playerId: string;
}

const INITIAL_GAME_ROOM_STATE: Omit<GameRoomState, 'roomId'> = {
  players: {},
};

export function useGameRoom({ roomId, playerId }: UseGameRoomOptions) {
  const [gameRoomState, setGameRoomState] = useState<GameRoomState>({
    ...INITIAL_GAME_ROOM_STATE,
    roomId,
  });
  const [isPresent, setIsPresent] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const roomChannel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: playerId, // Unique key for this client
        },
      },
    });

    // --- Presence ---    
    roomChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = roomChannel.presenceState<PlayerPosition>();
      console.log('Presence sync:', presenceState);
      // Update player list based on presence, potentially removing stale players
      // For simplicity, we are mainly focusing on position updates here
      // You might want to merge this with player positions received via broadcast
    });

    roomChannel.on(
      'presence',
      { event: 'join' },
      ({ key, newPresences }) => {
        console.log('Player joined:', key, newPresences);
        // You could initialize the new player's state here if needed
      }
    );

    roomChannel.on(
      'presence',
      { event: 'leave' },
      ({ key, leftPresences }) => {
        console.log('Player left:', key, leftPresences);
        setGameRoomState((prevState) => {
          const updatedPlayers = { ...prevState.players };
          if (updatedPlayers[key]) {
             delete updatedPlayers[key];
          }
          return { ...prevState, players: updatedPlayers };
        });
      }
    );

    // --- Player Position Broadcast ---    
    roomChannel.on<PlayerPosition>(
      'broadcast',
      { event: 'player_position' },
      ({ payload }) => {
        // console.log('Received position for player:', payload.playerId, payload);
        setGameRoomState((prevState) => {
          const existingPlayer = prevState.players[payload.playerId];
          // Simple conflict resolution: last write wins based on client timestamp
          if (!existingPlayer || payload.timestamp > existingPlayer.timestamp) {
            return {
              ...prevState,
              players: {
                ...prevState.players,
                [payload.playerId]: payload,
              },
            };
          }
          return prevState;
        });
      }
    );

    // --- Game Event Broadcast ---    
    roomChannel.on<GameEvent>(
      'broadcast',
      { event: 'game_event' },
      ({ payload }) => {
        // console.log('Received game event:', payload);
        if (payload.type === 'shoot') {
          // The payload here is already a GameEvent, and its .payload is the Shot
          // We will handle the visual representation of the shot in the component itself
          // For now, just log it or potentially pass it up if the hook managed shots.
          console.log('Received shoot event:', payload.payload as Shot);
        } else {
          console.log('Received other game event:', payload.type, payload.payload);
        }
        // This hook currently doesn't manage a list of all game events in its state.
        // The component consuming the hook will handle the effects of events.
      }
    );

    roomChannel
      .subscribe(async (status, err) => {
        if (err) {
          console.error('Channel subscription error:', err);
          setIsPresent(false);
          return;
        }

        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to room: ${roomId}`);
          const presenceTrackStatus = await roomChannel.track({ 
            online_at: new Date().toISOString(),
            // You can add other user-specific presence data here
          });
          if (presenceTrackStatus === 'ok') {
            setIsPresent(true);
            console.log('Presence tracked successfully');
          } else {
            console.error('Failed to track presence:', presenceTrackStatus);
            setIsPresent(false); // Ensure isPresent reflects tracking failure
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for room: ${roomId}`);
          setIsPresent(false);
        } else if (status === 'TIMED_OUT') {
          console.warn(`Subscription timed out for room: ${roomId}`);
          setIsPresent(false);
        } else {
          console.log('Channel status:', status);
        }
      });

    channelRef.current = roomChannel;

    return () => {
      if (channelRef.current) {
        console.log(`Unsubscribing from room: ${roomId}`);
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsPresent(false);
      }
    };
  }, [roomId, playerId]);

  const sendPlayerPosition = (position: Omit<PlayerPosition, 'playerId' | 'timestamp'>) => {
    if (channelRef.current && isPresent) {
      const playerPosition: PlayerPosition = {
        ...position,
        playerId,
        timestamp: Date.now(),
      };
      // console.log('Sending position:', playerPosition);
      channelRef.current.send({
        type: 'broadcast',
        event: 'player_position',
        payload: playerPosition,
      });
    } else {
      console.warn('Cannot send position: channel not ready or presence not tracked.');
    }
  };

  const sendGameEvent = (eventData: Omit<GameEvent, 'eventId' | 'timestamp' | 'senderId'>) => {
    if (channelRef.current && isPresent) {
      const gameEvent: GameEvent = {
        ...eventData,
        eventId: `${playerId}-${Date.now()}`,
        timestamp: Date.now(),
        senderId: playerId
      };
      // console.log('Sending game event:', gameEvent);
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_event',
        payload: gameEvent, // Send the whole GameEvent object as payload
      });
    } else {
      console.warn('Cannot send game event: channel not ready or presence not tracked.');
    }
  };

  return { gameRoomState, sendPlayerPosition, sendGameEvent, isPresent };
} 