import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LocateFixed,
  LogOut,
  MessageSquare,
  Minus,
  Plus,
  RotateCw,
  Send,
  X,
} from "lucide-react";
import { AvatarBean, LogoMark } from "./components/Brand";
import {
  DIRS,
  PALETTE,
  WORLD_H,
  WORLD_W,
  canStep,
  colorFor,
  drawAvatar,
  drawBubble,
  drawTarget,
  getWorldLayer,
  inBounds,
  prefersReducedMotion,
  stepToward,
  type Facing,
} from "./game/world";

/* =========================================================
   CONFIG
========================================================= */

const SPACE_ID = import.meta.env.VITE_SPACE_ID || "cmt5wunma0002g3y4ptssvuu3";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";

const STEP_MS = 120;
const BUBBLE_MS = 5000;
const MAX_RETRIES = 6;
const ZOOMS = [1, 1.35, 1.8, 2.4];
const HINT_KEY = "mv-controls-hint-dismissed";

/* =========================================================
   TYPES
========================================================= */

type Avatar = {
  userId: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  facing: Facing;
  movedAt: number;
  bubble?: { text: string; until: number };
};

type ChatMessage = {
  id: string;
  kind: "chat" | "system";
  userId?: string;
  name?: string;
  text: string;
  self?: boolean;
  at: number;
};

type PlayerRow = {
  userId: string;
  name: string;
  color: string;
  self: boolean;
  near: boolean;
};

type Status = "connecting" | "online" | "reconnecting" | "offline";

type ServerMessage = { type?: string; payload?: Record<string, unknown> };

type GameProps = {
  onAuthError: () => void;
  onLogout: () => void;
};

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

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

let messageSeq = 0;
const nextId = () => `${Date.now()}-${messageSeq++}`;

/* =========================================================
   COMPONENT
========================================================= */

