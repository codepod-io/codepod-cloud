import { useEffect, useRef, useState } from "react";

// from https://github.com/JohannesKlauss/react-fps
export function useFps(windowWidth: number) {
  const lastFpsValues = useRef<number[]>([]);
  const frames = useRef(0);
  const prevTime = useRef(performance.now());
  const animRef = useRef(0);
  const [fps, setFps] = useState<number[]>([]);

  const calcFps = () => {
    const t = performance.now();

    frames.current += 1;

    if (t > prevTime.current + 1000) {
      const elapsedTime = t - prevTime.current;

      const currentFps = Math.round((frames.current * 1000) / elapsedTime);

      lastFpsValues.current = lastFpsValues.current.concat(currentFps);

      if (elapsedTime > 1500) {
        for (let i = 1; i <= (elapsedTime - 1000) / 1000; i++) {
          lastFpsValues.current = lastFpsValues.current.concat(0);
        }
      }

      lastFpsValues.current = lastFpsValues.current.slice(
        Math.max(lastFpsValues.current.length - windowWidth, 0)
      );

      // setFps(lastFpsValues.current);
      // only use up to 50 values
      setFps(lastFpsValues.current.slice(-50));

      frames.current = 0;
      prevTime.current = performance.now();
    }

    animRef.current = requestAnimationFrame(calcFps);
  };

  useEffect(() => {
    animRef.current = requestAnimationFrame(calcFps);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const avgFps = (fps.reduce((a, b) => a + b, 0) / fps.length).toFixed(2);
  const maxFps = Math.max.apply(Math.max, fps);
  const currentFps = fps[fps.length - 1];

  return { fps, avgFps, maxFps, currentFps };
}

export const FpsMeter = () => {
  const width = 240;
  const { fps, avgFps, maxFps, currentFps } = useFps(Math.floor(width / 2));

  return (
    <div>
      <span>
        {currentFps} FPS ({avgFps} Avg)
      </span>
      <div>
        {fps.map((fps, i) => (
          <div
            key={i}
            style={{
              height: fps / 4 + "px",
              width: "2px",
              display: "inline-block",
              backgroundColor: "#E200F7",
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};
