/**
 * GarbaScene — Phaser 3 isometric-style 2.5D game scene
 *
 * Renders the circular Garba ground with tiles, all player avatars
 * with nicknames, movement (WASD / arrow keys), and authentic
 * Gujarati Garba (Tran Tali 6-beat) & Dandiya Raas (4-beat) dance animations.
 *
 * Uses culturally accurate vector kinematics from garbaChoreography.
 */

import Phaser from 'phaser';
import type { PlayerData } from '../types';
import { OUTFITS, AVATARS } from '../types';
import type {
  DanceStyle,
  VectorDrawer,
} from './garbaChoreography';
import {
  getGarbaPose,
  getDandiyaPose,
  getIdlePose,
  getWalkPose,
  renderCharacter,
  createPhaserDrawer,
} from './garbaChoreography';

const TILE_W = 64;
const TILE_H = 32;

// Convert isometric tile coords to screen coords
function isoToScreen(tx: number, ty: number, originX: number, originY: number) {
  return {
    x: originX + (tx - ty) * (TILE_W / 2),
    y: originY + (tx + ty) * (TILE_H / 2),
  };
}

// Garba circle floor radius in tiles
const FLOOR_RADIUS = 9;

export interface GarbaSceneEvents {
  onPlayersChange?: (players: Map<string, PlayerData>) => void;
}

export class GarbaScene extends Phaser.Scene {
  // Lifecycle readiness flag to avoid race condition with React mount
  private isSceneReady = false;
  private pendingPlayers: Map<string, PlayerData> | null = null;
  private pendingMySessionId: string = '';
  private pendingDancing: { dancing: boolean; style?: DanceStyle } | null = null;

  // Player sprites keyed by sessionId
  private playerObjects = new Map<string, PlayerObject>();
  private mySessionId: string = '';

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private danceKey!: Phaser.Input.Keyboard.Key;
  private garbaKey!: Phaser.Input.Keyboard.Key;
  private dandiyaKey!: Phaser.Input.Keyboard.Key;

  // Movement state
  private moveThrottle = 0;
  private isDancing = false;
  private danceStyle: DanceStyle = 'garba';

  // Callbacks to React
  onMove?: (dx: number, dy: number) => void;
  onDanceToggle?: (isDancing: boolean, danceStyle: DanceStyle) => void;

  // Scene origin (center of the isometric floor)
  private originX = 0;
  private originY = 0;

  // Floor & decoration graphics
  private floorGraphics!: Phaser.GameObjects.Graphics;
  private decorGraphics!: Phaser.GameObjects.Graphics;

