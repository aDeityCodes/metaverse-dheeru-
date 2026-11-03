import { useEffect, useRef, useState } from "react";
import {
  DIRS,
  canStep,
  drawAvatar,
  drawBubble,
  drawTarget,
  getWorldLayer,
  prefersReducedMotion,
  stepToward,
  type Facing,
} from "../game/world";

/* The preview shows the central lobby of the real map. */
const VIEW = { x: 8, y: 0, w: 24, h: 16 };

type Walker = {
  name: string;
  color: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  facing: Facing;
  movedAt: number;
  nextMove: number;
  bubble?: { text: string; until: number };
  greetedAt: number;
};

const CHATTER = [
  "anyone up for a round?",
  "the rug is the best seat here",
  "brb, grabbing tea",
  "meet at the guide kiosk?",
  "who's on the ranking board?",
  "hi all!",
];

const KEY_DIRS: Record<string, Facing> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

function inView(x: number, y: number) {
  return x >= VIEW.x && y >= VIEW.y && x < VIEW.x + VIEW.w && y < VIEW.y + VIEW.h;
}

function walker(name: string, color: string, x: number, y: number): Walker {
  return { name, color, x, y, rx: x, ry: y, facing: "down", movedAt: 0, nextMove: 0, greetedAt: -1e9 };
}

export default function WorldPreview() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Facing[]>([]);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const youRef = useRef<Walker>(walker("You", "#e9bf45", 20, 14));
  const botsRef = useRef<Walker[]>([
    walker("Asha", "#e3705a", 19, 9),
    walker("Kabir", "#5b8fd6", 14, 7),
    walker("Mei", "#a283e3", 26, 7),
  ]);
  const [focused, setFocused] = useState(false);
  const [touch] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let lastStep = 0;
    let nextChatter = performance.now() + 1500;

    const occupied = (x: number, y: number, except: Walker) =>
      [youRef.current, ...botsRef.current].some(
        (w) => w !== except && w.x === x && w.y === y
      );

    const tryMove = (w: Walker, dir: Facing, now: number) => {
      const [dx, dy] = DIRS[dir];
      const nx = w.x + dx;
      const ny = w.y + dy;
      w.facing = dir;
      if (!inView(nx, ny) || !canStep(w.x, w.y, nx, ny) || occupied(nx, ny, w)) return false;
      w.x = nx;
      w.y = ny;
      w.movedAt = now;
      return true;
    };

    const say = (w: Walker, text: string, now: number, ms = 3200) => {
      w.bubble = { text, until: now + ms };
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const you = youRef.current;
      const bots = botsRef.current;

      // Your movement: keys first, then click target
      if (now - lastStep > 130) {
        const keyDir = keysRef.current[keysRef.current.length - 1];
        if (keyDir) {
          targetRef.current = null;
          tryMove(you, keyDir, now);
          lastStep = now;
        } else if (targetRef.current) {
          const { x, y } = targetRef.current;
          const dir = stepToward(you.x, you.y, x, y, (nx, ny) =>
            inView(nx, ny) && canStep(you.x, you.y, nx, ny) && !occupied(nx, ny, you)
          );
          if (dir) tryMove(you, dir, now);
          else targetRef.current = null;
          lastStep = now;
        }
      }

      // Bots wander and chat
      if (!reduced) {
        for (const bot of bots) {
          if (now > bot.nextMove) {
            if (Math.random() > 0.35) {
              const dirs: Facing[] = ["up", "down", "left", "right"];
              tryMove(bot, dirs[Math.floor(Math.random() * 4)], now);
            }
            bot.nextMove = now + 600 + Math.random() * 1100;
          }
        }
        if (now > nextChatter) {
          const bot = bots[Math.floor(Math.random() * bots.length)];
          say(bot, CHATTER[Math.floor(Math.random() * CHATTER.length)], now);
          nextChatter = now + 3800 + Math.random() * 2500;
        }
      }

      // Walk up to someone and they say hi
      for (const bot of bots) {
        const near = Math.abs(bot.x - you.x) + Math.abs(bot.y - you.y) <= 1;
        if (near && now - bot.greetedAt > 9000) {
          bot.greetedAt = now;
          bot.facing =
            you.x > bot.x ? "right" : you.x < bot.x ? "left" : you.y > bot.y ? "down" : "up";
          say(bot, `oh hey! I'm ${bot.name}`, now, 2800);
        }
      }

      // Size
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      const t = Math.round((cw / VIEW.w) * 2) / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(-VIEW.x * t, -VIEW.y * t);
      ctx.drawImage(getWorldLayer(t, dpr), 0, 0, 40 * t, 24 * t);

      if (targetRef.current) drawTarget(ctx, targetRef.current.x, targetRef.current.y, t, now);

      const all = [you, ...bots];
      const k = reduced ? 1 : Math.min(1, dt * 14);
      for (const w of all) {
        w.rx += (w.x - w.rx) * k;
        w.ry += (w.y - w.ry) * k;
      }

      const tags: { w: Walker; cx: number; top: number }[] = [];
      for (const w of [...all].sort((a, b) => a.ry - b.ry)) {
        const cx = w.rx * t + t / 2;
        const cy = w.ry * t + t / 2;
        const walking = now - w.movedAt < 180;
        const bob = walking && !reduced ? Math.abs(Math.sin(now / 60)) * t * 0.06 : 0;
        const top = drawAvatar(ctx, {
          cx,
          cy,
          t,
          color: w.color,
          name: w.name,
          self: w === you,
          facing: w.facing,
          bob,
        });
        tags.push({ w, cx, top });
      }
      for (const { w, cx, top } of tags) {
        if (w.bubble && w.bubble.until > now) {
          const left = w.bubble.until - now;
          drawBubble(ctx, cx, top, w.bubble.text, t, Math.min(1, left / 300));
        }
      }
      ctx.restore();

      if (visible) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(wrap);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = KEY_DIRS[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    keysRef.current = [...keysRef.current.filter((d) => d !== dir), dir];
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    const dir = KEY_DIRS[e.key.toLowerCase()];
    if (dir) keysRef.current = keysRef.current.filter((d) => d !== dir);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = rect.width / VIEW.w;
    const x = Math.floor((e.clientX - rect.left) / t) + VIEW.x;
    const y = Math.floor((e.clientY - rect.top) / t) + VIEW.y;
    if (inView(x, y)) targetRef.current = { x, y };
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="application"
      aria-label="Playable preview of the MetaVerse lobby. Use the arrow keys or WASD to walk."
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        keysRef.current = [];
      }}
      className="group relative overflow-hidden rounded-xl bg-night outline-none ring-2 ring-line transition-shadow focus-visible:ring-mustard"
      style={{ boxShadow: "0 10px 0 #081816" }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        className="block aspect-[3/2] w-full cursor-pointer touch-none"
      />

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-start">
        <p className="flex items-center gap-2 rounded-lg bg-night/85 px-3 py-2 text-sm text-paper backdrop-blur-sm">
          {touch ? (
            "Tap anywhere on the map to walk there."
          ) : focused ? (
            "Walk over to someone to say hi."
          ) : (
            <>
              Click the map, then walk with <span className="kbd">W</span>
              <span className="kbd">A</span>
              <span className="kbd">S</span>
              <span className="kbd">D</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
