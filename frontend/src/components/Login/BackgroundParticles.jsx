import React from 'react';

const BackgroundParticles = ({ particles }) => {
  return (
    <div className="particles-container">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="particle"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            opacity: particle.opacity,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            background: particle.color,
          }}
        />
      ))}
    </div>
  );
};

export default BackgroundParticles;
