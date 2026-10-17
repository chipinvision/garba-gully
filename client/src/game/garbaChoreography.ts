/**
 * garbaChoreography.ts
 *
 * Culturally authentic Gujarati Garba & Dandiya Raas animation system.
 * Features:
 * - 6-Beat Tran Tali (Three-Clap) traditional Garba cycle with authentic footwork,
 *   weight transfer, knee dips (baithak), graceful arm mudras, and chakkar (spin).
 * - 4-Beat Dandiya Raas cycle with two visible decorated sticks, center clacks,
 *   partner high-right/cross-left strikes, and overhead 360° spin strikes.
 * - Idle breathing and natural stride walking states with seamless blending.
 * - High-fidelity vector rendering for both Phaser 3 Graphics and HTML5 Canvas 2D.
 */

import type { OutfitDef, AvatarDef } from '../types';

export type DanceStyle = 'garba' | 'dandiya';
export type ViewAngle = 'front' | 'iso' | 'side';

/** Musical pattern phase: psi = 2π * (BPM / 60 / beatsPerPattern) * t + offset. */
export function getRhythmPhase(
  elapsedSeconds: number,
  bpm: number,
  beatsPerPattern: number,
  phaseOffset = 0,
): number {
  const safeBpm = Number.isFinite(bpm) ? Math.max(1, bpm) : 116;
  const safeBeats = Number.isFinite(beatsPerPattern) ? Math.max(1, beatsPerPattern) : 6;
  const cycles = (Math.max(0, elapsedSeconds) * safeBpm) / (60 * safeBeats) + phaseOffset;
  return ((cycles % 1) + 1) % 1;
}