  // Particle emitter for dance sparkles
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: 'GarbaScene' });
  }

  create() {
    try {
      const { width, height } = this.scale;
      this.originX = width / 2;
      this.originY = height * 0.5;

      // Solid background with optional gradient
      const bg = this.add.graphics();
      bg.fillStyle(0x0c0616, 1);
      bg.fillRect(0, 0, width, height);
      try {
        bg.fillGradientStyle(0x0c0616, 0x0c0616, 0x180b2a, 0x180b2a, 1);
        bg.fillRect(0, 0, width, height);
      } catch {
        // Fallback for non-WebGL renderers
      }

      this.drawFloor();
      this.drawDecorations();
      this.setupParticles();
      this.setupInput();

      // Handle window / canvas resize dynamically
      this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
        this.handleResize(gameSize.width, gameSize.height);
      });

      this.isSceneReady = true;

      // Flush any state buffered before scene.create() executed
      if (this.pendingMySessionId) {
        this.mySessionId = this.pendingMySessionId;
      }
      if (this.pendingPlayers) {
        this.syncPlayers(this.pendingPlayers);
        this.pendingPlayers = null;
      }
      if (this.pendingDancing) {
        this.setDancing(this.pendingDancing.dancing, this.pendingDancing.style);
        this.pendingDancing = null;
      }
    } catch (err) {
      console.error('[GarbaScene] Error during scene creation:', err);
    }
  }

  private handleResize(width: number, height: number) {
    this.originX = width / 2;
    this.originY = height * 0.5;

    if (this.floorGraphics) {
      this.floorGraphics.clear();
      this.drawFloorGraphics(this.floorGraphics);
    }
    if (this.decorGraphics) {
      this.decorGraphics.clear();
      this.drawDecorationsGraphics(this.decorGraphics, width, height);
    }

    // Immediately align player objects with new screen geometry
    this.playerObjects.forEach((po) => {
      po.syncPositionImmediate();
    });
  }

  private drawFloor() {
    this.floorGraphics = this.add.graphics();
    this.drawFloorGraphics(this.floorGraphics);
  }

  private drawFloorGraphics(g: Phaser.GameObjects.Graphics) {
    // Draw isometric tiles in a circular pattern
    for (let tx = -FLOOR_RADIUS; tx <= FLOOR_RADIUS; tx++) {
      for (let ty = -FLOOR_RADIUS; ty <= FLOOR_RADIUS; ty++) {
        const dist = Math.sqrt(tx * tx + ty * ty);
        if (dist > FLOOR_RADIUS) continue;

        const { x, y } = isoToScreen(tx, ty, this.originX, this.originY);

        // Alternating tile colors (festive rangoli pattern)
        const isAlt = (Math.abs(tx + ty) % 2 === 0);
        const isEdge = dist > FLOOR_RADIUS - 1.25;
        const isCenter = dist < 2.2;

        let fillColor = isAlt ? 0x1d0d34 : 0x251240;
        if (isEdge) fillColor = isAlt ? 0x4c1d95 : 0x3b1079;
        if (isCenter) fillColor = isAlt ? 0x3b0764 : 0x4a044e;

        // Top face
        g.fillStyle(fillColor, 1);
        g.beginPath();
        g.moveTo(x, y - TILE_H / 2);
        g.lineTo(x + TILE_W / 2, y);
        g.lineTo(x, y + TILE_H / 2);
        g.lineTo(x - TILE_W / 2, y);
        g.closePath();
        g.fillPath();

        // Tile border
        g.lineStyle(1, 0x8b5cf6, isEdge ? 0.65 : 0.22);
        g.beginPath();
        g.moveTo(x, y - TILE_H / 2);
        g.lineTo(x + TILE_W / 2, y);
        g.lineTo(x, y + TILE_H / 2);
        g.lineTo(x - TILE_W / 2, y);
        g.closePath();
        g.strokePath();

        // Gold dot at center of edge tiles (traditional rangoli dots)
        if (isEdge && dist > FLOOR_RADIUS - 0.9) {
          g.fillStyle(0xf5c842, 0.85);
          g.fillCircle(x, y, 2.5);
        }
      }
    }

    // Central sacred mandala
    this.drawMandala(g);
  }

  private drawMandala(g: Phaser.GameObjects.Graphics) {
    const cx = this.originX;
    const cy = this.originY;

    // Outer ring of 16 lotus petals
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const px = cx + Math.cos(angle) * 44;
      const py = cy + Math.sin(angle) * 22 - 2;
      const size = 9;

      const hue = i * 22.5;
      const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.85, 0.55).color;
      g.fillStyle(color, 0.75);
      g.fillCircle(px, py, size);
    }

    // Secondary petal ring
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = cx + Math.cos(angle) * 24;
      const py = cy + Math.sin(angle) * 12 - 2;
      g.fillStyle(0xf59e0b, 0.85);
      g.fillCircle(px, py, 6);
    }

    // Inner gold circle representing the sacred Garbi / altar
    g.fillStyle(0xf5c842, 0.75);
    g.fillEllipse(cx, cy - 2, 36, 18);
    g.fillStyle(0xfef08a, 0.95);
    g.fillEllipse(cx, cy - 2, 16, 8);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy - 2, 3);
  }

  private drawDecorations() {
    this.decorGraphics = this.add.graphics();
    const { width, height } = this.scale;
    this.drawDecorationsGraphics(this.decorGraphics, width, height);
  }

  private drawDecorationsGraphics(g: Phaser.GameObjects.Graphics, width: number, height: number) {
    // Floating diyas (lamps) around the arena perimeter
    const diyaPositions = [
      { x: width * 0.12, y: height * 0.22 },
      { x: width * 0.88, y: height * 0.22 },
      { x: width * 0.08, y: height * 0.52 },
      { x: width * 0.92, y: height * 0.52 },
      { x: width * 0.18, y: height * 0.80 },
      { x: width * 0.82, y: height * 0.80 },
      { x: width * 0.50, y: height * 0.12 },
      { x: width * 0.50, y: height * 0.88 },
    ];

    diyaPositions.forEach(({ x, y }) => {
      // Warm ambient glow
      g.fillStyle(0xf97316, 0.09);
      g.fillCircle(x, y, 36);

      // Diya clay body
      g.fillStyle(0xca8a04, 1);
      g.fillEllipse(x, y + 6, 20, 9);

      // Flame outer
      g.fillStyle(0xf97316, 0.92);
      g.fillEllipse(x, y - 2, 9, 13);

      // Flame inner
      g.fillStyle(0xfef08a, 0.98);
      g.fillEllipse(x, y - 4, 4, 8);
    });

    // Ambient stars/sparkles scattered on the canvas
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 137.5) % width);
      const sy = (((i * 89.3) + 20) % (height * 0.45));
      const sr = (i % 3 === 0) ? 1.8 : 1.0;
      g.fillStyle(0xfef08a, 0.25 + (i % 5) * 0.1);
      g.fillCircle(sx, sy, sr);
    }
  }

  private setupParticles() {
    try {
      if (!this.textures.exists('sparkle')) {
        const pt = this.add.graphics();
        pt.fillStyle(0xf5c842, 1);
        pt.fillCircle(4, 4, 4);
        pt.generateTexture('sparkle', 8, 8);
        pt.destroy();
      }

      this.particles = this.add.particles(0, 0, 'sparkle', {
        speed: { min: 40, max: 140 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: 550,
        quantity: 0,
        tint: [0xf5c842, 0xf97316, 0xe040fb, 0x2dd4bf],
      });
    } catch (e) {
      console.warn('[GarbaScene] Particle setup warning:', e);
    }
  }

  private setupInput() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        up:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.danceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.garbaKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
      this.dandiyaKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);

      this.danceKey.on('down', () => {
        this.isDancing = !this.isDancing;
        this.onDanceToggle?.(this.isDancing, this.danceStyle);
        if (this.isDancing) this.emitDanceParticles();
      });

      this.garbaKey.on('down', () => {
        this.setDanceStyle('garba');
      });

      this.dandiyaKey.on('down', () => {
        this.setDanceStyle('dandiya');
      });
    }
  }

  emitDanceParticles() {
    const me = this.playerObjects.get(this.mySessionId);
    if (!me || !this.particles) return;
    this.particles.setPosition(me.x, me.y);
    this.particles.explode(22);
  }

  emitImpactParticles(x: number, y: number, count = 10) {
    if (!this.particles) return;
    this.particles.setPosition(x, y);
    this.particles.explode(count);
  }

  setDanceStyle(style: DanceStyle) {
    this.danceStyle = style;
    if (this.isDancing) {
      this.onDanceToggle?.(true, this.danceStyle);
      this.emitDanceParticles();
    }
  }

  getDanceStyle(): DanceStyle {
    return this.danceStyle;
  }

  update(_time: number, _delta: number) {
    if (!this.isSceneReady) return;

    this.moveThrottle++;
    if (this.moveThrottle < 2) return; // throttle to ~30 Hz
    this.moveThrottle = 0;

    const SPEED = 3.5;
    let dx = 0;
    let dy = 0;

    if (this.cursors?.left?.isDown  || this.wasd?.left?.isDown)  dx -= SPEED;
    if (this.cursors?.right?.isDown || this.wasd?.right?.isDown) dx += SPEED;
    if (this.cursors?.up?.isDown    || this.wasd?.up?.isDown)    dy -= SPEED;
    if (this.cursors?.down?.isDown  || this.wasd?.down?.isDown)  dy += SPEED;

    if (dx !== 0 || dy !== 0) {
      if (this.isDancing) {
        this.isDancing = false;
        this.onDanceToggle?.(false, this.danceStyle);
      }
      this.onMove?.(dx, dy);
    }

    // Animate all players with authentic Garba & Dandiya kinematics
    this.playerObjects.forEach((po, sid) => {
      po.update(_time, sid === this.mySessionId && this.isDancing);
    });
  }

  // ─── Called by React when room state changes ─────────────────────────────

  setMySessionId(id: string) {
    this.mySessionId = id;
    this.pendingMySessionId = id;

    if (this.isSceneReady) {
      const me = this.playerObjects.get(id);
      if (me) me.setIsMe(true);
    }
  }

  syncPlayers(players: Map<string, PlayerData>) {
    // If scene is not yet created, buffer players to prevent crash
    if (!this.isSceneReady || !this.add) {
      this.pendingPlayers = new Map(players);
      return;
    }

    const seen = new Set<string>();

    players.forEach((data, sid) => {
      seen.add(sid);
      const isMe = (sid === this.mySessionId);

      try {
        if (!this.playerObjects.has(sid)) {
          // Create new player object
          const po = new PlayerObject(this, data, isMe);
          this.playerObjects.set(sid, po);
        } else {
          // Update existing
          this.playerObjects.get(sid)!.syncData(data);
        }
      } catch (err) {
        console.error('[GarbaScene] Error syncing player', sid, err);
      }
    });

    // Remove departed players
    this.playerObjects.forEach((po, sid) => {
      if (!seen.has(sid)) {
        po.destroy();
        this.playerObjects.delete(sid);
      }
    });
  }

  setDancing(dancing: boolean, style?: DanceStyle) {
    if (!this.isSceneReady) {
      this.pendingDancing = { dancing, style };
      return;
    }

    this.isDancing = dancing;
    if (style) {
      this.danceStyle = style;
    }
    if (dancing) this.emitDanceParticles();
  }

  // Convert server world coords → screen coords
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const { width, height } = this.scale;
    const scaleX = width / 800;
    const scaleY = height / 600;
    return {
      x: wx * scaleX,
      y: wy * scaleY,
    };
  }
}

