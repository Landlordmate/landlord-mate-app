import React from 'react';

/**
 * The Landlord Mate mascot.
 *
 * Usage:
 *   <TLMMascot pose="thumbsup" size={180} />
 *   <TLMMascot pose="certificates" size={220} animate="bob" />
 *   <TLMMascot pose="wave" size={140} animate="wave" />
 *   <TLMMascot pose="head" size={40} />            // small avatar, for Ask Mate
 *
 * Poses:  thumbsup | certificates | wave | head
 * Animate: none (default) | bob | wave | thumb | pop | greet
 *
 * greet is the onboarding entrance: he rises into frame, settles, then
 * waves once and rests. Use it with pose="wave". Remount the component
 * (a changing key) to replay it.
 *
 * Colours come from NAVY / BLUE below. If the brand hexes differ, change them
 * in this one place and every instance updates.
 *
 * Respects prefers-reduced-motion: all animation is disabled for users who
 * have asked their system for less movement.
 */

const NAVY = '#16294A';
const BLUE = '#1B7FE0';

const styles = `
@keyframes tlm-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
}
@keyframes tlm-wave {
  0%, 60%, 100% { transform: rotate(0deg); }
  70%           { transform: rotate(-16deg); }
  80%           { transform: rotate(8deg); }
  90%           { transform: rotate(-12deg); }
}
@keyframes tlm-thumb {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-14px) rotate(-6deg); }
}
@keyframes tlm-pop {
  0%   { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
/* Entrance for the greeting: he rises into frame and settles, rather than
   just fading in. Paired with tlm-wave-once so the wave lands after he
   has arrived. */
@keyframes tlm-rise {
  0%   { transform: translateY(40px) scale(0.86); opacity: 0; }
  55%  { transform: translateY(-6px) scale(1.03); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
/* A single deliberate wave that finishes and rests. The looping tlm-wave is
   for ambient use; a greeting that never stops waving is maddening. */
@keyframes tlm-wave-once {
  0%   { transform: rotate(0deg); }
  15%  { transform: rotate(-18deg); }
  30%  { transform: rotate(10deg); }
  45%  { transform: rotate(-16deg); }
  60%  { transform: rotate(8deg); }
  75%  { transform: rotate(-10deg); }
  100% { transform: rotate(0deg); }
}
.tlm-bob   { animation: tlm-bob 3.2s ease-in-out infinite; }
.tlm-pop   { animation: tlm-pop 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
.tlm-rise  { animation: tlm-rise 0.62s cubic-bezier(0.22, 1.15, 0.36, 1) both; }
.tlm-arm-wave  { animation: tlm-wave 3s ease-in-out infinite; transform-origin: 200px 590px; }
.tlm-arm-wave-once { animation: tlm-wave-once 1.5s ease-in-out 0.45s both; transform-origin: 200px 590px; }
.tlm-arm-thumb { animation: tlm-thumb 2.4s ease-in-out infinite; transform-origin: 200px 570px; }

@media (prefers-reduced-motion: reduce) {
  .tlm-bob, .tlm-pop, .tlm-rise, .tlm-arm-wave, .tlm-arm-wave-once, .tlm-arm-thumb { animation: none !important; }
}
`;

/* ---------- shared parts ---------- */

const Legs = () => (
  <g>
    <path d="M 330 770 L 330 872" stroke={NAVY} strokeWidth="54" fill="none" />
    <path d="M 470 770 L 470 872" stroke={NAVY} strokeWidth="54" fill="none" />
    <rect x="258" y="858" width="118" height="48" rx="24" fill={NAVY} />
    <rect x="424" y="858" width="118" height="48" rx="24" fill={NAVY} />
  </g>
);

const Chimney = () => <rect x="530" y="175" width="60" height="140" fill={NAVY} />;

const Body = () => (
  <path d="M 400 185 L 622 375 L 622 790 L 178 790 L 178 375 Z" fill={NAVY} />
);

const Roof = () => (
  <path d="M 400 145 L 700 405 L 650 405 L 400 190 L 150 405 L 100 405 Z" fill={BLUE} />
);

const Tick = () => (
  <path
    d="M 305 722 L 356 773 L 490 668"
    stroke={BLUE}
    strokeWidth="40"
    strokeLinejoin="miter"
    strokeLinecap="square"
    fill="none"
  />
);

/* The face is one white window. The vertical frame bar stops halfway down so
   the smile reads as a single unbroken line rather than two halves. */
const Face = () => (
  <g>
    <rect x="285" y="430" width="230" height="200" rx="12" fill="#FFFFFF" />
    <rect x="285" y="517" width="230" height="6" fill={NAVY} />
    <rect x="397" y="430" width="6" height="87" fill={NAVY} />
    <circle cx="340" cy="477" r="24" fill={NAVY} />
    <circle cx="460" cy="477" r="24" fill={NAVY} />
    <circle cx="332" cy="468" r="8" fill="#FFFFFF" />
    <circle cx="452" cy="468" r="8" fill="#FFFFFF" />
    <path
      d="M 332 558 Q 400 626 468 558"
      stroke={NAVY}
      strokeWidth="12"
      strokeLinecap="round"
      fill="none"
    />
  </g>
);

/* Right arm resting on the hip. Drawn as two strokes meeting at the hand so it
   reads as a bent elbow rather than a closed loop. */
const ArmHip = () => (
  <g>
    <path
      d="M 612 500 Q 692 542 678 604"
      stroke={NAVY}
      strokeWidth="46"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 678 604 Q 668 646 626 640"
      stroke={NAVY}
      strokeWidth="42"
      strokeLinecap="round"
      fill="none"
    />
  </g>
);