export interface VectorDrawer {
  clear(): void;
  fillStyle(color: number | string, alpha?: number): void;
  lineStyle(width: number, color: number | string, alpha?: number): void;
  fillCircle(x: number, y: number, radius: number): void;
  strokeCircle(x: number, y: number, radius: number): void;
  fillEllipse(x: number, y: number, radiusX: number, radiusY: number, rotation?: number): void;
  strokeEllipse(x: number, y: number, radiusX: number, radiusY: number, rotation?: number): void;
  lineBetween(x1: number, y1: number, x2: number, y2: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
  fillPath(): void;
  strokePath(): void;
}

export interface DancePose {
  bodyY: number;
  bodyX: number;
  torsoTilt: number;       // radians
  facingAngle: number;     // radians (for spins)
  leftFoot: { x: number; y: number; planted: boolean };
  rightFoot: { x: number; y: number; planted: boolean };
  skirtFlare: number;      // multiplier (e.g. 1.0 = normal, 1.35 = flared)
  skirtSway: number;       // horizontal offset px
  leftHand: { x: number; y: number };
  rightHand: { x: number; y: number };
  headTilt: number;
  hasDandiya: boolean;
  leftStick?: { angle: number; length: number; tipX: number; tipY: number };
  rightStick?: { angle: number; length: number; tipX: number; tipY: number };
  impact?: { x: number; y: number; intensity: number; type: 'clap' | 'stick' };
  stepName: string;
  beatIndex: number;
  totalBeats: number;
  phase: number;
}

export interface StepInfo {
  beat: number;
  title: string;
  description: string;
  detail: string;
}

export const GARBA_STEPS: StepInfo[] = [
  {
    beat: 1,
    title: 'Pehli Tali: Step Right & Sweep',
    description: 'Right foot steps out diagonally, arms sweep in an inviting arc',
    detail: 'Weight shifts firmly onto the right foot as palms open outward in traditional Hasta Mudra.',
  },
  {
    beat: 2,
    title: 'Clap 1: Chest-Level Tali',
    description: 'Left foot crosses over; hands meet at chest level in crisp clap',
    detail: 'Palms align cleanly at chest height with torso turned slightly toward the rhythm.',
  },
  {
    beat: 3,
    title: 'Baithak Dip & Arm Flare',
    description: 'Wide step left with graceful knee dip and outward arm rotation',
    detail: 'Torso dips down gracefully in a traditional baithak while skirts expand with momentum.',
  },
  {
    beat: 4,
    title: 'Clap 2: Side Waist Tali',
    description: 'Right foot taps forward; hands sweep across for side clap',
    detail: 'A rhythmic waist-height clap on the left flank with eyes following hand trajectory.',
  },
  {
    beat: 5,
    title: 'Chakkar: 360° Circular Spin',
    description: 'Pivoting spin on the ball of the foot with billowing chaniya flare',
    detail: 'Centrifugal inertia billows the embroidered skirt as arms gracefully ascend overhead.',
  },
  {
    beat: 6,
    title: 'Clap 3: High Overhead Tali',
    description: 'High clap above the crown and smooth transition back to Beat 1',
    detail: 'Dancer reaches peak height with third clap, seamlessly returning to the circular formation.',
  },
];

export const DANDIYA_STEPS: StepInfo[] = [
  {
    beat: 1,
    title: 'Taal 1: Center Stick Clack',
    description: 'Both dandiya sticks strike together at chest center in a crisp "X"',
    detail: 'Dancer plants feet firmly and snaps stick tips together creating the signature metallic clack.',
  },
  {
    beat: 2,
    title: 'Taal 2: High Right Partner Strike',
    description: 'Step forward; right stick strikes high partner stick at 45°',
    detail: 'Right arm thrusts stick diagonally up and forward to greet the partner in the circular line.',
  },
  {
    beat: 3,
    title: 'Taal 3: Cross Left Partner Strike',
    description: 'Step back; left stick sweeps across diagonally to strike partner stick',
    detail: 'Weight shifts onto rear foot as left dandiya delivers an energetic cross-strike.',
  },
  {
    beat: 4,
    title: 'Taal 4: 360° Overhead Spin Strike',
    description: 'Rapid 360° pirouette with crossed dandiyas overhead and billowing skirt',
    detail: 'High double-stick overhead strike as the dancer spins and resets seamlessly for the next round.',
  },
];

// Helper: Smooth Hermite interpolation between values
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Helper: Linear interpolation
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Convert Hex string to number (#rrggbb -> 0xrrggbb)
export function hexToNum(hex: string): number {
  return parseInt(hex.replace(/^#/, ''), 16);
}

// Convert number to hex string (0xrrggbb -> #rrggbb)
export function numToHex(num: number): string {
  return '#' + num.toString(16).padStart(6, '0');
}

/**
 * Compute the authentic 6-beat Garba (Tran Tali) pose at normalized phase [0, 1).
 */
export function getGarbaPose(phase: number): DancePose {
  const normPhase = ((phase % 1) + 1) % 1;
  const tBeat = normPhase * 6;
  const currentBeat = Math.floor(tBeat);
  const beatSub = tBeat - currentBeat;
  const s = smoothStep(beatSub);

  let bodyY = 0;
  let bodyX = 0;
  let torsoTilt = 0;
  let facingAngle = 0;
  let leftFoot = { x: -7, y: 14, planted: true };
  let rightFoot = { x: 7, y: 14, planted: true };
  let skirtFlare = 1.0;
  let skirtSway = 0;
  let leftHand = { x: -14, y: 0 };
  let rightHand = { x: 14, y: 0 };
  let headTilt = 0;
  let impact: DancePose['impact'] = undefined;

  switch (currentBeat) {
    case 0: { // Beat 1: Step Right & Opening Sweep
      // Footwork: Right foot steps out diagonally right and plants
      rightFoot = {
        x: lerp(7, 14, s),
        y: lerp(14, 15, s),
        planted: true,
      };
      leftFoot = {
        x: lerp(-7, -4, s),
        y: lerp(14, 13, s),
        planted: false,
      };
      bodyX = lerp(0, 4, s);
      bodyY = lerp(0, 1.5, Math.sin(beatSub * Math.PI));
      torsoTilt = lerp(0, 0.08, s);
      headTilt = lerp(0, 0.05, s);

      // Arms sweep open in a graceful welcoming arc
      leftHand = {
        x: lerp(0, -18, s),
        y: lerp(-20, -10, s),
      };
      rightHand = {
        x: lerp(0, 20, s),
        y: lerp(-20, -6, s),
      };
      skirtFlare = lerp(1.15, 1.1, s);
      skirtSway = lerp(0, 4, s);
      break;
    }

    case 1: { // Beat 2: Cross Step & CLAP 1 (Chest Level)
      // Left foot steps across towards right and plants
      rightFoot = { x: 14, y: 15, planted: true };
      leftFoot = {
        x: lerp(-4, 2, s),
        y: lerp(13, 14, s),
        planted: s > 0.4,
      };
      bodyX = lerp(4, 3, s);
      bodyY = lerp(0, -1, Math.sin(beatSub * Math.PI));
      torsoTilt = lerp(0.08, 0.04, s);

      // Hands sweep inward and meet at chest height (x: 6, y: -14)
      const clapTargetX = 6;
      const clapTargetY = -14;
      leftHand = {
        x: lerp(-18, clapTargetX - 1.5, s),
        y: lerp(-10, clapTargetY, s),
      };
      rightHand = {
        x: lerp(20, clapTargetX + 1.5, s),
        y: lerp(-6, clapTargetY, s),
      };

      if (beatSub >= 0.85 || beatSub <= 0.15) {
        impact = {
          x: clapTargetX,
          y: clapTargetY,
          intensity: 1.0 - Math.min(Math.abs(beatSub - 0), Math.abs(beatSub - 1)) * 5,
          type: 'clap',
        };
      }
      skirtFlare = lerp(1.1, 1.0, s);
      skirtSway = lerp(4, 2, s);
      break;
    }

    case 2: { // Beat 3: Baithak Dip & Arm Flare
      // Left foot steps wide to the left, body dips down in baithak
      rightFoot = {
        x: lerp(14, 4, s),
        y: lerp(15, 13, s),
        planted: false,
      };
      leftFoot = {
        x: lerp(2, -15, s),
        y: lerp(14, 15, s),
        planted: true,
      };
      bodyX = lerp(3, -5, s);
      bodyY = lerp(0, 5, Math.sin(beatSub * Math.PI)); // noticeable dip
      torsoTilt = lerp(0.04, -0.09, s);
      headTilt = lerp(0.05, -0.06, s);

      // Arms sweep downward and flare outward
      leftHand = {
        x: lerp(6, -20, s),
        y: lerp(-14, 2, s),
      };
      rightHand = {
        x: lerp(6, 12, s),
        y: lerp(-14, 4, s),
      };
      skirtFlare = lerp(1.0, 1.25, s); // expands with knee bend
      skirtSway = lerp(2, -5, s);
      break;
    }

    case 3: { // Beat 4: Toe Tap & CLAP 2 (Side Waist Tali)
      // Right foot taps in, weight stays on left
      leftFoot = { x: -15, y: 15, planted: true };
      rightFoot = {
        x: lerp(4, -4, s),
        y: lerp(13, 14, s),
        planted: true,
      };
      bodyX = lerp(-5, -3, s);
      bodyY = lerp(5, 1, s);
      torsoTilt = lerp(-0.09, -0.06, s);

      // Hands meet on left side at waist height (x: -9, y: -10)
      const clap2X = -9;
      const clap2Y = -10;
      leftHand = {
        x: lerp(-20, clap2X - 1.5, s),
        y: lerp(2, clap2Y, s),
      };
      rightHand = {
        x: lerp(12, clap2X + 1.5, s),
        y: lerp(4, clap2Y, s),
      };

      if (beatSub >= 0.85 || beatSub <= 0.15) {
        impact = {
          x: clap2X,
          y: clap2Y,
          intensity: 1.0 - Math.min(Math.abs(beatSub - 0), Math.abs(beatSub - 1)) * 5,
          type: 'clap',
        };
      }
      skirtFlare = lerp(1.25, 1.05, s);
      skirtSway = lerp(-5, -2, s);
      break;
    }

    case 4: { // Beat 5: Chakkar 360° Circular Spin
      // Pivot on right foot ball, spin body 360 degrees
      facingAngle = beatSub * Math.PI * 2;
      rightFoot = { x: 0, y: 14, planted: true };
      leftFoot = {
        x: Math.cos(beatSub * Math.PI * 2) * 8,
        y: 14 + Math.sin(beatSub * Math.PI * 2) * 2,
        planted: false,
      };
      bodyX = lerp(-3, 0, s);
      bodyY = lerp(1, -2, Math.sin(beatSub * Math.PI));
      torsoTilt = Math.sin(beatSub * Math.PI * 2) * 0.05;

      // Arms rise in majestic overhead arc
      leftHand = {
        x: lerp(-9, -12, s) * Math.cos(beatSub * Math.PI),
        y: lerp(-10, -26, s),
      };
      rightHand = {
        x: lerp(-9, 12, s) * Math.cos(beatSub * Math.PI),
        y: lerp(-10, -26, s),
      };

      // Skirt flares out to maximum width with centrifugal inertia
      skirtFlare = lerp(1.05, 1.38, Math.sin(beatSub * Math.PI));
      skirtSway = Math.sin(beatSub * Math.PI * 2) * 6;
      break;
    }

    case 5: { // Beat 6: High Overhead CLAP 3 & Return
      // Both hands reach high overhead and clap together at (0, -28)
      const clap3X = 0;
      const clap3Y = -28;

      leftHand = {
        x: lerp(-12, clap3X - 1.5, Math.min(1, s * 1.5)),
        y: lerp(-26, clap3Y, Math.min(1, s * 1.5)),
      };
      rightHand = {
        x: lerp(12, clap3X + 1.5, Math.min(1, s * 1.5)),
        y: lerp(-26, clap3Y, Math.min(1, s * 1.5)),
      };

      if (beatSub <= 0.3) {
        impact = {
          x: clap3X,
          y: clap3Y,
          intensity: 1.0 - (beatSub / 0.3),
          type: 'clap',
        };
      }

      // Settling seamlessly back towards Beat 1 stance (ensures C1 loop continuity)
      if (beatSub > 0.4) {
        const returnT = (beatSub - 0.4) / 0.6;
        const rS = smoothStep(returnT);
        leftHand.x = lerp(clap3X - 1.5, 0, rS);
        leftHand.y = lerp(clap3Y, -20, rS);
        rightHand.x = lerp(clap3X + 1.5, 0, rS);
        rightHand.y = lerp(clap3Y, -20, rS);
      }

      rightFoot = {
        x: lerp(0, 7, s),
        y: 14,
        planted: true,
      };
      leftFoot = {
        x: lerp(0, -7, s),
        y: 14,
        planted: true,
      };
      bodyX = lerp(0, 0, s);
      bodyY = lerp(-2, 0, s);
      skirtFlare = lerp(1.38, 1.15, s);
      skirtSway = lerp(6, 0, s);
      break;
    }
  }

  return {
    bodyY,
    bodyX,
    torsoTilt,
    facingAngle,
    leftFoot,
    rightFoot,
    skirtFlare,
    skirtSway,
    leftHand,
    rightHand,
    headTilt,
    hasDandiya: false,
    impact,
    stepName: GARBA_STEPS[currentBeat].title,
    beatIndex: currentBeat + 1,
    totalBeats: 6,
    phase: normPhase,
  };
}

/**
 * Compute the authentic 4-beat Dandiya Raas pose at normalized phase [0, 1).
 */
export function getDandiyaPose(phase: number): DancePose {
  const normPhase = ((phase % 1) + 1) % 1;
  const tBeat = normPhase * 4;
  const currentBeat = Math.floor(tBeat);
  const beatSub = tBeat - currentBeat;
  const s = smoothStep(beatSub);

  let bodyY = 0;
  let bodyX = 0;
  let torsoTilt = 0;
  let facingAngle = 0;
  let leftFoot = { x: -8, y: 14, planted: true };
  let rightFoot = { x: 8, y: 14, planted: true };
  let skirtFlare = 1.0;
  let skirtSway = 0;
  let leftHand = { x: -12, y: -6 };
  let rightHand = { x: 12, y: -6 };
  let headTilt = 0;
  let leftStickAngle = 0.5;
  let rightStickAngle = -0.5;
  let impact: DancePose['impact'] = undefined;

  const STICK_LEN = 26;

  switch (currentBeat) {
    case 0: { // Beat 1: Center Stick Clack
      // Dancers bring sticks together at chest center to cross in crisp clack
      bodyX = 0;
      bodyY = lerp(0, 2, Math.sin(beatSub * Math.PI));
      leftFoot = { x: -8, y: 14, planted: true };
      rightFoot = { x: 8, y: 14, planted: true };

      // Hands position sticks so tips meet at (0, -16)
      leftHand = {
        x: lerp(-14, -8, s),
        y: lerp(-2, -8, s),
      };
      rightHand = {
        x: lerp(14, 8, s),
        y: lerp(-2, -8, s),
      };

      // Left stick angles up-right (~45 deg), right stick angles up-left (~-45 deg)
      leftStickAngle = lerp(0.8, 0.65, s);
      rightStickAngle = lerp(-0.8, -0.65, s);

      if (beatSub <= 0.25) {
        impact = {
          x: 0,
          y: -16,
          intensity: 1.0 - (beatSub / 0.25),
          type: 'stick',
        };
      }
      skirtFlare = 1.05;
      skirtSway = 0;
      break;
    }

    case 1: { // Beat 2: High Right Partner Strike
      // Step right foot forward, right hand reaches up and forward at 45°
      rightFoot = {
        x: lerp(8, 14, s),
        y: lerp(14, 16, s),
        planted: true,
      };
      leftFoot = {
        x: lerp(-8, -6, s),
        y: lerp(14, 12, s),
        planted: false,
      };
      bodyX = lerp(0, 5, s);
      bodyY = lerp(0, -1.5, Math.sin(beatSub * Math.PI));
      torsoTilt = lerp(0, 0.1, s);
      headTilt = lerp(0, 0.08, s);

      // Right arm extends high-diagonal; left stick holds at hip
      rightHand = {
        x: lerp(8, 18, s),
        y: lerp(-8, -18, s),
      };
      leftHand = {
        x: lerp(-8, -12, s),
        y: lerp(-8, -2, s),
      };

      rightStickAngle = lerp(-0.65, 0.78, s); // points high up-right
      leftStickAngle = lerp(0.65, 0.2, s);

      if (beatSub >= 0.85 || beatSub <= 0.15) {
        impact = {
          x: 24,
          y: -28,
          intensity: 1.0 - Math.min(Math.abs(beatSub - 0), Math.abs(beatSub - 1)) * 5,
          type: 'stick',
        };
      }
      skirtFlare = lerp(1.05, 1.15, s);
      skirtSway = lerp(0, 5, s);
      break;
    }

    case 2: { // Beat 3: Cross Left Partner Strike
      // Weight shifts back to left foot, left hand strikes up-left
      rightFoot = {
        x: lerp(14, 6, s),
        y: lerp(16, 12, s),
        planted: false,
      };
      leftFoot = {
        x: lerp(-6, -14, s),
        y: lerp(12, 16, s),
        planted: true,
      };
      bodyX = lerp(5, -5, s);
      bodyY = lerp(0, 1.5, Math.sin(beatSub * Math.PI));
      torsoTilt = lerp(0.1, -0.1, s);
      headTilt = lerp(0.08, -0.08, s);

      // Left hand strikes high-diagonal left; right arm rests near chest
      leftHand = {
        x: lerp(-12, -18, s),
        y: lerp(-2, -18, s),
      };
      rightHand = {
        x: lerp(18, 10, s),
        y: lerp(-18, -4, s),
      };

      leftStickAngle = lerp(0.2, -0.78, s); // points high up-left
      rightStickAngle = lerp(0.78, -0.2, s);

      if (beatSub >= 0.85 || beatSub <= 0.15) {
        impact = {
          x: -24,
          y: -28,
          intensity: 1.0 - Math.min(Math.abs(beatSub - 0), Math.abs(beatSub - 1)) * 5,
          type: 'stick',
        };
      }
      skirtFlare = lerp(1.15, 1.12, s);
      skirtSway = lerp(5, -5, s);
      break;
    }

    case 3: { // Beat 4: 360° Overhead Spin Strike
      // Full pirouette with crossed overhead dandiyas
      facingAngle = beatSub * Math.PI * 2;
      bodyX = lerp(-5, 0, s);
      bodyY = lerp(1.5, -3, Math.sin(beatSub * Math.PI));
      torsoTilt = Math.sin(beatSub * Math.PI * 2) * 0.05;

      leftFoot = {
        x: Math.cos(beatSub * Math.PI * 2) * 6 - 4,
        y: 14,
        planted: false,
      };
      rightFoot = {
        x: -Math.cos(beatSub * Math.PI * 2) * 6 + 4,
        y: 14,
        planted: true,
      };

      // Both hands reach up overhead, crossed sticks
      leftHand = {
        x: lerp(-18, -6, s) * Math.cos(beatSub * Math.PI),
        y: lerp(-18, -26, s),
      };
      rightHand = {
        x: lerp(10, 6, s) * Math.cos(beatSub * Math.PI),
        y: lerp(-4, -26, s),
      };

      leftStickAngle = lerp(-0.78, 0.45, s);
      rightStickAngle = lerp(-0.2, -0.45, s);

      if (beatSub <= 0.25) {
        impact = {
          x: 0,
          y: -34,
          intensity: 1.0 - (beatSub / 0.25),
          type: 'stick',
        };
      }

      // Maximum centrifugal flare on skirt
      skirtFlare = lerp(1.12, 1.42, Math.sin(beatSub * Math.PI));
      skirtSway = Math.sin(beatSub * Math.PI * 2) * 7;
      break;
    }
  }

  // Calculate tip positions of the dandiya sticks
  const leftTipX = leftHand.x + Math.sin(leftStickAngle) * STICK_LEN;
  const leftTipY = leftHand.y - Math.cos(leftStickAngle) * STICK_LEN;
  const rightTipX = rightHand.x + Math.sin(rightStickAngle) * STICK_LEN;
  const rightTipY = rightHand.y - Math.cos(rightStickAngle) * STICK_LEN;

  return {
    bodyY,
    bodyX,
    torsoTilt,
    facingAngle,
    leftFoot,
    rightFoot,
    skirtFlare,
    skirtSway,
    leftHand,
    rightHand,
    headTilt,
    hasDandiya: true,
    leftStick: { angle: leftStickAngle, length: STICK_LEN, tipX: leftTipX, tipY: leftTipY },
    rightStick: { angle: rightStickAngle, length: STICK_LEN, tipX: rightTipX, tipY: rightTipY },
    impact,
    stepName: DANDIYA_STEPS[currentBeat].title,
    beatIndex: currentBeat + 1,
    totalBeats: 4,
    phase: normPhase,
  };
}

/**
 * Natural Idle breathing pose.
 */
export function getIdlePose(timeMs: number, style: DanceStyle = 'garba'): DancePose {
  const breath = Math.sin(timeMs * 0.003);
  const bodyY = breath * 1.2;

  return {
    bodyY,
    bodyX: 0,
    torsoTilt: 0,
    facingAngle: 0,
    leftFoot: { x: -7, y: 14, planted: true },
    rightFoot: { x: 7, y: 14, planted: true },
    skirtFlare: 1.0,
    skirtSway: 0,
    leftHand: { x: -14, y: style === 'dandiya' ? -2 : -1 },
    rightHand: { x: 14, y: style === 'dandiya' ? -2 : -1 },
    headTilt: breath * 0.02,
    hasDandiya: style === 'dandiya',
    leftStick: style === 'dandiya' ? { angle: 0.35, length: 24, tipX: -8, tipY: 14 } : undefined,
    rightStick: style === 'dandiya' ? { angle: -0.35, length: 24, tipX: 8, tipY: 14 } : undefined,
    stepName: 'Resting Stance',
    beatIndex: 1,
    totalBeats: 1,
    phase: 0,
  };
}

/**
 * Natural walking stride pose with grounded foot kinematics.
 */
export function getWalkPose(stridePhase: number, style: DanceStyle = 'garba'): DancePose {
  const p = ((stridePhase % 1) + 1) % 1;
  const sinP = Math.sin(p * Math.PI * 2);
  const cosP = Math.cos(p * Math.PI * 2);

  const leftFootX = -7 - sinP * 8;
  const leftFootY = 14 + Math.max(0, -cosP * 3);
  const rightFootX = 7 + sinP * 8;
  const rightFootY = 14 + Math.max(0, cosP * 3);

  const bodyY = -Math.abs(sinP) * 2;
  const skirtSway = sinP * 3;

  return {
    bodyY,
    bodyX: 0,
    torsoTilt: sinP * 0.04,
    facingAngle: 0,
    leftFoot: { x: leftFootX, y: leftFootY, planted: cosP >= 0 },
    rightFoot: { x: rightFootX, y: rightFootY, planted: cosP <= 0 },
    skirtFlare: 1.05,
    skirtSway,
    leftHand: { x: -14 + sinP * 6, y: -4 - cosP * 3 },
    rightHand: { x: 14 - sinP * 6, y: -4 + cosP * 3 },
    headTilt: -sinP * 0.02,
    hasDandiya: style === 'dandiya',
    leftStick: style === 'dandiya' ? { angle: 0.35 + sinP * 0.2, length: 24, tipX: -10, tipY: 12 } : undefined,
    rightStick: style === 'dandiya' ? { angle: -0.35 - sinP * 0.2, length: 24, tipX: 10, tipY: 12 } : undefined,
    stepName: 'Walking',
    beatIndex: 1,
    totalBeats: 1,
    phase: p,
  };
}

/**
 * Universal Avatar Renderer.
 * Draws an articulated, culturally authentic character matching Garba Gully's 2.5D visual aesthetic.
 */
export function renderCharacter(
  g: VectorDrawer,
  pose: DancePose,
  outfit: OutfitDef,
  avatar: AvatarDef,
  options: {
    isMe?: boolean;
    scale?: number;
    viewAngle?: ViewAngle;
    showShadow?: boolean;
  } = {}
): void {
  const {
    isMe = false,
    scale = 1.0,
    viewAngle = 'front',
    showShadow = true,
  } = options;

  const primaryColor = hexToNum(outfit.colors[0]);
  const accentColor = hexToNum(outfit.colors[1]);
  const goldColor = 0xf5c842;
  const darkBorder = 0x0d0814;
  const skinTones = [0xb87854, 0x9b6048, 0xc58d68, 0x81513f, 0xae7354, 0x704634];
  const skinColor = skinTones[avatar.id % skinTones.length];
  const skinLight = 0xd99a70;
  const hairColor = avatar.id % 3 === 0 ? 0x211511 : avatar.id % 3 === 1 ? 0x30201a : 0x171311;
  const isMaleAvatar = avatar.id === 1 || avatar.id === 3 || avatar.id === 5;

  // Isometric / Angle perspective scaling
  const angleScaleX = viewAngle === 'iso' ? 0.92 : viewAngle === 'side' ? 0.75 : 1.0;
  const angleOffsetX = viewAngle === 'iso' ? 4 : viewAngle === 'side' ? 8 : 0;

  const cx = pose.bodyX * scale + angleOffsetX;
  const cy = pose.bodyY * scale;

  // 1. Ground Shadow (responsive to jump & foot spread)
  if (showShadow) {
    const footSpan = Math.abs(pose.rightFoot.x - pose.leftFoot.x);
    const shadowW = Math.max(30, (28 + footSpan * 0.8)) * scale;
    const shadowH = Math.max(8, 12 - cy * 0.4) * scale;
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(cx * 0.5, 20 * scale, shadowW, shadowH);
  }

  // 2. Traditional Footwear (Mojris / Juttis)
  const drawFoot = (foot: { x: number; y: number; planted: boolean }, isRight: boolean) => {
    const fx = (cx + foot.x * angleScaleX) * scale;
    const fy = (cy + foot.y) * scale;

    // Foot base
    g.fillStyle(0x211a19, 1);
    g.fillEllipse(fx, fy, 7 * scale, 4 * scale);

    // Curved mojri toe and understated zari seam
    g.fillStyle(goldColor, 1);
    g.fillCircle(fx + (isRight ? 5 : -5) * scale, fy - 1 * scale, 1.3 * scale);
    g.lineStyle(0.8 * scale, 0xd6b56c, 0.85);
    g.lineBetween(fx - 3 * scale, fy, fx + 2 * scale, fy);
  };

  drawFoot(pose.leftFoot, false);
  drawFoot(pose.rightFoot, true);

  // 3. Garba silhouette: a full pleated lehenga or a tailored kediyu and trousers.
  const skirtW = 20 * pose.skirtFlare * angleScaleX * scale;
  const skirtTopY = cy + 2 * scale;
  const skirtBottomY = cy + 16 * scale;
  const sway = pose.skirtSway * scale;

  if (isMaleAvatar) {
    // Cream churidar trousers visible beneath the longer, flared kediyu hem.
    const stride = Math.abs(pose.leftFoot.x - pose.rightFoot.x) * 0.18;
    g.fillStyle(0xe8dfd0, 1);
    g.beginPath();
    g.moveTo(cx - 6 * scale, skirtTopY);
    g.lineTo(cx - 1 * scale, skirtTopY);
    g.lineTo(cx - 2 * scale - stride, skirtBottomY + 1 * scale);
    g.lineTo(cx - 9 * scale - stride, skirtBottomY + 1 * scale);
    g.closePath(); g.fillPath();
    g.beginPath();
    g.moveTo(cx + 1 * scale, skirtTopY);
    g.lineTo(cx + 6 * scale, skirtTopY);
    g.lineTo(cx + 9 * scale + stride, skirtBottomY + 1 * scale);
    g.lineTo(cx + 2 * scale + stride, skirtBottomY + 1 * scale);
    g.closePath(); g.fillPath();
    g.lineStyle(0.8 * scale, 0xb3a797, 0.75);
    g.lineBetween(cx - 4 * scale, skirtTopY + 3 * scale, cx - 6 * scale - stride, skirtBottomY);
    g.lineBetween(cx + 4 * scale, skirtTopY + 3 * scale, cx + 6 * scale + stride, skirtBottomY);
  } else {
    // Circular chaniya with a curved hem and deep, readable fabric folds.
    g.fillStyle(primaryColor, 1);
    g.beginPath();
    g.moveTo(cx - 8 * scale, skirtTopY);
    g.lineTo(cx + 8 * scale, skirtTopY);
    g.quadraticCurveTo(cx + skirtW + sway, skirtBottomY - 2 * scale, cx + skirtW * 0.8 + sway, skirtBottomY);
    g.quadraticCurveTo(cx + sway, skirtBottomY + 4 * scale, cx - skirtW * 0.8 + sway, skirtBottomY);
    g.quadraticCurveTo(cx - skirtW + sway, skirtBottomY - 2 * scale, cx - 8 * scale, skirtTopY);
    g.closePath(); g.fillPath();
    for (let i = -3; i <= 3; i++) {
      const foldX = cx + i * 4.6 * scale + sway * 0.48;
      g.lineStyle(i % 2 === 0 ? 1.1 * scale : 0.7 * scale, i % 2 === 0 ? accentColor : 0xf9e3ae, i % 2 === 0 ? 0.38 : 0.26);
      g.lineBetween(cx + i * 1.8 * scale, skirtTopY + 3 * scale, foldX, skirtBottomY - 1 * scale);
    }
    g.lineStyle(2 * scale, goldColor, 0.95);
    g.beginPath();
    g.moveTo(cx - skirtW * 0.8 + sway, skirtBottomY);
    g.quadraticCurveTo(cx + sway, skirtBottomY + 4 * scale, cx + skirtW * 0.8 + sway, skirtBottomY);
    g.strokePath();
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9;
      const dotX = lerp(cx - skirtW * 0.7 + sway, cx + skirtW * 0.7 + sway, t);
      const dotY = skirtBottomY + Math.sin(t * Math.PI) * 2 * scale - 1.5 * scale;
      g.fillStyle(0xfff2d1, 0.9); g.fillCircle(dotX, dotY, 1 * scale);
    }
  }

  // 4. Torso & Choli (with authentic tilt)
  const torsoY = cy - 6 * scale;
  g.fillStyle(skinColor, 1);
  g.fillEllipse(cx, torsoY, 6 * angleScaleX * scale, 10 * scale, pose.torsoTilt);

  // Fitted choli or embroidered kediyu, shaped at the shoulder and waist.
  g.fillStyle(isMaleAvatar ? primaryColor : accentColor, 1);
  g.beginPath();
  g.moveTo(cx - 7 * scale, torsoY - 7 * scale);
  g.quadraticCurveTo(cx, torsoY - 11 * scale, cx + 7 * scale, torsoY - 7 * scale);
  g.lineTo(cx + 9 * scale, torsoY + 1 * scale);
  g.lineTo(cx + 6 * scale, skirtTopY + 2 * scale);
  g.lineTo(cx - 6 * scale, skirtTopY + 2 * scale);
  g.lineTo(cx - 9 * scale, torsoY + 1 * scale);
  g.closePath(); g.fillPath();
  g.lineStyle(0.8 * scale, isMaleAvatar ? accentColor : goldColor, 0.8);
  g.lineBetween(cx - 6 * scale, torsoY - 5 * scale, cx + 6 * scale, torsoY - 5 * scale);
  for (let i = -1; i <= 1; i++) {
    g.fillStyle(goldColor, 0.95);
    g.fillCircle(cx + i * 4 * scale, torsoY - 1 * scale, 0.8 * scale);
    g.fillCircle(cx + i * 3 * scale, torsoY + 3 * scale, 0.65 * scale);
  }

  // Golden waist band (Kandora)
  g.lineStyle(1.8 * scale, goldColor, 0.9);
  g.lineBetween(
    cx - 7 * angleScaleX * scale,
    skirtTopY + 1 * scale,
    cx + 7 * angleScaleX * scale,
    skirtTopY + 1 * scale
  );

  // 5. Dupatta / Odhani or a soft ivory stole inspired by the reference look.
  g.fillStyle(isMaleAvatar ? 0xe8decb : accentColor, 0.96);
  g.beginPath();
  if (isMaleAvatar) {
    g.moveTo(cx - 8 * scale, torsoY - 9 * scale);
    g.quadraticCurveTo(cx - 1 * scale, torsoY - 3 * scale, cx - 2 * scale + sway * 0.25, skirtBottomY + 2 * scale);
    g.lineTo(cx - 8 * scale + sway * 0.25, skirtBottomY + 1 * scale);
    g.quadraticCurveTo(cx - 10 * scale, torsoY + 2 * scale, cx - 13 * scale, torsoY - 5 * scale);
    g.closePath(); g.fillPath();
    g.lineStyle(0.9 * scale, accentColor, 0.92);
    g.lineBetween(cx - 7 * scale, torsoY - 5 * scale, cx - 5 * scale + sway * 0.25, skirtBottomY);
    g.fillStyle(0xe8decb, 0.96);
    g.beginPath();
    g.moveTo(cx + 3 * scale, torsoY - 8 * scale);
    g.quadraticCurveTo(cx + 8 * scale, torsoY - 4 * scale, cx + 10 * scale, skirtBottomY + 1 * scale);
    g.lineTo(cx + 4 * scale, skirtBottomY + 2 * scale);
    g.quadraticCurveTo(cx + 1 * scale, torsoY + 1 * scale, cx - 1 * scale, torsoY - 7 * scale);
    g.closePath(); g.fillPath();
  } else {
    g.moveTo(cx - 7 * angleScaleX * scale, torsoY - 8 * scale);
    g.quadraticCurveTo(cx + 4 * scale + sway * 0.3, torsoY, cx + 8 * angleScaleX * scale, skirtTopY + 4 * scale);
    g.lineTo(cx + 12 * angleScaleX * scale, skirtTopY + 7 * scale);
    g.quadraticCurveTo(cx + 2 * scale + sway * 0.3, torsoY - 2 * scale, cx - 4 * angleScaleX * scale, torsoY - 9 * scale);
    g.closePath(); g.fillPath();
    g.lineStyle(0.8 * scale, goldColor, 0.88);
    g.lineBetween(cx + 7 * scale, torsoY + 2 * scale, cx + 10 * scale + sway * 0.2, skirtTopY + 5 * scale);
  }

  // 6. Head, Hair, & Facial Features
  const headY = cy - 24 * scale;
  const headX = cx + Math.sin(pose.headTilt) * 2 * scale;

  // Neck
  g.fillStyle(skinColor, 1);
  g.fillEllipse(headX, headY + 8 * scale, 4 * scale, 4 * scale);

  // Head
  g.fillStyle(skinColor, 1);
  g.fillCircle(headX, headY, 11 * scale);

  // Individual hair silhouettes, with natural curls for the masculine avatars.
  if (isMaleAvatar) {
    g.fillStyle(hairColor, 1);
    g.fillEllipse(headX, headY - 6 * scale, 11.8 * scale, 6.8 * scale);
    for (let i = -2; i <= 2; i++) g.fillCircle(headX + i * 3.2 * scale, headY - 9 * scale + Math.abs(i) * 0.35 * scale, 2.8 * scale);
    g.fillEllipse(headX - 9 * scale, headY - 1 * scale, 2.8 * scale, 5 * scale);
  } else {
    g.fillStyle(hairColor, 1);
    g.fillEllipse(headX, headY - 5.5 * scale, 12 * scale, 7.5 * scale);
    // Long loose hair framing the cheeks; each avatar has a slightly different silhouette.
    g.fillEllipse(headX - 9 * scale, headY + 2 * scale, 3 * scale, (avatar.id === 4 ? 9 : 7) * scale);
    g.fillEllipse(headX + 9 * scale, headY + 2 * scale, 3 * scale, (avatar.id === 2 ? 10 : 7) * scale);
    g.fillStyle(skinColor, 1);
    g.fillCircle(headX, headY + 8 * scale, 3.8 * scale);
    g.fillStyle(hairColor, 1);
    g.lineStyle(1 * scale, hairColor, 1);
    g.lineBetween(headX, headY - 11 * scale, headX - 1 * scale, headY - 3 * scale);
    // Delicate maang tikka and bindi
    g.fillStyle(goldColor, 1);
    g.fillCircle(headX, headY - 4 * scale, 1.2 * scale);
    g.fillStyle(0x8e2334, 1);
    g.fillCircle(headX, headY + 1 * scale, 1.1 * scale);
    g.fillStyle(goldColor, 0.9);
    g.fillCircle(headX - 11 * scale, headY + 2 * scale, 1.5 * scale);
    g.fillCircle(headX + 11 * scale, headY + 2 * scale, 1.5 * scale);
  }

  // Self indicator star
  if (isMe) {
    g.fillStyle(goldColor, 0.95);
    g.fillCircle(headX, headY - 14 * scale, 2.2 * scale);
  }

  // Soft cheek light, expressive brows, shaped eyes, and nose.
  g.fillStyle(skinLight, 0.28);
  g.fillEllipse(headX - 6 * scale, headY + 4 * scale, 2.2 * scale, 1.3 * scale);
  g.fillEllipse(headX + 6 * scale, headY + 4 * scale, 2.2 * scale, 1.3 * scale);
  g.lineStyle(0.9 * scale, hairColor, 0.9);
  g.lineBetween(headX - 5 * scale, headY - 2 * scale, headX - 2 * scale, headY - 2.5 * scale);
  g.lineBetween(headX + 2 * scale, headY - 2.5 * scale, headX + 5 * scale, headY - 2 * scale);
  g.fillStyle(0x211610, 1);
  g.fillEllipse(headX - 3.5 * angleScaleX * scale, headY + 0.5 * scale, 1.05 * scale, 1.5 * scale);
  g.fillEllipse(headX + 3.5 * angleScaleX * scale, headY + 0.5 * scale, 1.05 * scale, 1.5 * scale);

  // Eye highlights
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(headX - 3.8 * angleScaleX * scale, headY, 0.45 * scale);
  g.fillCircle(headX + 3.2 * angleScaleX * scale, headY, 0.45 * scale);

  g.lineStyle(0.7 * scale, 0x784d3a, 0.72);
  g.lineBetween(headX, headY + 1 * scale, headX - 0.4 * scale, headY + 3 * scale);

  // Smile
  g.lineStyle(1.4 * scale, darkBorder, 0.85);
  g.beginPath();
  g.arc(headX, headY + 3.5 * scale, 2.6 * scale, 0.24, Math.PI - 0.24);
  g.strokePath();

  // 7. Articulated Arms & Hands
  const drawArm = (
    shoulderX: number,
    shoulderY: number,
    handX: number,
    handY: number,
    isLeft: boolean
  ) => {
    // Elbow mid-point curve
    const elbowX = lerp(shoulderX, handX, 0.5) + (isLeft ? -4 : 4) * scale;
    const elbowY = lerp(shoulderY, handY, 0.5) + 3 * scale;

    g.lineStyle(3.2 * scale, skinColor, 1);
    g.beginPath();
    g.moveTo(shoulderX, shoulderY);
    g.quadraticCurveTo(elbowX, elbowY, handX, handY);
    g.strokePath();

    // Short embroidered sleeve follows the shoulder through the first part of the arm.
    const sleeveX = lerp(shoulderX, handX, 0.28) + (isLeft ? -1.8 : 1.8) * scale;
    const sleeveY = lerp(shoulderY, handY, 0.28) + 1.6 * scale;
    g.lineStyle(4.8 * scale, isMaleAvatar ? primaryColor : accentColor, 1);
    g.beginPath();
    g.moveTo(shoulderX, shoulderY);
    g.quadraticCurveTo(lerp(shoulderX, elbowX, 0.55), lerp(shoulderY, elbowY, 0.55), sleeveX, sleeveY);
    g.strokePath();
    g.fillStyle(goldColor, 0.95);
    g.fillCircle(sleeveX, sleeveY, 0.9 * scale);

    // Golden bangles (Chuda) on wrists
    g.fillStyle(goldColor, 1);
    g.fillCircle(handX, handY, 2.2 * scale);

    // Palm / Hand
    g.fillStyle(skinColor, 1);
    g.fillCircle(handX + (isLeft ? -1 : 1) * scale, handY, 2.4 * scale);
  };

  const leftShoulderX = cx - 7 * angleScaleX * scale;
  const leftShoulderY = torsoY - 2 * scale;
  const rightShoulderX = cx + 7 * angleScaleX * scale;
  const rightShoulderY = torsoY - 2 * scale;

  const leftHandX = cx + pose.leftHand.x * scale;
  const leftHandY = cy + pose.leftHand.y * scale;
  const rightHandX = cx + pose.rightHand.x * scale;
  const rightHandY = cy + pose.rightHand.y * scale;

  drawArm(leftShoulderX, leftShoulderY, leftHandX, leftHandY, true);
  drawArm(rightShoulderX, rightShoulderY, rightHandX, rightHandY, false);

  // Fine collar necklace and a central pendant catch the warm festival light.
  g.lineStyle(0.9 * scale, goldColor, 0.92);
  g.beginPath();
  g.arc(headX, headY + 11 * scale, 5.3 * scale, 0.18, Math.PI - 0.18);
  g.strokePath();
  g.fillStyle(goldColor, 1);
  g.fillCircle(headX, headY + 15.7 * scale, 1.3 * scale);

  // 8. Dandiya Sticks (Rendered when pose.hasDandiya is active)
  if (pose.hasDandiya && pose.leftStick && pose.rightStick) {
    const drawStick = (
      handX: number,
      handY: number,
      stick: { angle: number; length: number; tipX: number; tipY: number },
      primaryStickColor: number,
      accentStickColor: number
    ) => {
      const tipX = cx + stick.tipX * scale;
      const tipY = cy + stick.tipY * scale;

      // Base stick body
      g.lineStyle(3.6 * scale, primaryStickColor, 1);
      g.lineBetween(handX, handY, tipX, tipY);

      // Grip wraps / decorative stripes
      g.lineStyle(1.8 * scale, accentStickColor, 0.95);
      const mid1X = lerp(handX, tipX, 0.35);
      const mid1Y = lerp(handY, tipY, 0.35);
      const mid2X = lerp(handX, tipX, 0.65);
      const mid2Y = lerp(handY, tipY, 0.65);
      g.lineBetween(handX, handY, mid1X, mid1Y);
      g.lineBetween(mid1X, mid1Y, mid2X, mid2Y);

      // Golden tip bell / Ghunghroo
      g.fillStyle(goldColor, 1);
      g.fillCircle(tipX, tipY, 3.2 * scale);
      // Tassel at handle
      g.fillStyle(accentStickColor, 0.85);
      g.fillCircle(handX, handY + 1 * scale, 2.5 * scale);
    };

    drawStick(leftHandX, leftHandY, pose.leftStick, primaryColor, accentColor);
    drawStick(rightHandX, rightHandY, pose.rightStick, accentColor, primaryColor);
  }

  // 9. Contact Impact Visual (Sparks / Mandala burst on Claps and Stick Strikes)
  if (pose.impact && pose.impact.intensity > 0.05) {
    const impX = cx + pose.impact.x * scale;
    const impY = cy + pose.impact.y * scale;
    const intensity = Math.min(1.0, pose.impact.intensity);

    if (pose.impact.type === 'clap') {
      // Golden circular clap resonance
      g.lineStyle(1.6 * scale, goldColor, 0.8 * intensity);
      g.strokeCircle(impX, impY, 7 * scale * (2 - intensity));

      // 4 tiny spark stars
      g.fillStyle(0xffffff, 0.9 * intensity);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const dist = (5 + (1 - intensity) * 6) * scale;
        g.fillCircle(impX + Math.cos(a) * dist, impY + Math.sin(a) * dist, 1.2 * scale);
      }
    } else {
      // Crisp Dandiya stick clack burst (sharp star rays)
      g.lineStyle(2.0 * scale, goldColor, 0.9 * intensity);
      const rayLen = 9 * scale;
      g.lineBetween(impX - rayLen, impY - rayLen, impX + rayLen, impY + rayLen);
      g.lineBetween(impX - rayLen, impY + rayLen, impX + rayLen, impY - rayLen);

      g.fillStyle(0xffffff, 1 * intensity);
      g.fillCircle(impX, impY, 3 * scale);
    }
  }
}

/**
 * Helper to convert HSL to Hex number
 */
export function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;

  if (hp >= 0 && hp < 1) { r = c; g = x; }
  else if (hp >= 1 && hp < 2) { r = x; g = c; }
  else if (hp >= 2 && hp < 3) { g = c; b = x; }
  else if (hp >= 3 && hp < 4) { g = x; b = c; }
  else if (hp >= 4 && hp < 5) { r = x; b = c; }
  else if (hp >= 5 && hp < 6) { r = c; b = x; }

  const m = l - c / 2;
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  return (red << 16) | (green << 8) | blue;
}

/**
 * Create a VectorDrawer adapter around HTML5 Canvas 2D context.
 */
export function createCanvasDrawer(ctx: CanvasRenderingContext2D): VectorDrawer {
  return {
    clear() {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    fillStyle(color: number | string, alpha = 1) {
      if (typeof color === 'number') {
        const hex = numToHex(color);
        ctx.fillStyle = alpha < 1 ? hexToRgba(hex, alpha) : hex;
      } else {
        ctx.fillStyle = color;
      }
    },
    lineStyle(width: number, color: number | string, alpha = 1) {
      ctx.lineWidth = width;
      if (typeof color === 'number') {
        const hex = numToHex(color);
        ctx.strokeStyle = alpha < 1 ? hexToRgba(hex, alpha) : hex;
      } else {
        ctx.strokeStyle = color;
      }
    },
    fillCircle(x: number, y: number, radius: number) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, radius), 0, Math.PI * 2);
      ctx.fill();
    },
    strokeCircle(x: number, y: number, radius: number) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.1, radius), 0, Math.PI * 2);
      ctx.stroke();
    },
    fillEllipse(x: number, y: number, radiusX: number, radiusY: number, rotation = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, radiusX), Math.max(0.1, radiusY), rotation, 0, Math.PI * 2);
      ctx.fill();
    },
    strokeEllipse(x: number, y: number, radiusX: number, radiusY: number, rotation = 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, radiusX), Math.max(0.1, radiusY), rotation, 0, Math.PI * 2);
      ctx.stroke();
    },
    lineBetween(x1: number, y1: number, x2: number, y2: number) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false) {
      ctx.arc(x, y, Math.max(0.1, radius), startAngle, endAngle, anticlockwise);
    },
    beginPath() { ctx.beginPath(); },
    moveTo(x, y) { ctx.moveTo(x, y); },
    lineTo(x, y) { ctx.lineTo(x, y); },
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) { ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y); },
    quadraticCurveTo(cpx, cpy, x, y) { ctx.quadraticCurveTo(cpx, cpy, x, y); },
    closePath() { ctx.closePath(); },
    fillPath() { ctx.fill(); },
    strokePath() { ctx.stroke(); },
  };
}