// ─── PlayerObject ──────────────────────────────────────────────────────────

class PlayerObject {
  private scene: GarbaScene;
  private data: PlayerData;
  private isMe: boolean;

  private container!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Graphics;
  private nameTag!: Phaser.GameObjects.Text;
  private danceRing!: Phaser.GameObjects.Graphics;
  private drawer!: VectorDrawer;

  private prevX = 0;
  private prevY = 0;
  private stridePhase = 0;
  private bobOffset = Math.random() * Math.PI * 2;
  private lastImpactTime = 0;

  get x() { return this.container ? this.container.x : 0; }
  get y() { return this.container ? this.container.y : 0; }

  constructor(scene: GarbaScene, data: PlayerData, isMe: boolean) {
    this.scene = scene;
    this.data = data;
    this.isMe = isMe;
    this.createObjects();
    this.syncData(data, true); // Snap immediately to world position
    this.prevX = this.container.x;
    this.prevY = this.container.y;
  }

  private createObjects() {
    const scene = this.scene;

    // Container
    this.container = scene.add.container(0, 0);
    this.container.setDepth(10);

    // Dance ring on the floor beneath feet
    this.danceRing = scene.add.graphics();
    this.container.add(this.danceRing);

    // Body graphics with vector drawer adapter
    this.body = scene.add.graphics();
    this.drawer = createPhaserDrawer(this.body);
    this.container.add(this.body);

    // Name tag
    this.nameTag = scene.add.text(0, -56, this.data.nickname, {
      fontFamily: 'Outfit, system-ui, sans-serif',
      fontSize: '13px',
      color: this.isMe ? '#f5c842' : '#fdf4e7',
      stroke: '#0d0814',
      strokeThickness: 3.5,
      align: 'center',
    }).setOrigin(0.5, 1);

    this.updateNameTagText();
    this.container.add(this.nameTag);
  }

