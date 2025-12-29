import React, { useEffect, useRef } from 'react';

interface WaveformProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const Waveform: React.FC<WaveformProps> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Google Assistant-like colors: Blue, Red, Yellow, Green
    const colors = ['#4285F4', '#DB4437', '#F4B400', '#0F9D58'];

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const bufferLength = analyser ? analyser.frequencyBinCount : 0;
      const dataArray = new Uint8Array(bufferLength);
      
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      }

      const barWidth = 16;
      const spacing = 24;
      const totalWidth = (colors.length * barWidth) + ((colors.length - 1) * spacing);
      const startX = (width - totalWidth) / 2;
      const centerY = height / 2;

      colors.forEach((color, i) => {
        let amplitude = 0;
        if (analyser && isPlaying) {
            // Map specific frequency ranges to each bar
            // Bar 0 (Blue): Low Bass ~ 0-10
            // Bar 1 (Red): Bass/LowMid ~ 10-30
            // Bar 2 (Yellow): Mids ~ 30-80
            // Bar 3 (Green): Highs ~ 80+
            let startIndex = 0;
            let rangeLength = 10;
            
            if (i === 1) { startIndex = 10; rangeLength = 20; }
            if (i === 2) { startIndex = 30; rangeLength = 50; }
            if (i === 3) { startIndex = 80; rangeLength = 100; }
            
            // Safety check
            startIndex = Math.min(startIndex, bufferLength - 1);
            rangeLength = Math.min(rangeLength, bufferLength - startIndex);
            
            let sum = 0;
            if (rangeLength > 0) {
                for(let j=0; j<rangeLength; j++) {
                    sum += dataArray[startIndex + j] || 0;
                }
                amplitude = sum / rangeLength; // 0-255
            }
        }
        
        // Idle animation
        // gentle sine wave breathing
        const time = Date.now() / 300;
        const idleHeight = 12 + (Math.sin(time + (i * 0.8)) * 4);
        
        // Active height
        // Scale amplitude (0-255) to reasonable pixels (e.g. 0-60)
        const activeHeight = 12 + (amplitude * 0.4);
        
        const h = isPlaying ? Math.max(12, activeHeight) : idleHeight;
        
        ctx.fillStyle = color;
        
        const x = startX + (i * (barWidth + spacing));
        const y = centerY - (h / 2);
        const radius = barWidth / 2;

        // Draw rounded pill manually for compatibility
        ctx.beginPath();
        // Top arc
        ctx.arc(x + radius, y + radius, radius, Math.PI, 0);
        // Right side
        ctx.lineTo(x + barWidth, y + h - radius);
        // Bottom arc
        ctx.arc(x + radius, y + h - radius, radius, 0, Math.PI);
        // Left side
        ctx.lineTo(x, y + radius);
        ctx.fill();
      });
    };

    draw();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [analyser, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={100}
      className="w-full h-24" 
    />
  );
};

export default Waveform;