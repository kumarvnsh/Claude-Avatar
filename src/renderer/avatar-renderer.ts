import { SessionInfo, AvatarBounds, DockPosition } from '../shared/types';
import { SPRITES, SpriteFrame, getPaletteFromHSL, PaletteColors } from './sprites';

interface AvatarState {
  session: SessionInfo;
  baseX: number;
  targetX: number;
  currentX: number;
  baseY: number;
  targetY: number;
  currentY: number;
  opacity: number;
  targetOpacity: number;
  frameIndex: number;
  bobOffset: number;
  particles: Particle[];
  targetWander: number;
  currentWander: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: string;
  size: number;
}

const SPRITE_SIZE = 16;
const SPRITE_SCALE = 3;
const DISPLAY_SIZE = SPRITE_SIZE * SPRITE_SCALE; // 48px
const AVATAR_SPACING = 140; // Increased from 70 to give room for full text
const LABEL_OFFSET = 8;
const LABEL_MAX_LEN = 24;
/** Full static height from sprite top to label pill bottom in side-dock mode. */
const SIDE_DOCK_VERTICAL_SPAN =
  DISPLAY_SIZE / 2 + (DISPLAY_SIZE / 2 + LABEL_OFFSET + 4);
/** Vertical distance between side-dock avatar centers (sprite + below label + wander margin). */
const SIDE_DOCK_SLOT_HEIGHT = 96;
/** Max |wander| on Y so adjacent lanes never overlap. */
const SIDE_DOCK_WANDER_MAX =
  Math.max(0, (SIDE_DOCK_SLOT_HEIGHT - SIDE_DOCK_VERTICAL_SPAN) / 2 - 2);
const FRAME_INTERVAL = 250; // ms per animation frame
const BOB_SPEED = 0.002;
const BOB_AMPLITUDE = 3;

