'use client';

import React, { useEffect, useState } from 'react';
import ReactConfetti from 'react-confetti';

interface CelebrationConfettiProps {
  run: boolean;
}

export default function CelebrationConfetti({ run }: CelebrationConfettiProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!run) return;

    const updateSize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [run]);

  if (!run || size.width === 0 || size.height === 0) {
    return null;
  }

  return (
    <ReactConfetti
      width={size.width}
      height={size.height}
      numberOfPieces={450}
      gravity={0.3}
      recycle={false}
      tweenDuration={5000}
      style={{ pointerEvents: 'none' }}
    />
  );
}