export default function Game({ onAuthError, onLogout }: GameProps) {
  const username = localStorage.getItem("username") || "Player";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const meRef = useRef<Avatar | null>(null);
  const othersRef = useRef<Map<string, Avatar>>(new Map());
  const namesRef = useRef<Map<string, string>>(new Map());
  const keysRef = useRef<Facing[]>([]);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const cameraRef = useRef({ ox: 0, oy: 0, t: 32 });
  const zoomRef = useRef(0);
  const retryRef = useRef<() => void>(() => {});
  const panelOpenRef = useRef(false);
  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;

  const [status, setStatus] = useState<Status>("connecting");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showHint, setShowHint] = useState(() => localStorage.getItem(HINT_KEY) !== "1");

  zoomRef.current = zoomIndex;
  panelOpenRef.current = panelOpen;

  const nameOf = useCallback(
    (id: string) => namesRef.current.get(id) ?? `Player ${id.slice(-4)}`,
    []
  );

  const pushMessage = useCallback((msg: Omit<ChatMessage, "id" | "at">) => {
    setMessages((prev) => [...prev.slice(-199), { ...msg, id: nextId(), at: Date.now() }]);
    if (msg.kind === "chat" && !msg.self && !panelOpenRef.current) setUnread((n) => n + 1);
  }, []);

  /* =======================================================
     NETWORK
  ======================================================= */

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      onAuthErrorRef.current();
      return;
    }

    let disposed = false;
    let authFailed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const upsertOther = (raw: Record<string, unknown>) => {
      const userId = raw.userId != null ? String(raw.userId) : "";
      if (!userId || userId === meRef.current?.userId) return null;
      if (typeof raw.username === "string") namesRef.current.set(userId, raw.username);
      const x = num(raw.x);
      const y = num(raw.y);
      const existing = othersRef.current.get(userId);
      if (existing) {
        const dx = x - existing.x;
        const dy = y - existing.y;
        if (dx || dy) {
          existing.facing = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
          existing.movedAt = performance.now();
        }
        existing.x = x;
        existing.y = y;
        return existing;
      }
      const avatar: Avatar = { userId, x, y, rx: x, ry: y, facing: "down", movedAt: 0 };
      othersRef.current.set(userId, avatar);
      return avatar;
    };

    // The server has used both { payload: { user } } and flat payloads; accept either.
    const handle = (msg: ServerMessage) => {
      const p = msg.payload ?? {};
      const nested = (p.user ?? p) as Record<string, unknown>;

      switch (msg.type) {
        case "space-joined": {
          const spawn = (p.spawn ?? p.user ?? {}) as Record<string, unknown>;
          const userId = String(p.userId ?? spawn.userId ?? "me");
          const x = num(spawn.x);
          const y = num(spawn.y);
          meRef.current = { userId, x, y, rx: x, ry: y, facing: "down", movedAt: 0 };
          namesRef.current.set(userId, username);
          othersRef.current = new Map();
          const users = Array.isArray(p.users) ? (p.users as Record<string, unknown>[]) : [];
          users.forEach(upsertOther);
          attempt = 0;
          setStatus("online");
          setJoined(true);
          pushMessage({
            kind: "system",
            text:
              users.length === 0
                ? "You're in the lobby. Nobody else is here yet."
                : `You're in the lobby with ${users.length} other ${users.length === 1 ? "player" : "players"}.`,
          });
          break;
        }

        case "user-joined": {
          const avatar = upsertOther(nested);
          if (avatar) pushMessage({ kind: "system", text: `${nameOf(avatar.userId)} joined.` });
          break;
        }

        case "movement": {
          upsertOther(nested);
          break;
        }

        case "movement-rejected": {
          const me = meRef.current;
          if (me) {
            me.x = num(p.x, me.x);
            me.y = num(p.y, me.y);
          }
          targetRef.current = null;
          break;
        }

        case "user-left": {
          const userId = p.userId != null ? String(p.userId) : "";
          if (othersRef.current.delete(userId)) {
            pushMessage({ kind: "system", text: `${nameOf(userId)} left.` });
          }
          break;
        }

        case "chat": {
          const text = String(p.text ?? p.message ?? "").trim();
          const userId = p.userId != null ? String(p.userId) : "";
          if (!text || (userId && userId === meRef.current?.userId)) break;
          if (userId && typeof p.username === "string") namesRef.current.set(userId, p.username);
          const name = userId ? nameOf(userId) : String(p.username ?? "Player");
          pushMessage({ kind: "chat", userId, name, text });
          const avatar = othersRef.current.get(userId);
          if (avatar) avatar.bubble = { text, until: performance.now() + BUBBLE_MS };
          break;
        }

        case "auth-error": {
          authFailed = true;
          wsRef.current?.close();
          onAuthErrorRef.current();
          break;
        }

        case "error": {
          const text = typeof p.message === "string" ? p.message : "The server reported an error.";
          setToast(text);
          break;
        }
      }
    };

    const connect = () => {
      clearTimeout(retryTimer);
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", payload: { spaceId: SPACE_ID, token, username } }));
      };

      ws.onmessage = (event) => {
        try {
          handle(JSON.parse(event.data) as ServerMessage);
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed || authFailed) return;
        setJoined(false);
        othersRef.current.clear();
        attempt++;
        if (attempt > MAX_RETRIES) {
          setStatus("offline");
          return;
        }
        setStatus("reconnecting");
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** (attempt - 1), 10000));
      };
    };

    retryRef.current = () => {
      attempt = 0;
      connect();
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [username, nameOf, pushMessage]);

  /* =======================================================
     INPUT
  ======================================================= */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        setPanelOpen(true);
        requestAnimationFrame(() => chatInputRef.current?.focus());
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = KEY_DIRS[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      keysRef.current = [...keysRef.current.filter((d) => d !== dir), dir];
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key.toLowerCase()];
      if (dir) keysRef.current = keysRef.current.filter((d) => d !== dir);
    };
    const clear = () => {
      keysRef.current = [];
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  /* Movement: one tile per tick, one axis at a time (the server rejects diagonals). */
  useEffect(() => {
    const id = setInterval(() => {
      const me = meRef.current;
      const ws = wsRef.current;
      if (!me || !ws || ws.readyState !== WebSocket.OPEN) return;

      let dir: Facing | null = keysRef.current[keysRef.current.length - 1] ?? null;
      if (dir) {
        targetRef.current = null;
      } else if (targetRef.current) {
        dir = stepToward(me.x, me.y, targetRef.current.x, targetRef.current.y);
        if (!dir) targetRef.current = null;
      }
      if (!dir) return;

      me.facing = dir;
      const [dx, dy] = DIRS[dir];
      const nx = me.x + dx;
      const ny = me.y + dy;
      if (!canStep(me.x, me.y, nx, ny)) return;

      me.x = nx;
      me.y = ny;
      me.movedAt = performance.now();
      ws.send(JSON.stringify({ type: "move", payload: { x: nx, y: ny } }));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  const handleCanvasPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (isTyping(document.activeElement)) (document.activeElement as HTMLElement).blur();
    const rect = e.currentTarget.getBoundingClientRect();
    const { ox, oy, t } = cameraRef.current;
    const x = Math.floor((e.clientX - rect.left - ox) / t);
    const y = Math.floor((e.clientY - rect.top - oy) / t);
    if (inBounds(x, y)) targetRef.current = { x, y };
  };

  const pressDir = (dir: Facing) => {
    keysRef.current = [...keysRef.current.filter((d) => d !== dir), dir];
  };
  const releaseDir = (dir: Facing) => {
    keysRef.current = keysRef.current.filter((d) => d !== dir);
  };

  /* =======================================================
     RENDER LOOP
  ======================================================= */

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = prefersReducedMotion();
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }

      // Fit the whole map by default and zoom in from there. On narrow screens where
      // the whole map would be tiny, fill the viewport instead and follow the player.
      const contain = Math.min(cw / WORLD_W, ch / WORLD_H);
      const base = contain >= 26 ? contain : Math.max(26, Math.min(40, Math.max(cw / WORLD_W, ch / WORLD_H)));
      const t = Math.round(base * ZOOMS[zoomRef.current] * 2) / 2;
      const worldW = WORLD_W * t;
      const worldH = WORLD_H * t;

      const me = meRef.current;
      const k = reduced ? 1 : Math.min(1, dt * 14);
      const avatars = [...othersRef.current.values()];
      if (me) avatars.push(me);
      for (const a of avatars) {
        if (Math.abs(a.x - a.rx) + Math.abs(a.y - a.ry) > 4) {
          a.rx = a.x;
          a.ry = a.y;
        } else {
          a.rx += (a.x - a.rx) * k;
          a.ry += (a.y - a.ry) * k;
        }
      }

      const focusX = me ? me.rx * t + t / 2 : worldW / 2;
      const focusY = me ? me.ry * t + t / 2 : worldH / 2;
      const ox = Math.round(worldW <= cw ? (cw - worldW) / 2 : Math.min(0, Math.max(cw - worldW, cw / 2 - focusX)));
      const oy = Math.round(worldH <= ch ? (ch - worldH) / 2 : Math.min(0, Math.max(ch - worldH, ch / 2 - focusY)));
      cameraRef.current = { ox, oy, t };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PALETTE.night;
      ctx.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.drawImage(getWorldLayer(t, dpr), 0, 0, worldW, worldH);

      if (targetRef.current) drawTarget(ctx, targetRef.current.x, targetRef.current.y, t, now);

      const tags: { a: Avatar; cx: number; top: number }[] = [];
      for (const a of avatars.sort((p, q) => p.ry - q.ry)) {
        const cx = a.rx * t + t / 2;
        const cy = a.ry * t + t / 2;
        const walking = now - a.movedAt < 200;
        const self = a === me;
        const top = drawAvatar(ctx, {
          cx,
          cy,
          t,
          color: colorFor(a.userId),
          name: self ? username : nameOf(a.userId),
          self,
          facing: a.facing,
          bob: walking && !reduced ? Math.abs(Math.sin(now / 60)) * t * 0.06 : 0,
        });
        tags.push({ a, cx, top });
      }
      for (const { a, cx, top } of tags) {
        if (a.bubble && a.bubble.until > now) {
          drawBubble(ctx, cx, top, a.bubble.text, t, Math.min(1, (a.bubble.until - now) / 300));
        }
      }
      ctx.restore();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [username, nameOf]);

  /* =======================================================
     SIDEBAR DATA
  ======================================================= */

  useEffect(() => {
    const id = setInterval(() => {
      const me = meRef.current;
      const rows: PlayerRow[] = [];
      if (me) rows.push({ userId: me.userId, name: username, color: colorFor(me.userId), self: true, near: false });
      const others = [...othersRef.current.values()]
        .map((a) => ({ a, d: me ? Math.abs(a.x - me.x) + Math.abs(a.y - me.y) : 99 }))
        .sort((p, q) => p.d - q.d);
      for (const { a, d } of others) {
        rows.push({ userId: a.userId, name: nameOf(a.userId), color: colorFor(a.userId), self: false, near: d <= 3 });
      }
      setPlayers((prev) =>
        prev.length === rows.length &&
        prev.every((r, i) => r.userId === rows[i].userId && r.name === rows[i].name && r.near === rows[i].near)
          ? prev
          : rows
      );
    }, 400);
    return () => clearInterval(id);
  }, [username, nameOf]);

  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, panelOpen]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (panelOpen) setUnread(0);
  }, [panelOpen]);

  /* =======================================================
     ACTIONS
  ======================================================= */

  const sendChat = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setToast("You're offline, so the message wasn't sent. Wait for the connection to come back.");
      return;
    }
    // `text` for the current server, `message` for older builds.
    ws.send(JSON.stringify({ type: "chat", payload: { text, message: text, username } }));
    // The server doesn't echo your own messages back, so show them right away.
    pushMessage({ kind: "chat", userId: meRef.current?.userId, name: username, text, self: true });
    if (meRef.current) meRef.current.bubble = { text, until: performance.now() + BUBBLE_MS };
    setDraft("");
  };

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem(HINT_KEY, "1");
  };

  const recenter = () => {
    targetRef.current = null;
    setZoomIndex(1);
  };

  const othersCount = Math.max(0, players.length - 1);

  /* =======================================================
     VIEW
  ======================================================= */

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-night">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b-2 border-line bg-deep px-3 sm:px-4">
        <LogoMark size={30} />
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-none">Lobby</p>
          <p className="mt-0.5 text-xs text-mist">
            {joined ? (othersCount === 0 ? "Just you" : `You and ${othersCount} other${othersCount === 1 ? "" : "s"}`) : "Not joined"}
          </p>
        </div>

        <StatusPill status={status} />

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full bg-panel py-1 pl-1 pr-3 text-sm font-medium sm:flex">
            <AvatarBean color={colorFor(meRef.current?.userId ?? username)} size={24} />
            <span className="max-w-[10rem] truncate">{username}</span>
          </span>

          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-panel lg:hidden"
            aria-label={unread ? `Open chat, ${unread} unread` : "Open chat"}
          >
            <MessageSquare size={18} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-mustard px-1 text-xs font-bold text-night">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-mist hover:bg-panel hover:text-paper"
          >
            <LogOut size={17} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* World */}
        <main className="relative min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasPointer}
            className="absolute inset-0 h-full w-full cursor-pointer touch-none"
            aria-label="Game world. Use WASD or arrow keys to move, or click a tile to walk there."
          />

          {/* Zoom */}
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg bg-deep/90 ring-2 ring-line backdrop-blur-sm">
            <IconButton label="Zoom in" onClick={() => setZoomIndex((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIndex === ZOOMS.length - 1}>
              <Plus size={18} />
            </IconButton>
            <IconButton label="Zoom out" onClick={() => setZoomIndex((z) => Math.max(0, z - 1))} disabled={zoomIndex === 0}>
              <Minus size={18} />
            </IconButton>
            <IconButton label="Follow my avatar" onClick={recenter}>
              <LocateFixed size={18} />
            </IconButton>
          </div>

          {/* Toast */}
          {toast && (
            <div role="status" className="absolute left-1/2 top-3 z-10 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-lg bg-deep py-2.5 pl-4 pr-2 text-sm ring-2 ring-brick/60">
              {toast}
              <button type="button" onClick={() => setToast(null)} className="rounded p-1 text-mist hover:text-paper" aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Controls hint */}
          {showHint && joined && (
            <div className="absolute bottom-3 left-3 z-10 hidden max-w-sm items-start gap-3 rounded-lg bg-deep/95 p-3 text-sm ring-2 ring-line backdrop-blur-sm sm:flex">
              <div className="space-y-1.5">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span>
                  <span className="text-mist">or arrows to walk, or click a tile</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="kbd">Enter</span>
                  <span className="text-mist">to chat,</span>
                  <span className="kbd">Esc</span>
                  <span className="text-mist">to go back to walking</span>
                </p>
              </div>
              <button type="button" onClick={dismissHint} className="rounded p-1 text-mist hover:text-paper" aria-label="Hide controls">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Touch D-pad */}
          {joined && (
            <div className="touch-only absolute bottom-4 right-4 z-10 grid-cols-3 gap-1.5 select-none">
              <span />
              <DPadButton dir="up" onPress={pressDir} onRelease={releaseDir}><ChevronUp /></DPadButton>
              <span />
              <DPadButton dir="left" onPress={pressDir} onRelease={releaseDir}><ChevronLeft /></DPadButton>
              <DPadButton dir="down" onPress={pressDir} onRelease={releaseDir}><ChevronDown /></DPadButton>
              <DPadButton dir="right" onPress={pressDir} onRelease={releaseDir}><ChevronRight /></DPadButton>
            </div>
          )}

          {/* Joining / offline */}
          {!joined && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-night/70 p-6 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl bg-deep p-7 text-center ring-2 ring-line" style={{ boxShadow: "0 8px 0 #081816" }}>
                {status === "offline" ? (
                  <>
                    <h2 className="font-display text-2xl font-bold">Can't reach the lobby</h2>
                    <p className="mt-2 text-mist">
                      The game server isn't responding. It may be starting up; try again in a moment.
                    </p>
                    <button type="button" onClick={() => retryRef.current()} className="btn btn-primary mt-6 w-full">
                      <RotateCw size={17} aria-hidden="true" />
                      Try again
                    </button>
                  </>
                ) : (
                  <>
                    <div className="anim-bob mx-auto w-fit">
                      <AvatarBean color={PALETTE.mustard} size={48} />
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-bold">
                      {status === "reconnecting" ? "Reconnecting…" : "Joining the lobby…"}
                    </h2>
                    <p className="mt-2 text-mist">
                      {status === "reconnecting"
                        ? "Lost the connection. Getting you back in."
                        : "Finding you a spot on the floor."}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Mobile backdrop */}
        {panelOpen && (
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 z-30 bg-night/60 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* Side panel: players + chat */}
        <aside
          className={`${
            panelOpen ? "flex" : "hidden"
          } absolute inset-x-0 bottom-0 z-40 h-[75%] flex-col rounded-t-2xl border-t-2 border-line bg-deep lg:static lg:z-auto lg:flex lg:h-auto lg:w-80 lg:rounded-none lg:border-l-2 lg:border-t-0`}
          aria-label="Players and chat"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3 lg:hidden">
            <span className="font-semibold">Lobby</span>
            <button type="button" onClick={() => setPanelOpen(false)} className="rounded p-2 text-mist hover:text-paper" aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <section className="max-h-[38%] shrink-0 overflow-y-auto border-b-2 border-line px-3 py-3">
            <h2 className="px-1 text-sm font-semibold text-mist">
              In the room <span className="text-paper">{players.length}</span>
            </h2>
            <ul className="mt-2 space-y-0.5">
              {players.map((p) => (
                <li key={p.userId} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
                  <AvatarBean color={p.color} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  {p.self ? (
                    <span className="rounded bg-mustard px-1.5 py-0.5 text-xs font-semibold text-night">you</span>
                  ) : p.near ? (
                    <span className="text-xs text-mustard">nearby</span>
                  ) : null}
                </li>
              ))}
              {players.length <= 1 && joined && (
                <li className="px-1.5 py-2 text-sm text-mist">
                  Nobody else is here yet. Share the link with a friend and they'll appear on the map.
                </li>
              )}
            </ul>
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <div ref={chatListRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3" aria-live="polite">
              {messages.length === 0 && (
                <p className="text-sm text-mist">Messages from everyone in the lobby show up here.</p>
              )}
              {messages.map((m) =>
                m.kind === "system" ? (
                  <p key={m.id} className="text-xs text-mist">{m.text}</p>
                ) : (
                  <div key={m.id} className="text-sm leading-snug">
                    <span className="font-semibold" style={{ color: m.self ? PALETTE.mustard : m.userId ? colorFor(m.userId) : undefined }}>
                      {m.self ? "You" : m.name}
                    </span>
                    <span className="ml-2 break-words text-paper">{m.text}</span>
                  </div>
                )
              )}
            </div>

            <form onSubmit={sendChat} className="flex shrink-0 gap-2 border-t-2 border-line p-3">
              <input
                ref={chatInputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.currentTarget.blur();
                    if (window.matchMedia("(max-width: 1023px)").matches) setPanelOpen(false);
                  }
                }}
                maxLength={200}
                placeholder={joined ? "Say something to the room" : "Waiting for connection"}
                disabled={!joined}
                aria-label="Chat message"
                className="h-11 min-w-0 flex-1 rounded-lg bg-night px-3 text-sm ring-2 ring-line outline-none placeholder:text-mist/70 focus:ring-mustard disabled:opacity-60"
              />
              <button type="submit" disabled={!joined || !draft.trim()} className="btn btn-primary h-11 w-11 px-0" aria-label="Send message">
                <Send size={17} />
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   SMALL PIECES
========================================================= */

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, { label: string; dot: string; blink: boolean }> = {
    online: { label: "Live", dot: "bg-[#5fc79c]", blink: false },
    connecting: { label: "Connecting", dot: "bg-mustard", blink: true },
    reconnecting: { label: "Reconnecting", dot: "bg-mustard", blink: true },
    offline: { label: "Offline", dot: "bg-brick", blink: false },
  };
  const s = styles[status];
  return (
    <span className="ml-1 hidden items-center gap-2 rounded-full bg-panel px-3 py-1 text-xs font-medium sm:inline-flex" role="status">
      <span className={`h-2 w-2 rounded-full ${s.dot} ${s.blink ? "anim-blink" : ""}`} />
      {s.label}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center text-paper hover:bg-panel disabled:opacity-35 [&+&]:border-t-2 [&+&]:border-line"
    >
      {children}
    </button>
  );
}

function DPadButton({
  dir,
  onPress,
  onRelease,
  children,
}: {
  dir: Facing;
  onPress: (d: Facing) => void;
  onRelease: (d: Facing) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={`Move ${dir}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onPress(dir);
      }}
      onPointerUp={() => onRelease(dir)}
      onPointerCancel={() => onRelease(dir)}
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-14 w-14 items-center justify-center rounded-xl bg-deep/90 text-paper ring-2 ring-line active:bg-panel"
    >
      {children}
    </button>
  );
}
