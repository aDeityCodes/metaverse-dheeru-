import { type FormEvent, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { AvatarBean, Wordmark } from "./components/Brand";

type Mode = "signin" | "signup";

type AuthProps = {
  mode: Mode;
  onSuccess: () => void;
  onBack: () => void;
  onSwitchMode: (mode: Mode) => void;
  message?: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3004";

/* Turn server messages into instructions a player can act on. */
const FRIENDLY_ERRORS: Record<string, string> = {
  "User already exists": "That username is taken. Pick another one.",
  "User not found": "There's no player with that username. Check the spelling or create a player.",
  "Invalid password": "That password doesn't match this username.",
  "Validation failed": "Check your username and password and try again.",
};

async function postJSON(path: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the game server. Check your connection and try again in a few seconds.");
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const raw = String(data.message ?? data.error ?? "");
    throw new Error(FRIENDLY_ERRORS[raw] ?? (raw || "Something went wrong. Try again."));
  }
  return data;
}

type FieldErrors = Partial<Record<"username" | "password" | "confirm", string>>;

export default function Auth({ mode, onSuccess, onBack, onSwitchMode, message }: AuthProps) {
  const isSignup = mode === "signup";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const cleanName = username.trim();
  const previewName = cleanName || "your name";

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!cleanName) errors.username = "Enter a username.";
    else if (cleanName.length < 3) errors.username = "Use at least 3 characters.";
    if (!password) errors.password = "Enter your password.";
    else if (isSignup && password.length < 6) errors.password = "Use at least 6 characters.";
    if (isSignup && password && confirm !== password) errors.confirm = "The passwords don't match.";
    return errors;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      let userId: unknown;
      if (isSignup) {
        const signup = await postJSON("/signup", {
          username: cleanName,
          password,
          type: "user",
        });
        userId = signup.userId;
      }

      // The signup endpoint returns no token, so we always sign in after it.
      const signin = await postJSON("/signin", { username: cleanName, password });

      if (typeof signin.token !== "string") {
        throw new Error("The server didn't send a login token. Try signing in again.");
      }

      localStorage.setItem("token", signin.token);
      localStorage.setItem("username", cleanName);
      const id = signin.userId ?? userId;
      if (typeof id === "string") localStorage.setItem("userId", id);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchTo = (next: Mode) => {
    setError("");
    setFieldErrors({});
    setConfirm("");
    onSwitchMode(next);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-night">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-mist hover:text-paper disabled:opacity-50"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
        <Wordmark size={28} />
        <span className="w-16" aria-hidden="true" />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 pb-12 sm:px-8 md:grid-cols-2 md:gap-14">
        {/* Name tag preview */}
        <section className="order-2 md:order-1" aria-label="Preview of your player">
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            {isSignup ? "Make your player" : "Welcome back"}
          </h1>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-mist">
            {isSignup
              ? "Your username is the name tag everyone in the lobby sees above your head."
              : "Sign in and you'll drop straight into the lobby."}
          </p>

          <div
            className="tile-floor relative mt-8 hidden h-48 max-w-sm items-center justify-center overflow-hidden rounded-xl ring-2 ring-line md:flex"
            style={{ boxShadow: "0 8px 0 #081816" }}
          >
            <div className="anim-bob flex flex-col items-center gap-2">
              <span
                className={`max-w-[14rem] truncate rounded-full px-3 py-1 text-sm font-semibold ${
                  cleanName ? "bg-mustard text-night" : "bg-night/85 text-mist"
                }`}
              >
                {previewName}
              </span>
              <AvatarBean color="#e9bf45" size={52} />
            </div>
          </div>
        </section>

        {/* Form */}
        <section
          className="order-1 rounded-2xl bg-deep p-6 ring-2 ring-line sm:p-8 md:order-2"
          style={{ boxShadow: "0 8px 0 #081816" }}
        >
          <h2 className="text-xl font-semibold">{isSignup ? "Create a player" : "Sign in"}</h2>

          {message && (
            <p className="mt-4 rounded-lg bg-sky/15 px-4 py-3 text-sm text-paper ring-1 ring-sky/40">
              {message}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            <Field
              id="username"
              label="Username"
              error={fieldErrors.username}
              hint={isSignup ? "3 to 20 characters." : undefined}
            >
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                disabled={loading}
                aria-invalid={!!fieldErrors.username}
                aria-describedby={fieldErrors.username ? "username-error" : undefined}
                className="h-12 w-full rounded-lg bg-night px-4 text-paper ring-2 ring-line outline-none placeholder:text-mist/60 focus:ring-mustard aria-invalid:ring-brick"
                placeholder="e.g. pixelpilot"
              />
            </Field>

            <Field id="password" label="Password" error={fieldErrors.password}>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  disabled={loading}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  className="h-12 w-full rounded-lg bg-night pl-4 pr-12 text-paper ring-2 ring-line outline-none focus:ring-mustard aria-invalid:ring-brick"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-mist hover:text-paper"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {isSignup && (
              <Field id="confirm" label="Confirm password" error={fieldErrors.confirm}>
                <input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  aria-invalid={!!fieldErrors.confirm}
                  aria-describedby={fieldErrors.confirm ? "confirm-error" : undefined}
                  className="h-12 w-full rounded-lg bg-night px-4 text-paper ring-2 ring-line outline-none focus:ring-mustard aria-invalid:ring-brick"
                />
              </Field>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-brick/15 px-4 py-3 text-sm text-paper ring-1 ring-brick/50">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary h-12 w-full text-base">
              {loading ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                  {isSignup ? "Creating your player…" : "Signing in…"}
                </>
              ) : isSignup ? (
                "Create player and enter"
              ) : (
                "Sign in and enter"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-mist">
            {isSignup ? "Already have a player? " : "New here? "}
            <button
              type="button"
              onClick={() => switchTo(isSignup ? "signin" : "signup")}
              disabled={loading}
              className="rounded font-semibold text-mustard underline-offset-4 hover:underline"
            >
              {isSignup ? "Sign in" : "Create a player"}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-brick">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-mist">{hint}</p>
      ) : null}
    </div>
  );
}
