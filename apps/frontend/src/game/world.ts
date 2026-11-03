/* =========================================================
   WORLD DEFINITION
   One source of truth for the map, used by the landing
   preview and the real game so they always look the same.
========================================================= */

export const WORLD_W = 40;
export const WORLD_H = 24;

export type Rect = { x: number; y: number; w: number; h: number };
export type Facing = "up" | "down" | "left" | "right";

export const DIRS: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const ROOMS: Rect[] = [
  { x: 10, y: 0, w: 20, h: 3 },
  { x: 0, y: 3, w: 10, h: 13 },
  { x: 30, y: 3, w: 10, h: 13 },
];

export const STAIRS: Rect[] = [
  { x: 0, y: 16, w: 5, h: 8 },
  { x: 35, y: 16, w: 5, h: 8 },
];

type PropType =
  | "kiosk"
  | "bookshelf"
  | "plant"
  | "table"
  | "sofa"
  | "rug"
  | "painting"
  | "door";

export type Prop = Rect & { type: PropType; label?: string; color?: string };

export const PROPS: Prop[] = [
  { type: "door", x: 15, y: 0, w: 2, h: 1 },
  { type: "door", x: 23, y: 0, w: 2, h: 1 },
  { type: "rug", x: 18, y: 8, w: 4, h: 5 },
  { type: "kiosk", x: 16, y: 4, w: 2, h: 3, label: "GUIDE", color: "#3f74b8" },
  { type: "kiosk", x: 22, y: 4, w: 3, h: 3, label: "RANKING", color: "#b8493e" },
  { type: "bookshelf", x: 11, y: 4, w: 2, h: 3 },
  { type: "bookshelf", x: 27, y: 4, w: 2, h: 3 },
  { type: "plant", x: 10, y: 7, w: 1, h: 1 },
  { type: "plant", x: 29, y: 7, w: 1, h: 1 },
  { type: "table", x: 12, y: 9, w: 5, h: 2 },
  { type: "table", x: 23, y: 9, w: 5, h: 2 },
  { type: "sofa", x: 12, y: 12, w: 6, h: 2 },
  { type: "sofa", x: 22, y: 12, w: 6, h: 2 },
  { type: "painting", x: 2, y: 4, w: 5, h: 4 },
  { type: "painting", x: 33, y: 4, w: 5, h: 4 },
];

/* =========================================================
   COLLISION
========================================================= */

const SOLID_TYPES = new Set<PropType>([
  "kiosk",
  "bookshelf",
  "plant",
  "table",
  "sofa",
  "painting",
]);

const solidGrid = new Uint8Array(WORLD_W * WORLD_H);

for (const prop of PROPS) {
  if (!SOLID_TYPES.has(prop.type)) continue;
  for (let y = prop.y; y < prop.y + prop.h; y++) {
    for (let x = prop.x; x < prop.x + prop.w; x++) {
      solidGrid[y * WORLD_W + x] = 1;
    }
  }
}

export function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
}

export function isSolid(x: number, y: number) {
  if (!inBounds(x, y)) return true;
  return solidGrid[y * WORLD_W + x] === 1;
}

/**
 * A step is allowed if it stays on the map and does not walk
 * into furniture. If the server spawned you inside furniture,
 * you can still walk out of it.
 */
export function canStep(fromX: number, fromY: number, toX: number, toY: number) {
  if (!inBounds(toX, toY)) return false;
  return !isSolid(toX, toY) || isSolid(fromX, fromY);
}

/**
 * Greedy step toward a target tile: tries the longer axis
 * first, then the other one. Returns null when stuck or arrived.
 */
export function stepToward(
  x: number,
  y: number,
  tx: number,
  ty: number,
  allowed: (nx: number, ny: number) => boolean = (nx, ny) => canStep(x, y, nx, ny)
): Facing | null {
  const dx = tx - x;
  const dy = ty - y;
  if (dx === 0 && dy === 0) return null;

  const horizontal: Facing | null = dx > 0 ? "right" : dx < 0 ? "left" : null;
  const vertical: Facing | null = dy > 0 ? "down" : dy < 0 ? "up" : null;
  const order =
    Math.abs(dx) >= Math.abs(dy) ? [horizontal, vertical] : [vertical, horizontal];

  for (const dir of order) {
    if (!dir) continue;
    const [sx, sy] = DIRS[dir];
    if (allowed(x + sx, y + sy)) return dir;
  }
  return null;
}

/* =========================================================
   COLORS
========================================================= */

export const PALETTE = {
  night: "#0d2321",
  floorA: "#2f8f84",
  floorB: "#2b857a",
  wood: "#704333",
  woodLine: "#5e3729",
  woodEdge: "#432519",
  stoneA: "#8d958a",
  stoneB: "#767e73",
  paper: "#f4ecd6",
  mustard: "#e9bf45",
};

