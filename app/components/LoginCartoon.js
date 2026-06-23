'use client';

import React from 'react';

export default function LoginCartoon({ focusedField, emailLength = 0 }) {
  const isEmail = focusedField === 'email';
  const isPassword = focusedField === 'password';

  // Calculate eye movement horizontal translation
  // emailLength varies from 0 to 30. We map this to dx of -3 to +3
  const dx = isEmail ? Math.min(3, Math.max(-3, -3 + (emailLength * 0.25))) : 0;
  const dy = isEmail ? 3.5 : 0; // Look down when focused on email

  // Pupils style
  const pupilStyle = {
    transform: `translate(${dx}px, ${dy}px)`,
    transition: isEmail ? 'transform 0.08s ease-out' : 'transform 0.3s ease-in-out',
  };

  // Left hand style
  // Left eye is at cx=74, cy=105
  // Left hand starts at x=35, y=148
  const leftHandStyle = {
    transform: isPassword 
      ? 'translate(24px, -52px) rotate(25deg)' 
      : 'translate(0px, 0px) rotate(0deg)',
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: '35px 148px'
  };

  // Right hand style
  // Right eye is at cx=126, cy=105
  // Right hand starts at x=137, y=148
  const rightHandStyle = {
    transform: isPassword 
      ? 'translate(-24px, -52px) rotate(-25deg)' 
      : 'translate(0px, 0px) rotate(0deg)',
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: '165px 148px'
  };

  return (
    <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'center', margin: '0 auto -1.5rem auto', width: '100%', maxWidth: '370px', position: 'relative', zIndex: 10 }}>
      {/* Dynamic blink keyframe styling */}
      <style>{`
        .yeti-eye-left {
          transform-origin: 74px 105px;
          animation: yeti-blink 5s infinite;
        }
        .yeti-eye-right {
          transform-origin: 126px 105px;
          animation: yeti-blink 5s infinite;
        }
        @keyframes yeti-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
      `}</style>

      {/* 1. Panda Cartoon SVG */}
      <svg 
        viewBox="0 0 200 200" 
        width="112" 
        height="112" 
        style={{ overflow: 'visible' }}
      >
        {/* Ears */}
        <circle cx="48" cy="58" r="23" fill="#1e293b" />
        <circle cx="48" cy="58" r="13" fill="#334155" />
        
        <circle cx="152" cy="58" r="23" fill="#1e293b" />
        <circle cx="152" cy="58" r="13" fill="#334155" />

        {/* Head */}
        <rect x="36" y="60" width="128" height="115" rx="52" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" />

        {/* Eye Patches */}
        <ellipse cx="72" cy="104" rx="19" ry="24" fill="#1e293b" transform="rotate(-15 72 104)" />
        <ellipse cx="128" cy="104" rx="19" ry="24" fill="#1e293b" transform="rotate(15 128 104)" />

        {/* Eyes */}
        <circle cx="74" cy="105" r="15" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" className="yeti-eye-left" />
        <circle cx="74" cy="105" r="6" fill="#0f172a" style={pupilStyle} />
        <circle cx="72" cy="103" r="2" fill="#ffffff" style={pupilStyle} />

        <circle cx="126" cy="105" r="15" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" className="yeti-eye-right" />
        <circle cx="126" cy="105" r="6" fill="#0f172a" style={pupilStyle} />
        <circle cx="124" cy="103" r="2" fill="#ffffff" style={pupilStyle} />

        {/* Muzzle */}
        <ellipse cx="100" cy="131" rx="17" ry="11" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M94 127 C94 124, 106 124, 106 127 C106 130, 100 133, 100 133 C100 133, 94 130, 94 127 Z" fill="#0f172a" />
        <path d="M95 134 C97 137, 100 137, 100 134 C100 137, 103 137, 105 134" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />

        {/* Cheeks */}
        <circle cx="58" cy="123" r="5" fill="#f472b6" opacity="0.35" />
        <circle cx="142" cy="123" r="5" fill="#f472b6" opacity="0.35" />

        {/* Hands */}
        <g style={leftHandStyle}>
          <rect x="35" y="148" width="28" height="42" rx="14" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />
          <circle cx="49" cy="158" r="8" fill="#f1f5f9" />
          <circle cx="42" cy="172" r="3.5" fill="#f1f5f9" />
          <circle cx="49" cy="175" r="3.5" fill="#f1f5f9" />
          <circle cx="56" cy="172" r="3.5" fill="#f1f5f9" />
        </g>
        <g style={rightHandStyle}>
          <rect x="137" y="148" width="28" height="42" rx="14" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />
          <circle cx="151" cy="158" r="8" fill="#f1f5f9" />
          <circle cx="144" cy="172" r="3.5" fill="#f1f5f9" />
          <circle cx="151" cy="175" r="3.5" fill="#f1f5f9" />
          <circle cx="158" cy="172" r="3.5" fill="#f1f5f9" />
        </g>
      </svg>

      {/* 2. Cyber Bear Cartoon SVG */}
      <svg 
        viewBox="0 0 200 200" 
        width="112" 
        height="112" 
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="earInner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#9333ea" />
          </radialGradient>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d8b4fe" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* Ears */}
        <circle cx="48" cy="58" r="23" fill="#c084fc" />
        <circle cx="48" cy="58" r="13" fill="url(#earInner)" />
        
        <circle cx="152" cy="58" r="23" fill="#c084fc" />
        <circle cx="152" cy="58" r="13" fill="url(#earInner)" />

        {/* Head */}
        <rect x="36" y="60" width="128" height="115" rx="52" fill="url(#bodyGrad)" />

        {/* Face Inner Plate */}
        <rect x="46" y="74" width="108" height="92" rx="40" fill="#f5f3ff" />

        {/* Eyes */}
        <circle cx="74" cy="105" r="15" fill="#ffffff" stroke="#e9d5ff" strokeWidth="1.5" className="yeti-eye-left" />
        <circle cx="74" cy="105" r="6" fill="#3b0764" style={pupilStyle} />
        <circle cx="72" cy="103" r="2" fill="#ffffff" style={pupilStyle} />

        <circle cx="126" cy="105" r="15" fill="#ffffff" stroke="#e9d5ff" strokeWidth="1.5" className="yeti-eye-right" />
        <circle cx="126" cy="105" r="6" fill="#3b0764" style={pupilStyle} />
        <circle cx="124" cy="103" r="2" fill="#ffffff" style={pupilStyle} />

        {/* Muzzle */}
        <ellipse cx="100" cy="131" rx="17" ry="11" fill="#edd9ff" />
        <path d="M94 127 C94 124, 106 124, 106 127 C106 130, 100 133, 100 133 C100 133, 94 130, 94 127 Z" fill="#0f172a" />
        <path d="M95 134 C97 137, 100 137, 100 134 C100 137, 103 137, 105 134" fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />

        {/* Cheeks */}
        <circle cx="58" cy="123" r="5" fill="#f472b6" opacity="0.45" />
        <circle cx="142" cy="123" r="5" fill="#f472b6" opacity="0.45" />

        {/* Hands */}
        <g style={leftHandStyle}>
          <rect x="35" y="148" width="28" height="42" rx="14" fill="#a855f7" stroke="#3b0764" strokeWidth="2.5" />
          <circle cx="49" cy="158" r="8" fill="#edd9ff" />
          <circle cx="42" cy="172" r="3.5" fill="#edd9ff" />
          <circle cx="49" cy="175" r="3.5" fill="#edd9ff" />
          <circle cx="56" cy="172" r="3.5" fill="#edd9ff" />
        </g>
        <g style={rightHandStyle}>
          <rect x="137" y="148" width="28" height="42" rx="14" fill="#a855f7" stroke="#3b0764" strokeWidth="2.5" />
          <circle cx="151" cy="158" r="8" fill="#edd9ff" />
          <circle cx="144" cy="172" r="3.5" fill="#edd9ff" />
          <circle cx="151" cy="175" r="3.5" fill="#edd9ff" />
          <circle cx="158" cy="172" r="3.5" fill="#edd9ff" />
        </g>
      </svg>

      {/* 3. Glow Cat Cartoon SVG */}
      <svg 
        viewBox="0 0 200 200" 
        width="112" 
        height="112" 
        style={{ overflow: 'visible' }}
      >
        {/* Ears */}
        <polygon points="32,70 18,25 65,48" fill="#4c1d95" />
        <polygon points="36,66 26,34 58,48" fill="#f472b6" />

        <polygon points="168,70 182,25 135,48" fill="#4c1d95" />
        <polygon points="164,66 174,34 142,48" fill="#f472b6" />

        {/* Head */}
        <rect x="36" y="60" width="128" height="115" rx="52" fill="#4c1d95" />

        {/* Face Inner Plate */}
        <rect x="46" y="74" width="108" height="92" rx="40" fill="#edd9ff" />

        {/* Eyes */}
        <circle cx="74" cy="105" r="15" fill="#a7f3d0" stroke="#34d399" strokeWidth="1.5" className="yeti-eye-left" />
        <ellipse cx="74" cy="105" rx="3.5" ry="11" fill="#064e3b" style={pupilStyle} />
        <circle cx="72" cy="102" r="1.5" fill="#ffffff" style={pupilStyle} />

        <circle cx="126" cy="105" r="15" fill="#a7f3d0" stroke="#34d399" strokeWidth="1.5" className="yeti-eye-right" />
        <ellipse cx="126" cy="105" rx="3.5" ry="11" fill="#064e3b" style={pupilStyle} />
        <circle cx="124" cy="102" r="1.5" fill="#ffffff" style={pupilStyle} />

        {/* Whiskers */}
        <g opacity="0.85">
          <line x1="36" y1="126" x2="14" y2="122" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" />
          <line x1="36" y1="133" x2="11" y2="135" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" />

          <line x1="164" y1="126" x2="186" y2="122" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" />
          <line x1="164" y1="133" x2="189" y2="135" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Muzzle */}
        <ellipse cx="100" cy="131" rx="17" ry="11" fill="#edd9ff" />
        <path d="M94 127 C94 124, 106 124, 106 127 C106 130, 100 133, 100 133 C100 133, 94 130, 94 127 Z" fill="#f472b6" />
        <path d="M95 134 C97 137, 100 137, 100 134 C100 137, 103 137, 105 134" fill="none" stroke="#4c1d95" strokeWidth="1.5" strokeLinecap="round" />

        {/* Cheeks */}
        <circle cx="58" cy="123" r="5" fill="#f472b6" opacity="0.45" />
        <circle cx="142" cy="123" r="5" fill="#f472b6" opacity="0.45" />

        {/* Hands */}
        <g style={leftHandStyle}>
          <rect x="35" y="148" width="28" height="42" rx="14" fill="#a855f7" stroke="#4c1d95" strokeWidth="2.5" />
          <circle cx="49" cy="158" r="8" fill="#f472b6" />
          <circle cx="42" cy="172" r="3.5" fill="#f472b6" />
          <circle cx="49" cy="175" r="3.5" fill="#f472b6" />
          <circle cx="56" cy="172" r="3.5" fill="#f472b6" />
        </g>
        <g style={rightHandStyle}>
          <rect x="137" y="148" width="28" height="42" rx="14" fill="#a855f7" stroke="#4c1d95" strokeWidth="2.5" />
          <circle cx="151" cy="158" r="8" fill="#f472b6" />
          <circle cx="144" cy="172" r="3.5" fill="#f472b6" />
          <circle cx="151" cy="175" r="3.5" fill="#f472b6" />
          <circle cx="158" cy="172" r="3.5" fill="#f472b6" />
        </g>
      </svg>
    </div>
  );
}