/**
 * Create a VectorDrawer adapter around Phaser 3 Graphics object.
 */
export function createPhaserDrawer(g: any): VectorDrawer {
  let lastX = 0;
  let lastY = 0;

  return {
    clear() {
      g.clear();
      lastX = 0;
      lastY = 0;
    },
    fillStyle(color: number | string, alpha = 1) {
      const c = typeof color === 'string' ? hexToNum(color) : color;
      g.fillStyle(c, alpha);
    },
    lineStyle(width: number, color: number | string, alpha = 1) {
      const c = typeof color === 'string' ? hexToNum(color) : color;
      g.lineStyle(width, c, alpha);
    },
    fillCircle(x: number, y: number, radius: number) {
      g.fillCircle(x, y, Math.max(0.1, radius));
    },
    strokeCircle(x: number, y: number, radius: number) {
      g.strokeCircle(x, y, Math.max(0.1, radius));
    },
    fillEllipse(x: number, y: number, radiusX: number, radiusY: number, _rotation = 0) {
      g.fillEllipse(x, y, Math.max(0.1, radiusX * 2), Math.max(0.1, radiusY * 2));
    },
    strokeEllipse(x: number, y: number, radiusX: number, radiusY: number, _rotation = 0) {
      g.strokeEllipse(x, y, Math.max(0.1, radiusX * 2), Math.max(0.1, radiusY * 2));
    },
    lineBetween(x1: number, y1: number, x2: number, y2: number) {
      g.lineBetween(x1, y1, x2, y2);
      lastX = x2;
      lastY = y2;
    },
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false) {
      g.arc(x, y, Math.max(0.1, radius), startAngle, endAngle, anticlockwise);
    },
    beginPath() { g.beginPath(); },
    moveTo(x, y) {
      g.moveTo(x, y);
      lastX = x;
      lastY = y;
    },
    lineTo(x, y) {
      g.lineTo(x, y);
      lastX = x;
      lastY = y;
    },
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      const startX = lastX;
      const startY = lastY;
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const invT = 1 - t;
        const px = invT * invT * startX + 2 * invT * t * cpx + t * t * x;
        const py = invT * invT * startY + 2 * invT * t * cpy + t * t * y;
        g.lineTo(px, py);
      }
      lastX = x;
      lastY = y;
    },
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
      const startX = lastX;
      const startY = lastY;
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const invT = 1 - t;
        const px = invT * invT * invT * startX + 3 * invT * invT * t * cp1x + 3 * invT * t * t * cp2x + t * t * t * x;
        const py = invT * invT * invT * startY + 3 * invT * invT * t * cp1y + 3 * invT * t * t * cp2y + t * t * t * y;
        g.lineTo(px, py);
      }
      lastX = x;
      lastY = y;
    },
    closePath() { g.closePath(); },
    fillPath() { g.fillPath(); },
    strokePath() { g.strokePath(); },
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const num = hexToNum(hex);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