export class AvatarRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private avatars: Map<string, AvatarState> = new Map();
  private avatarBounds: AvatarBounds[] = [];
  private hoveredAvatar: string | null = null;
  private lastFrameTime = 0;
  private lastAnimTime = 0;
  private dockPosition: DockPosition = 'bottom';
  private animationTimer: ReturnType<typeof setInterval> | null = null;

  private onHover: ((session: SessionInfo | null, x: number, y: number) => void) | null = null;
  private onClick: ((sessionId: string) => void) | null = null;
  private onMouseEnterAvatar: (() => void) | null = null;
  private onMouseLeaveAvatar: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false; // Crisp pixel art

    this.setupMouseHandlers();
  }

  setCallbacks(callbacks: {
    onHover?: (session: SessionInfo | null, x: number, y: number) => void;
    onClick?: (sessionId: string) => void;
    onMouseEnterAvatar?: () => void;
    onMouseLeaveAvatar?: () => void;
  }): void {
    this.onHover = callbacks.onHover || null;
    this.onClick = callbacks.onClick || null;
    this.onMouseEnterAvatar = callbacks.onMouseEnterAvatar || null;
    this.onMouseLeaveAvatar = callbacks.onMouseLeaveAvatar || null;
  }

  updateSessions(sessions: SessionInfo[]): void {
    const newIds = new Set(sessions.map(s => s.sessionId));

    // Despawn removed sessions
    for (const [id, state] of this.avatars) {
      if (!newIds.has(id)) {
        state.targetOpacity = 0; // Fade out
      }
    }

    const orderedAvatars: Map<string, AvatarState> = new Map();

    // Update or spawn sessions
    for (const session of sessions) {
      const existing = this.avatars.get(session.sessionId);
      if (existing) {
        existing.session = session;
        orderedAvatars.set(session.sessionId, existing);
      } else {
        // Spawn new avatar
        orderedAvatars.set(session.sessionId, {
          session,
          baseX: 0,
          targetX: 0,
          currentX: 0,
          baseY: 0,
          targetY: 0,
          currentY: 0,
          opacity: 0,
          targetOpacity: 1,
          frameIndex: 0,
          bobOffset: Math.random() * Math.PI * 2,
          particles: [],
          targetWander: 0,
          currentWander: 0,
        });
      }
    }

    // Keep fading avatars alive until their exit animation completes.
    for (const [id, state] of this.avatars) {
      if (!newIds.has(id)) {
        orderedAvatars.set(id, state);
      }
    }

    this.avatars = orderedAvatars;

    // Calculate target positions
    this.recalculatePositions();
  }

  setDockPosition(position: DockPosition): void {
    this.dockPosition = position;
    this.resizeCanvas();
    this.recalculatePositions();
  }

  start(): void {
    this.resizeCanvas();
    // Use setInterval (not requestAnimationFrame) — rAF is throttled
    // when window is unfocused, which is always the case for our overlay
    this.animationTimer = setInterval(() => {
      this.render(performance.now());
    }, 33); // ~30fps
  }

  stop(): void {
    if (this.animationTimer !== null) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  private recalculatePositions(): void {
    const activeAvatars = Array.from(this.avatars.values())
      .filter(a => a.targetOpacity > 0);

    const totalLength = activeAvatars.length * AVATAR_SPACING;
    
    if (this.dockPosition === 'bottom') {
      const canvasWidth = this.canvas.clientWidth;
      const startX = (canvasWidth - totalLength) / 2 + AVATAR_SPACING / 2;
      activeAvatars.forEach((avatar, index) => {
        avatar.baseX = startX + index * AVATAR_SPACING;
        avatar.baseY = this.canvas.clientHeight - DISPLAY_SIZE - 24;
      });
    } else {
      const sideTotalLength = activeAvatars.length * SIDE_DOCK_SLOT_HEIGHT;
      const canvasHeight = this.canvas.clientHeight;
      const sideCenterX = this.canvas.clientWidth / 2;
      const startY = (canvasHeight - sideTotalLength) / 2 + SIDE_DOCK_SLOT_HEIGHT / 2;
      activeAvatars.forEach((avatar, index) => {
        avatar.baseX = sideCenterX;
        avatar.baseY = startY + index * SIDE_DOCK_SLOT_HEIGHT;
      });
    }
  }

  private render(timestamp: number): void {
    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

    // Update animation frames
    if (timestamp - this.lastAnimTime > FRAME_INTERVAL) {
      this.lastAnimTime = timestamp;
      for (const avatar of this.avatars.values()) {
        const spriteAnim = SPRITES[avatar.session.state];
        if (spriteAnim) {
          avatar.frameIndex = (avatar.frameIndex + 1) % spriteAnim.frames.length;
        }
      }
    }

    // Update and draw each avatar
    this.avatarBounds = [];
    const toRemove: string[] = [];

    for (const [id, avatar] of this.avatars) {
      // Randomly pick a new wander target (about once every 2 seconds ~ 1.5% chance at 30fps)
      if (Math.random() < 0.015) {
        if (this.dockPosition === 'bottom') {
          // limit wander to +/- 40px from base position so they never overlap neighbors
          avatar.targetWander = (Math.random() - 0.5) * 80;
        } else {
          avatar.targetWander = (Math.random() - 0.5) * 2 * SIDE_DOCK_WANDER_MAX;
        }
      }

      // Smoothly move towards target wander offset (slow, lazy floating)
      avatar.currentWander += (avatar.targetWander - avatar.currentWander) * 0.02;
      
      // Target position is base position + wander offset
      if (this.dockPosition === 'bottom') {
        avatar.targetX = avatar.baseX + avatar.currentWander;
        avatar.targetY = avatar.baseY;
      } else {
        avatar.targetX = avatar.baseX;
        avatar.targetY = avatar.baseY + avatar.currentWander;
      }

      // Smooth position transition towards targets (faster catch-up)
      avatar.currentX += (avatar.targetX - avatar.currentX) * 0.1;
      avatar.currentY += (avatar.targetY - avatar.currentY) * 0.1;

      // Smooth opacity transition
      const opacitySpeed = 0.05;
      if (avatar.opacity < avatar.targetOpacity) {
        avatar.opacity = Math.min(avatar.opacity + opacitySpeed, avatar.targetOpacity);
      } else if (avatar.opacity > avatar.targetOpacity) {
        avatar.opacity = Math.max(avatar.opacity - opacitySpeed, avatar.targetOpacity);
      }

      // Remove fully faded avatars
      if (avatar.opacity <= 0 && avatar.targetOpacity <= 0) {
        toRemove.push(id);
        continue;
      }

      // Keep ambient motion vertical so side docks never drift left/right.
      const bobValue = Math.sin(timestamp * BOB_SPEED + avatar.bobOffset) * BOB_AMPLITUDE;

      let drawX = Math.round(avatar.currentX - DISPLAY_SIZE / 2);
      let drawY = Math.round(avatar.currentY - DISPLAY_SIZE / 2);

      drawY += Math.round(bobValue);

      // Save context for opacity
      this.ctx.globalAlpha = avatar.opacity;

      // Draw sprite
      this.drawSprite(
        avatar.session.state,
        avatar.frameIndex,
        drawX,
        drawY,
        avatar.session.color
      );

      if (avatar.session.isStale) {
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.beginPath();
        this.ctx.arc(drawX + DISPLAY_SIZE - 6, drawY + 6, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Draw particles
      this.updateAndDrawParticles(avatar, drawX, drawY, timestamp);

      // Draw project label (bottom + side docks: centered below sprite)
      const labelBaselineY = drawY + DISPLAY_SIZE + LABEL_OFFSET;
      this.drawLabel(avatar.session.projectName, avatar.currentX, labelBaselineY);

      this.ctx.globalAlpha = 1;

      // Store bounds for hit testing
      if (this.dockPosition === 'bottom') {
        this.avatarBounds.push({
          x: drawX,
          y: drawY,
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE + 20,
          sessionId: id,
        });
      } else {
        const pillW = this.measureLabelPillWidth(avatar.session.projectName);
        const pillLeft = avatar.currentX - pillW / 2;
        const pillRight = avatar.currentX + pillW / 2;
        const spriteLeft = drawX;
        const spriteRight = drawX + DISPLAY_SIZE;
        const hitX = Math.min(spriteLeft, pillLeft);
        const hitW = Math.max(spriteRight, pillRight) - hitX;
        const hitH = DISPLAY_SIZE + LABEL_OFFSET + 4;
        this.avatarBounds.push({
          x: Math.round(hitX),
          y: drawY,
          width: Math.round(hitW),
          height: hitH,
          sessionId: id,
        });
      }
    }

    for (const id of toRemove) {
      this.avatars.delete(id);
    }

    // rendering driven by setInterval in start()
  }

  private drawSprite(state: string, frameIndex: number, x: number, y: number, color: string): void {
    const spriteAnim = SPRITES[state];
    if (!spriteAnim) return;

    const frame = spriteAnim.frames[frameIndex % spriteAnim.frames.length];
    const palette = getPaletteFromHSL(color);

    for (let py = 0; py < SPRITE_SIZE; py++) {
      for (let px = 0; px < SPRITE_SIZE; px++) {
        const val = frame[py]?.[px];
        if (!val || val === 0) continue;

        const fillColor = this.paletteIndexToColor(val, palette, state === 'error');
        if (fillColor) {
          this.ctx.fillStyle = fillColor;
          this.ctx.fillRect(
            x + px * SPRITE_SCALE,
            y + py * SPRITE_SCALE,
            SPRITE_SCALE,
            SPRITE_SCALE
          );
        }
      }
    }
  }

  private paletteIndexToColor(index: number, palette: PaletteColors, isError: boolean): string | null {
    switch (index) {
      case 1: return isError ? this.tintRed(palette.body) : palette.body;
      case 2: return isError ? this.tintRed(palette.shadow) : palette.shadow;
      case 3: return palette.dark;
      case 4: return palette.highlight;
      case 5: return palette.accent;
      default: return null;
    }
  }

  private tintRed(color: string): string {
    // Simple red tint for error state
    const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (!match) return color;
    const r = Math.min(parseInt(match[1]) + 80, 255);
    const g = Math.max(parseInt(match[2]) - 40, 0);
    const b = Math.max(parseInt(match[3]) - 40, 0);
    return `rgb(${r},${g},${b})`;
  }

  private updateAndDrawParticles(avatar: AvatarState, drawX: number, drawY: number, timestamp: number): void {
    const spriteAnim = SPRITES[avatar.session.state];
    if (!spriteAnim?.particleEffect) return;

    // Spawn new particles occasionally
    if (Math.random() < 0.08) {
      const particle = this.createParticle(spriteAnim.particleEffect, drawX, drawY);
      if (particle) avatar.particles.push(particle);
    }

    // Update and draw particles
    avatar.particles = avatar.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;

      if (p.life <= 0) return false;

      const alpha = p.life / p.maxLife;
      this.ctx.globalAlpha = avatar.opacity * alpha;

      this.drawParticle(p);

      return true;
    });
  }

  private createParticle(type: string, baseX: number, baseY: number): Particle | null {
    switch (type) {
      case 'sparkle':
        return {
          x: baseX + DISPLAY_SIZE / 2 + (Math.random() - 0.5) * DISPLAY_SIZE,
          y: baseY + Math.random() * DISPLAY_SIZE * 0.5,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.5 - Math.random() * 0.5,
          life: 30,
          maxLife: 30,
          type: 'sparkle',
          size: 2 + Math.random() * 2,
        };
      case 'bubbles':
        return {
          x: baseX + DISPLAY_SIZE * 0.7 + Math.random() * 10,
          y: baseY - 5,
          vx: 0.2,
          vy: -0.8 - Math.random() * 0.3,
          life: 40,
          maxLife: 40,
          type: 'bubble',
          size: 3 + Math.random() * 3,
        };
      case 'zzz':
        if (Math.random() < 0.3) {
          return {
            x: baseX + DISPLAY_SIZE * 0.8,
            y: baseY,
            vx: 0.3,
            vy: -0.4,
            life: 60,
            maxLife: 60,
            type: 'zzz',
            size: 6,
          };
        }
        return null;
      case 'exclamation':
        if (Math.random() < 0.2) {
          return {
            x: baseX + DISPLAY_SIZE / 2,
            y: baseY - 8,
            vx: 0,
            vy: -0.3,
            life: 40,
            maxLife: 40,
            type: 'exclamation',
            size: 5,
          };
        }
        return null;
      default:
        return null;
    }
  }

  private drawParticle(p: Particle): void {
    switch (p.type) {
      case 'sparkle':
        this.ctx.fillStyle = '#ffd700';
        this.ctx.fillRect(p.x - 1, p.y - 1, p.size, p.size);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(p.x, p.y, 1, 1);
        break;

      case 'bubble':
        this.ctx.strokeStyle = '#aaccff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.stroke();
        break;

      case 'zzz':
        this.ctx.fillStyle = '#aaaacc';
        this.ctx.font = `${p.size}px monospace`;
        this.ctx.fillText('z', p.x, p.y);
        break;

      case 'exclamation':
        this.ctx.fillStyle = '#ff4444';
        this.ctx.font = `bold ${p.size + 2}px monospace`;
        this.ctx.fillText('!', p.x, p.y);
        break;
    }
  }

  private getTruncatedLabelText(text: string): string {
    return text.length > LABEL_MAX_LEN
      ? text.slice(0, LABEL_MAX_LEN - 1) + '…'
      : text;
  }

  /** Pill width for hit testing; must match `drawLabel` metrics. */
  private measureLabelPillWidth(text: string): number {
    this.ctx.font = '9px monospace';
    const displayText = this.getTruncatedLabelText(text);
    return this.ctx.measureText(displayText).width + 8;
  }

  private drawLabel(text: string, centerX: number, y: number): void {
    this.ctx.font = '9px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

    const displayText = this.getTruncatedLabelText(text);

    // Background pill
    const metrics = this.ctx.measureText(displayText);
    const pillWidth = metrics.width + 8;
    const pillHeight = 14;
    const pillX = centerX - pillWidth / 2;
    const pillY = y - 10;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.fillText(displayText, centerX, y);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();
  }

  // --- Mouse Handling ---

  private setupMouseHandlers(): void {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  private hitTest(x: number, y: number): AvatarBounds | null {
    for (const bounds of this.avatarBounds) {
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.height) {
        return bounds;
      }
    }
    return null;
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = this.hitTest(x, y);

    if (hit) {
      if (this.hoveredAvatar !== hit.sessionId) {
        if (!this.hoveredAvatar) {
          this.onMouseEnterAvatar?.();
        }
        this.hoveredAvatar = hit.sessionId;

        const avatar = this.avatars.get(hit.sessionId);
        if (avatar) {
          this.onHover?.(avatar.session, e.clientX, e.clientY);
        }
      }
      this.canvas.style.cursor = 'pointer';
    } else {
      if (this.hoveredAvatar) {
        this.hoveredAvatar = null;
        this.onHover?.(null, 0, 0);
        this.onMouseLeaveAvatar?.();
      }
      this.canvas.style.cursor = 'default';
    }
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = this.hitTest(x, y);
    if (hit) {
      this.onClick?.(hit.sessionId);
    }
  }

  private handleMouseLeave(): void {
    if (this.hoveredAvatar) {
      this.hoveredAvatar = null;
      this.onHover?.(null, 0, 0);
      this.onMouseLeaveAvatar?.();
    }
  }
}
