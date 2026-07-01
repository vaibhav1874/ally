import React, { useRef, useEffect } from 'react';

/**
 * OrbVisualizer: A gorgeous canvas-based voice reactive companion orb.
 * States: 'idle' | 'listening' | 'thinking' | 'speaking'
 */
export default function OrbVisualizer({ state = 'idle', amplitude = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let tick = 0;

    // Handle high DPI displays
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    // Particle pool for thinking/speaking effects
    const particles = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 45 + Math.random() * 20,
        speed: 0.02 + Math.random() * 0.03,
        size: 1 + Math.random() * 2,
        color: i % 2 === 0 ? 'rgba(0, 180, 216, 0.6)' : 'rgba(157, 78, 221, 0.6)',
      });
    }

    const render = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const centerX = w / 2;
      const centerY = h / 2;
      const baseRadius = 50;

      ctx.clearRect(0, 0, w, h);
      tick += 1;

      // Draw subtle backing glow
      const glowGrad = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.2,
        centerX, centerY, baseRadius * 2.5
      );
      
      if (state === 'listening') {
        glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (state === 'thinking') {
        glowGrad.addColorStop(0, 'rgba(157, 78, 221, 0.15)');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (state === 'speaking') {
        glowGrad.addColorStop(0, 'rgba(0, 180, 216, 0.15)');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        // Idle
        glowGrad.addColorStop(0, 'rgba(157, 78, 221, 0.08)');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // State-Specific Background Rings
      if (state === 'listening') {
        // Sonar expanding rings
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
          const progress = ((tick + i * 40) % 120) / 120;
          const radius = baseRadius + progress * 60;
          const alpha = 1 - progress;
          ctx.strokeStyle = `rgba(16, 185, 129, ${alpha * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Drawing Core Glowing Orb
      const orbGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.2, centerY - baseRadius * 0.2, baseRadius * 0.1,
        centerX, centerY, baseRadius
      );

      let color1, color2;
      if (state === 'listening') {
        color1 = '#34d399';
        color2 = '#059669';
      } else if (state === 'thinking') {
        color1 = '#c084fc';
        color2 = '#7c3aed';
      } else if (state === 'speaking') {
        color1 = '#22d3ee';
        color2 = '#0891b2';
      } else {
        // Idle
        color1 = '#e9d5ff';
        color2 = '#7e22ce';
      }

      // Add a slight shift to make it feel alive
      const shiftX = Math.sin(tick * 0.05) * 2;
      const shiftY = Math.cos(tick * 0.04) * 2;

      const dynamicRadius = baseRadius + (
        state === 'listening' ? Math.sin(tick * 0.15) * 3 :
        state === 'speaking' ? (amplitude * 18) :
        Math.sin(tick * 0.04) * 2.5
      );

      const sphereGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.15 + shiftX, 
        centerY - baseRadius * 0.15 + shiftY, 
        dynamicRadius * 0.05,
        centerX + shiftX, 
        centerY + shiftY, 
        dynamicRadius
      );
      
      sphereGrad.addColorStop(0, color1);
      sphereGrad.addColorStop(0.6, color2);
      sphereGrad.addColorStop(1, '#020005');

      ctx.shadowBlur = state === 'listening' ? 30 : state === 'thinking' ? 45 : 25;
      ctx.shadowColor = state === 'listening' ? '#10b981' : color2;

      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(centerX + shiftX, centerY + shiftY, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Reset shadows for overlay lines
      ctx.shadowBlur = 0;

      // Draw overlay visualizer items
      if (state === 'thinking') {
        // Orbiting energy points
        particles.forEach(p => {
          p.angle += p.speed;
          const x = centerX + Math.cos(p.angle) * p.radius;
          const y = centerY + Math.sin(p.angle) * p.radius;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (state === 'speaking') {
        // Draw intersecting audio sine waves
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        for (let x = centerX - baseRadius; x <= centerX + baseRadius; x += 1) {
          const relativeX = (x - (centerX - baseRadius)) / (baseRadius * 2);
          const yOffset = Math.sin(relativeX * Math.PI * 4 + tick * 0.25) * (amplitude * 12);
          const y = centerY + yOffset;
          if (x === centerX - baseRadius) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [state, amplitude]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '1.5rem 0' }}>
      <div 
        className={`companion-orb-container`}
        style={{
          width: '200px',
          height: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          position: 'relative'
        }}
      >
        <canvas 
          ref={canvasRef} 
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div 
        style={{ 
          marginTop: '0.75rem', 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.8rem', 
          textTransform: 'uppercase', 
          letterSpacing: '0.15em',
          color: state === 'listening' ? 'var(--accent-emerald)' : 
                 state === 'thinking' ? 'var(--accent-purple)' : 
                 state === 'speaking' ? 'var(--accent-blue)' : 
                 'var(--text-muted)'
        }}
      >
        {state === 'idle' && 'Ally: Resting'}
        {state === 'listening' && 'Ally: Listening'}
        {state === 'thinking' && 'Ally: Thinking'}
        {state === 'speaking' && 'Ally: Speaking'}
      </div>
    </div>
  );
}