export const AVATAR_COLORS = [
  "#e9bf45",
  "#e3705a",
  "#5b8fd6",
  "#a283e3",
  "#5fc79c",
  "#f19ac0",
  "#f0935a",
];

export function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 - amount;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* =========================================================
   DRAWING HELPERS
========================================================= */

const DISPLAY_FONT = '"Pixelify Sans", ui-sans-serif, system-ui, sans-serif';
const BODY_FONT = 'Rubik, ui-sans-serif, system-ui, sans-serif';

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
  ctx.fillStyle = "rgba(6, 22, 20, 0.28)";
  rr(ctx, x + t * 0.08, y + t * 0.14, w, h, t * 0.12);
  ctx.fill();
}

/* =========================================================
   STATIC WORLD LAYER
========================================================= */

function drawWorld(ctx: CanvasRenderingContext2D, t: number) {
  // Floor tiles
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(x * t, y * t, t + 0.5, t + 0.5);
    }
  }

  // Wooden rooms
  for (const room of ROOMS) {
    const rx = room.x * t;
    const ry = room.y * t;
    const rw = room.w * t;
    const rh = room.h * t;

    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(rx, ry, rw, rh);

    ctx.strokeStyle = PALETTE.woodLine;
    ctx.lineWidth = Math.max(1, t * 0.03);
    const plank = t / 2;
    for (let row = 0; row < room.h * 2; row++) {
      const py = ry + row * plank;
      ctx.beginPath();
      ctx.moveTo(rx, py);
      ctx.lineTo(rx + rw, py);
      ctx.stroke();
      const offset = row % 2 === 0 ? 0 : t;
      for (let jx = rx + offset; jx < rx + rw; jx += t * 2) {
        ctx.beginPath();
        ctx.moveTo(jx, py);
        ctx.lineTo(jx, py + plank);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = PALETTE.woodEdge;
    ctx.lineWidth = Math.max(2, t * 0.08);
    ctx.strokeRect(rx + ctx.lineWidth / 2, ry + ctx.lineWidth / 2, rw - ctx.lineWidth, rh - ctx.lineWidth);
  }

  // Stairs
  for (const s of STAIRS) {
    for (let row = 0; row < s.h * 2; row++) {
      ctx.fillStyle = row % 2 === 0 ? PALETTE.stoneA : PALETTE.stoneB;
      ctx.fillRect(s.x * t, s.y * t + row * (t / 2), s.w * t, t / 2 + 0.5);
    }
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(s.x * t, s.y * t, s.w * t, t * 0.12);
  }

  // Flat props first, then furniture
  const flat = PROPS.filter((p) => p.type === "rug" || p.type === "door");
  const furniture = PROPS.filter((p) => p.type !== "rug" && p.type !== "door");

  for (const prop of [...flat, ...furniture]) drawProp(ctx, prop, t);
}

function drawProp(ctx: CanvasRenderingContext2D, p: Prop, t: number) {
  const x = p.x * t;
  const y = p.y * t;
  const w = p.w * t;
  const h = p.h * t;
  const pad = t * 0.08;

  switch (p.type) {
    case "door": {
      ctx.fillStyle = "#9a7428";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#d8b34c";
      ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad);
      ctx.fillStyle = "#6b4f17";
      ctx.beginPath();
      ctx.arc(x + w / 2 + t * 0.25, y + h * 0.55, t * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "rug": {
      ctx.fillStyle = "#d9b84a";
      rr(ctx, x, y, w, h, t * 0.1);
      ctx.fill();
      ctx.strokeStyle = "#b38f2c";
      ctx.lineWidth = Math.max(1.5, t * 0.06);
      rr(ctx, x + t * 0.2, y + t * 0.2, w - t * 0.4, h - t * 0.4, t * 0.06);
      ctx.stroke();
      ctx.fillStyle = "#c79f37";
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - t * 0.9);
      ctx.lineTo(cx + t * 0.7, cy);
      ctx.lineTo(cx, cy + t * 0.9);
      ctx.lineTo(cx - t * 0.7, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "kiosk": {
      const color = p.color ?? "#3f74b8";
      shadow(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t);
      ctx.fillStyle = shade(color, 0.3);
      rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t * 0.14);
      ctx.fill();
      ctx.fillStyle = color;
      rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2 - t * 0.12, t * 0.14);
      ctx.fill();
      ctx.fillStyle = "rgba(10, 30, 40, 0.45)";
      rr(ctx, x + t * 0.25, y + t * 0.3, w - t * 0.5, h * 0.48, t * 0.08);
      ctx.fill();
      ctx.fillStyle = PALETTE.paper;
      ctx.font = `600 ${Math.max(9, Math.round(t * 0.3))}px ${DISPLAY_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label ?? "", x + w / 2, y + t * 0.3 + (h * 0.48) / 2);
      break;
    }
    case "bookshelf": {
      shadow(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t);
      ctx.fillStyle = "#8a5a2b";
      rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t * 0.08);
      ctx.fill();
      const colors = ["#c94b3b", "#3d6fb3", "#82a78d", "#e5ba45", "#f4ecd6", "#7d5aa8"];
      const shelves = p.h;
      const innerX = x + pad * 2.2;
      const innerW = w - pad * 4.4;
      for (let s = 0; s < shelves; s++) {
        const sy = y + pad * 2 + s * ((h - pad * 4) / shelves);
        const sh = (h - pad * 4) / shelves - t * 0.08;
        ctx.fillStyle = "#4e3119";
        ctx.fillRect(innerX, sy, innerW, sh);
        let bx = innerX + t * 0.04;
        let i = s * 2;
        while (bx < innerX + innerW - t * 0.12) {
          const bw = t * (0.12 + ((i * 7) % 5) * 0.025);
          const bh = sh * (0.7 + ((i * 3) % 4) * 0.08);
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(bx, sy + sh - bh, Math.min(bw, innerX + innerW - bx - t * 0.04), bh);
          bx += bw + t * 0.03;
          i++;
        }
      }
      break;
    }
    case "plant": {
      const cx = x + t / 2;
      ctx.fillStyle = "rgba(6, 22, 20, 0.28)";
      ctx.beginPath();
      ctx.ellipse(cx + t * 0.05, y + t * 0.9, t * 0.32, t * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a0623a";
      ctx.beginPath();
      ctx.moveTo(x + t * 0.26, y + t * 0.52);
      ctx.lineTo(x + t * 0.74, y + t * 0.52);
      ctx.lineTo(x + t * 0.66, y + t * 0.9);
      ctx.lineTo(x + t * 0.34, y + t * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3d8f49";
      for (const [ox, oy, r] of [
        [-0.16, -0.02, 0.2],
        [0.16, -0.02, 0.2],
        [0, -0.18, 0.22],
      ]) {
        ctx.beginPath();
        ctx.arc(cx + ox * t, y + t * 0.42 + oy * t, r * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#5bb366";
      ctx.beginPath();
      ctx.arc(cx - t * 0.05, y + t * 0.2, t * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "table": {
      shadow(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t);
      ctx.fillStyle = "#a8844f";
      rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t * 0.12);
      ctx.fill();
      ctx.fillStyle = "#c9a56e";
      rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2 - t * 0.14, t * 0.12);
      ctx.fill();
      // A couple of mugs
      for (const fx of [0.25, 0.7]) {
        ctx.fillStyle = PALETTE.paper;
        ctx.beginPath();
        ctx.arc(x + w * fx, y + h * 0.42, t * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6b3f22";
        ctx.beginPath();
        ctx.arc(x + w * fx, y + h * 0.42, t * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "sofa": {
      shadow(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t);
      ctx.fillStyle = "#8e3a2d";
      rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t * 0.2);
      ctx.fill();
      ctx.fillStyle = "#b34c3c";
      const seatY = y + h * 0.38;
      const seatH = h * 0.5;
      rr(ctx, x + t * 0.35, seatY, w - t * 0.7, seatH, t * 0.12);
      ctx.fill();
      ctx.strokeStyle = "#8e3a2d";
      ctx.lineWidth = Math.max(1, t * 0.04);
      const cushions = Math.max(2, Math.round(p.w / 2));
      for (let i = 1; i < cushions; i++) {
        const cx = x + t * 0.35 + ((w - t * 0.7) / cushions) * i;
        ctx.beginPath();
        ctx.moveTo(cx, seatY + t * 0.06);
        ctx.lineTo(cx, seatY + seatH - t * 0.06);
        ctx.stroke();
      }
      break;
    }
    case "painting": {
      shadow(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t);
      ctx.fillStyle = "#b3453b";
      rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, t * 0.06);
      ctx.fill();
      const ix = x + t * 0.3;
      const iy = y + t * 0.3;
      const iw = w - t * 0.6;
      const ih = h - t * 0.6;
      ctx.fillStyle = "#e8dcb8";
      ctx.fillRect(ix, iy, iw, ih);
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, iy, iw, ih);
      ctx.clip();
      ctx.fillStyle = "#e9bf45";
      ctx.beginPath();
      ctx.arc(ix + iw * 0.7, iy + ih * 0.32, Math.min(iw, ih) * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f8f84";
      ctx.beginPath();
      ctx.moveTo(ix, iy + ih);
      ctx.lineTo(ix + iw * 0.35, iy + ih * 0.5);
      ctx.lineTo(ix + iw * 0.6, iy + ih * 0.8);
      ctx.lineTo(ix + iw * 0.8, iy + ih * 0.62);
      ctx.lineTo(ix + iw, iy + ih * 0.85);
      ctx.lineTo(ix + iw, iy + ih);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
  }
}

let fontVersion = 0;
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.ready.then(() => {
    fontVersion++;
  });
}

let layerCache: { key: string; canvas: HTMLCanvasElement } | null = null;

/**
 * The map never changes, so it is rendered once per tile size
 * into an offscreen canvas and blitted every frame.
 */
export function getWorldLayer(t: number, dpr: number) {
  const key = `${t}|${dpr}|${fontVersion}`;
  if (layerCache?.key === key) return layerCache.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(WORLD_W * t * dpr);
  canvas.height = Math.ceil(WORLD_H * t * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawWorld(ctx, t);
  }
  layerCache = { key, canvas };
  return canvas;
}

/* =========================================================
   AVATARS, NAME TAGS, BUBBLES
========================================================= */

type AvatarDraw = {
  cx: number;
  cy: number;
  t: number;
  color: string;
  name: string;
  self?: boolean;
  facing?: Facing;
  bob?: number;
};

/** Draws an avatar centered on (cx, cy). Returns the top y of its name tag. */
export function drawAvatar(ctx: CanvasRenderingContext2D, a: AvatarDraw) {
  const { cx, t, color, name, self, facing = "down", bob = 0 } = a;
  const cy = a.cy - bob;
  const r = t * 0.33;

  ctx.fillStyle = "rgba(6, 22, 20, 0.32)";
  ctx.beginPath();
  ctx.ellipse(a.cx, a.cy + r * 0.92, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (self) {
    ctx.strokeStyle = PALETTE.paper;
    ctx.lineWidth = Math.max(2, t * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r + t * 0.09, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(color, 0.35);
  ctx.lineWidth = Math.max(1.5, t * 0.05);
  ctx.stroke();

  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Eyes look where you are walking
  if (facing !== "up") {
    const [fx, fy] = DIRS[facing];
    const ex = cx + fx * r * 0.32;
    const ey = cy + fy * r * 0.25 + r * 0.05;
    const sep = r * 0.3;
    const px = fy !== 0 ? sep : 0;
    const py = fx !== 0 ? sep * 0.6 : 0;
    ctx.fillStyle = PALETTE.night;
    for (const s of fx !== 0 ? [0] : [-1, 1]) {
      ctx.beginPath();
      ctx.arc(ex + px * s, ey + py * s, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx !== 0) {
      ctx.beginPath();
      ctx.arc(ex - fx * r * 0.32, ey, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Name tag
  const fs = Math.max(10, Math.min(14, Math.round(t * 0.27)));
  ctx.font = `600 ${fs}px ${BODY_FONT}`;
  const label = name.length > 18 ? `${name.slice(0, 17)}…` : name;
  const tw = ctx.measureText(label).width;
  const th = fs + 8;
  const tagY = cy - r - t * 0.16 - th;
  ctx.fillStyle = self ? PALETTE.mustard : "rgba(13, 35, 33, 0.85)";
  rr(ctx, cx - tw / 2 - 7, tagY, tw + 14, th, th / 2);
  ctx.fill();
  ctx.fillStyle = self ? PALETTE.night : PALETTE.paper;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, tagY + th / 2 + 0.5);

  return tagY;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, "")}…`;
  }
  return lines.map((l) => {
    let out = l;
    while (ctx.measureText(out).width > maxW && out.length > 1) out = `${out.slice(0, -2)}…`;
    return out;
  });
}

/** Speech bubble whose tail points at (cx, bottomY). */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottomY: number,
  text: string,
  t: number,
  alpha = 1
) {
  const fs = Math.max(11, Math.min(15, Math.round(t * 0.29)));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `500 ${fs}px ${BODY_FONT}`;
  const lines = wrap(ctx, text, Math.max(130, t * 4.2), 3);
  const lh = fs * 1.3;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20;
  const h = lines.length * lh + 12;
  const tail = 7;
  const x = cx - w / 2;
  const y = bottomY - tail - h - 2;

  ctx.fillStyle = PALETTE.paper;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + h - 1);
  ctx.lineTo(cx, y + h + tail);
  ctx.lineTo(cx + 6, y + h - 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = PALETTE.night;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, cx, y + 6 + lh * i + lh / 2));
  ctx.restore();
}

/** Pulsing outline on the tile you clicked. */
export function drawTarget(ctx: CanvasRenderingContext2D, tx: number, ty: number, t: number, time: number) {
  const pulse = prefersReducedMotion() ? 0 : (Math.sin(time / 180) + 1) * 0.5;
  const inset = t * (0.14 + pulse * 0.06);
  ctx.strokeStyle = PALETTE.paper;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(2, t * 0.06);
  rr(ctx, tx * t + inset, ty * t + inset, t - inset * 2, t - inset * 2, t * 0.12);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