  setIsMe(isMe: boolean) {
    this.isMe = isMe;
    this.updateNameTagText();
  }

  private updateNameTagText() {
    if (!this.nameTag) return;
    let label = this.data.nickname || 'Dancer';
    if (this.isMe) {
      label = `✦ ${label}`;
      this.nameTag.setColor('#f5c842');
    } else {
      this.nameTag.setColor('#fdf4e7');
    }
    if (this.data.isHost) {
      label = `👑 ${this.data.nickname}`;
    }
    this.nameTag.setText(label);
  }

  syncPositionImmediate() {
    if (!this.container) return;
    const screen = this.scene.worldToScreen(this.data.x, this.data.y);
    this.container.x = screen.x;
    this.container.y = screen.y;
    this.container.setDepth(10 + screen.y * 0.01);
  }

  syncData(data: PlayerData, immediate = false) {
    this.data = data;
    this.updateNameTagText();

    const screen = this.scene.worldToScreen(data.x, data.y);
    if (!this.container) return;

    if (immediate || (this.container.x === 0 && this.container.y === 0)) {
      this.container.x = screen.x;
      this.container.y = screen.y;
    } else {
      // Smooth interpolation toward target
      this.container.x = Phaser.Math.Linear(this.container.x, screen.x, 0.32);
      this.container.y = Phaser.Math.Linear(this.container.y, screen.y, 0.32);
    }
    this.container.setDepth(10 + screen.y * 0.01);
  }

