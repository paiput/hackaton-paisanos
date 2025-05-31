import { useEffect, useState, useRef, useCallback } from 'react';
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
  const [lastRemoteShot, setLastRemoteShot] = useState<Shot | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const roomChannel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: playerId,
        },
      },
    });

    // --- Presence ---    
    roomChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = roomChannel.presenceState<PlayerPosition>();
      // console.log('Presence sync:', presenceState);
    });

    roomChannel.on(
      'presence',
      { event: 'join' },
      ({ key, newPresences }) => {
        // console.log('Player joined:', key, newPresences);
      }
    );

    roomChannel.on(
      'presence',
      { event: 'leave' },
      ({ key, leftPresences }) => {
        // console.log('Player left:', key, leftPresences);
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
        if (payload.playerId === playerId) return;
        setGameRoomState((prevState) => {
          const existingPlayer = prevState.players[payload.playerId];
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
      ({ payload: gameEvent }) => {
        if (gameEvent.senderId !== playerId) {
          if (gameEvent.type === 'shoot') {
            const shotData = gameEvent.payload as Shot;
            // console.log('Hook received remote shoot event:', shotData);
            setLastRemoteShot(shotData);
          } else {
            // console.log('Hook received other remote game event:', gameEvent.type, gameEvent.payload);
          }
        }
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
          // console.log(`Successfully subscribed to room: ${roomId}`);
          const presenceTrackStatus = await roomChannel.track({ 
            online_at: new Date().toISOString(),
          });
          if (presenceTrackStatus === 'ok') {
            setIsPresent(true);
            // console.log('Presence tracked successfully');
          } else {
            console.error('Failed to track presence:', presenceTrackStatus);
            setIsPresent(false);
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for room: ${roomId}`);
          setIsPresent(false);
        } else if (status === 'TIMED_OUT') {
          console.warn(`Subscription timed out for room: ${roomId}`);
          setIsPresent(false);
        } else {
          // console.log('Channel status:', status);
        }
      });

    channelRef.current = roomChannel;

    return () => {
      if (channelRef.current) {
        // console.log(`Unsubscribing from room: ${roomId}`);
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsPresent(false);
      }
    };
  }, [roomId, playerId]);

  const sendPlayerPosition = useCallback((position: Omit<PlayerPosition, 'playerId' | 'timestamp'>) => {
    if (channelRef.current && isPresent) {
      const playerPosition: PlayerPosition = {
        ...position,
        playerId,
        timestamp: Date.now(),
      };
      channelRef.current.send({
        type: 'broadcast',
        event: 'player_position',
        payload: playerPosition,
      });
    } else {
      // console.warn('Cannot send position: channel not ready or presence not tracked.');
    }
  }, [playerId, isPresent]);

  const sendGameEvent = useCallback((eventData: Omit<GameEvent, 'eventId' | 'timestamp' | 'senderId'>) => {
    if (channelRef.current && isPresent) {
      const gameEvent: GameEvent = {
        ...eventData,
        eventId: `${playerId}-${Date.now()}-${Math.random().toString(36).substring(2,5)}`,
        timestamp: Date.now(),
        senderId: playerId
      };
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_event',
        payload: gameEvent,
      });
    } else {
      // console.warn('Cannot send game event: channel not ready or presence not tracked.');
    }
  }, [playerId, isPresent]);

  return { gameRoomState, sendPlayerPosition, sendGameEvent, isPresent, lastRemoteShot };
} 