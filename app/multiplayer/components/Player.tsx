'use client';

import React, { useRef, useEffect } from 'react';
import { useSpring, animated, to } from '@react-spring/web';
import { ClientPlayerData } from '@/network/types';

interface PlayerProps {
    player: ClientPlayerData;
    isCurrentPlayer: boolean;
    worldToCssX: (x: number) => number;
    worldToCssY: (y: number) => number;
    onRef?: (id: string, ref: HTMLDivElement | null) => void;
}

export function Player({ 
    player, 
    isCurrentPlayer, 
    worldToCssX, 
    worldToCssY,
    onRef 
}: PlayerProps) {
    const cssX = worldToCssX(player.x);
    const cssY = worldToCssY(player.y);
    const prevPosRef = useRef({ x: cssX, y: cssY });
    
    const isMoving = prevPosRef.current.x !== cssX || prevPosRef.current.y !== cssY;
    
    // Update previous position
    useEffect(() => {
        prevPosRef.current = { x: cssX, y: cssY };
    }, [cssX, cssY]);

    const springs = useSpring({
        to: {
            x: cssX,
            y: cssY,
            scale: isMoving ? 1.1 : 1,
            rotate: isMoving ? (cssX > prevPosRef.current.x ? 15 : -15) : 0,
            squish: isMoving ? 0.8 : 1,
        },
        config: { tension: 380, friction: 20 },
        immediate: isCurrentPlayer,
    });

    return (
        <animated.div
            ref={el => onRef?.(player.id, el)}
            style={{
                position: 'absolute',
                transform: to(
                    [springs.x, springs.y, springs.scale, springs.rotate, springs.squish],
                    (x, y, s, r, sq) => 
                    `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg) scaleY(${sq})`
                ),
                width: '25px', // PLAYER_SIZE
                height: '25px', // PLAYER_SIZE
                backgroundColor: isCurrentPlayer ? 'hsl(200, 100%, 60%)' : 'hsl(0, 70%, 50%)',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.7)',
                boxShadow: isCurrentPlayer 
                    ? '0 0 10px hsl(200, 100%, 75%)' 
                    : isMoving 
                        ? '0 0 15px rgba(255,255,255,0.3)' 
                        : '0 0 5px black',
                zIndex: isCurrentPlayer ? 3 : 1,
            }}
        >
            <animated.div
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: isMoving 
                        ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)'
                        : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%)',
                }}
            />
        </animated.div>
    );
} 