const ArmThumbsUp = ({ animate }) => (
  <g className={animate === 'thumb' ? 'tlm-arm-thumb' : undefined}>
    <path
      d="M 195 565 Q 142 548 131 500"
      stroke={NAVY}
      strokeWidth="46"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="128" cy="486" r="38" fill={NAVY} />
    <rect x="110" y="404" width="35" height="70" rx="17" fill={NAVY} />
  </g>
);

const ArmWave = ({ animate }) => (
  <g className={animate === 'wave' ? 'tlm-arm-wave' : animate === 'greet' ? 'tlm-arm-wave-once' : undefined}>
    <path
      d="M 195 570 Q 140 552 124 500"
      stroke={NAVY}
      strokeWidth="46"
      strokeLinecap="round"
      fill="none"
    />
    <ellipse cx="112" cy="462" rx="40" ry="46" transform="rotate(-16 112 462)" fill={NAVY} />
    <rect
      x="142"
      y="440"
      width="30"
      height="54"
      rx="15"
      transform="rotate(22 157 467)"
      fill={NAVY}
    />
  </g>
);

const ArmHolding = () => (
  <path
    d="M 195 580 Q 150 612 145 668"
    stroke={NAVY}
    strokeWidth="46"
    strokeLinecap="round"
    fill="none"
  />
);

const Certificates = () => (
  <>
    <g transform="rotate(-7 150 620)">
      <rect x="62" y="524" width="176" height="212" rx="8" fill="#FFFFFF" stroke={NAVY} strokeWidth="6" />
      <rect x="76" y="512" width="176" height="212" rx="8" fill="#FFFFFF" stroke={NAVY} strokeWidth="6" />
      <rect x="90" y="500" width="176" height="212" rx="8" fill="#FFFFFF" stroke={NAVY} strokeWidth="6" />
      <rect x="112" y="528" width="86" height="11" rx="5" fill={BLUE} />
      <rect x="112" y="560" width="132" height="9" rx="4" fill={NAVY} opacity="0.3" />
      <rect x="112" y="588" width="132" height="9" rx="4" fill={NAVY} opacity="0.3" />
      <rect x="112" y="616" width="96" height="9" rx="4" fill={NAVY} opacity="0.3" />
      <path
        d="M 118 662 L 138 682 L 182 636"
        stroke={BLUE}
        strokeWidth="17"
        strokeLinejoin="miter"
        strokeLinecap="square"
        fill="none"
      />
    </g>
    <g>
      <circle cx="145" cy="676" r="37" fill={NAVY} />
      <rect x="118" y="608" width="34" height="60" rx="17" fill={NAVY} />
    </g>
  </>
);

/* ---------- component ---------- */

export default function TLMMascot({
  pose = 'thumbsup',
  size = 200,
  animate = 'none',
  className = '',
  title,
  bg = 'none',
}) {
  // Head-only crop for small avatars (Ask Mate, comment threads, favicons).
  const isHead = pose === 'head';
  const viewBox = isHead ? '150 145 500 500' : '60 130 680 800';

  const label =
    title ?? (isHead ? 'The Landlord Mate' : 'The Landlord Mate mascot');

  const isChip = bg === 'light';
  const svgHeight = isHead ? size : size * 1.18;

  // Whole-body animation (bob, pop, rise) has to sit on the OUTERMOST element.
  // With bg="light" that's the backdrop chip - putting it on the inner svg
  // would animate him inside a chip that stayed still.
  const motionClass = [
    animate === 'bob' ? 'tlm-bob' : '',
    animate === 'pop' ? 'tlm-pop' : '',
    animate === 'greet' ? 'tlm-rise' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const svg = (
    <svg
      viewBox={viewBox}
      width={size}
      height={svgHeight}
      className={isChip ? undefined : [motionClass, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <title>{label}</title>

      {!isHead && <Legs />}

      {!isHead && pose === 'thumbsup' && <ArmThumbsUp animate={animate} />}
      {!isHead && pose === 'wave' && <ArmWave animate={animate} />}
      {!isHead && pose === 'certificates' && <ArmHolding />}
      {!isHead && pose !== 'wave' && <ArmHip />}

      <Chimney />
      <Body />
      <Roof />
      {!isHead && <Tick />}
      <Face />

      {pose === 'certificates' && <Certificates />}
    </svg>
  );

  // The mascot's body/arms/legs are navy - invisible against a dark navy app
  // background (only the blue roof/tick and white face have contrast there).
  // bg="light" drops him on a light backdrop chip so the whole character
  // reads. Use it anywhere he sits on a dark background; skip it on already-
  // light surfaces (the white pre-login cards, print, email) where the
  // plain artwork already contrasts fine.
  if (isChip) {
    const isCircle = isHead;
    // Padding scales with size so small avatars and large illustrations both
    // get a proportionate breathing margin around the artwork.
    const pad = Math.round(size * (isCircle ? 0.22 : 0.14));
    return (
      <>
        <style>{styles}</style>
        <div
          className={[motionClass, className].filter(Boolean).join(' ') || undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size + pad * 2,
            height: svgHeight + pad * 2,
            padding: pad,
            boxSizing: 'content-box',
            background: '#FFFFFF',
            borderRadius: isCircle ? '50%' : Math.round(size * 0.16),
            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
            flexShrink: 0,
          }}
        >
          {svg}
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      {svg}
    </>
  );
}