  update(time: number, isLocalDancing: boolean) {
    if (!this.container || !this.drawer) return;

    // Movement detection between frames
    const dx = this.container.x - this.prevX;
    const dy = this.container.y - this.prevY;
    const distMoved = Math.sqrt(dx * dx + dy * dy);
    this.prevX = this.container.x;
    this.prevY = this.container.y;
    const isMoving = distMoved > 0.45;

    // Dancing status: local override or synced server state
    const isDancing = this.isMe ? (isLocalDancing || this.data.isDancing) : this.data.isDancing;
    const currentStyle: DanceStyle = (this.isMe && isLocalDancing)
      ? this.scene.getDanceStyle()
      : (this.data.danceStyle === 'dandiya' ? 'dandiya' : 'garba');

    const outfit = OUTFITS[this.data.outfitId] ?? OUTFITS[0];
    const avatar = AVATARS[this.data.avatarId] ?? AVATARS[0];

    let pose;

    if (isMoving) {
      // Walking pose with alternating grounded foot plants
      this.stridePhase = (this.stridePhase + 0.065) % 1.0;
      pose = getWalkPose(this.stridePhase, currentStyle);
      this.danceRing.clear();
    } else if (isDancing) {
      // Authentic dance choreography
      if (currentStyle === 'dandiya') {
        // Dandiya Raas: 4-beat energetic cycle (~1.9s per loop)
        const cycleDuration = 1900;
        const phase = ((time + this.bobOffset * 1000) % cycleDuration) / cycleDuration;
        pose = getDandiyaPose(phase);
      } else {
        // Gujarati Garba: 6-beat Tran Tali cycle (~3.2s per loop)
        const cycleDuration = 3200;
        const phase = ((time + this.bobOffset * 1000) % cycleDuration) / cycleDuration;
        pose = getGarbaPose(phase);
      }

      // Draw glowing floral lotus ring on ground
      const dr = this.danceRing;
      dr.clear();
      const ringRadius = 26 + Math.abs(Math.sin(time * 0.005)) * 4;
      dr.lineStyle(1.6, 0xf5c842, 0.45 + Math.sin(time * 0.008) * 0.25);
      dr.strokeEllipse(0, 16, ringRadius * 2, ringRadius);

      // Lotus petal dots around the ring
      const dotCount = 8;
      for (let i = 0; i < dotCount; i++) {
        const dotAngle = (i / dotCount) * Math.PI * 2 + time * 0.001;
        const px = Math.cos(dotAngle) * ringRadius;
        const py = 16 + Math.sin(dotAngle) * (ringRadius * 0.5);
        dr.fillStyle(i % 2 === 0 ? 0xf5c842 : 0xec4899, 0.7);
        dr.fillCircle(px, py, 2.2);
      }

      // Contact impact particle burst (claps or stick clacks)
      if (pose.impact && pose.impact.intensity > 0.7 && (time - this.lastImpactTime > 240)) {
        this.lastImpactTime = time;
        this.scene.emitImpactParticles(
          this.container.x + pose.impact.x,
          this.container.y + pose.impact.y,
          8
        );
      }
    } else {
      // Natural resting stance with breathing bob
      pose = getIdlePose(time + this.bobOffset * 1000, currentStyle);
      this.danceRing.clear();
    }

    // Render articulated character
    this.drawer.clear();
    renderCharacter(this.drawer, pose, outfit, avatar, {
      isMe: this.isMe,
      scale: 1.0,
      viewAngle: 'front',
      showShadow: true,
    });

    // Update name tag Y position to match body kinematics
    this.nameTag.y = -56 + pose.bodyY;
  }

  destroy() {
    try {
      this.container?.destroy();
    } catch {
      // ignore
    }
  }
}
