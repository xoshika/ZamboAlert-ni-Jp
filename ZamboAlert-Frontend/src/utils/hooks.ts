import { useState, useRef, useEffect } from 'react';

export function useAnimatedValue(target: number, speed = 0.08) {
  const [val, setVal] = useState(target);
  const ref = useRef(val);
  useEffect(() => {
    ref.current = val;
    let animId: number;
    const tick = () => {
      const diff = target - ref.current;
      if (Math.abs(diff) < 0.1) {
        setVal(target);
        return;
      }
      ref.current += diff * speed;
      setVal(ref.current);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [target, speed]);
  return val;
}
