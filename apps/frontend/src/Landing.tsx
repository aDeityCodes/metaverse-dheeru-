import { Wordmark } from "./components/Brand";
import WorldPreview from "./components/WorldPreview";

type LandingProps = {
  onSignIn: () => void;
  onSignUp: () => void;
};

const STEPS = [
  {
    title: "Pick a name",
    text: "Sign up with a username and password. That name floats over your head in the world.",
  },
  {
    title: "Walk in",
    text: "You appear somewhere in the lobby. Move with WASD, the arrow keys, or tap where you want to go.",
  },
  {
    title: "Say something",
    text: "Press Enter and type. Everyone in the room sees it in the chat and above your avatar.",
  },
];

export default function Landing({ onSignIn, onSignUp }: LandingProps) {
  return (
    <div className="min-h-dvh bg-night">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-3">
          <button className="btn btn-quiet hidden h-10 sm:inline-flex" onClick={onSignIn}>
            Sign in
          </button>
          <button className="btn btn-primary h-10" onClick={onSignUp}>
            Play now
          </button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-14 lg:pb-24 lg:pt-12">
          <div className="max-w-xl">
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.25rem]">
              Walk in.
              <br />
              Say hi.
              <br />
              Hang out.
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-mist">
              MetaVerse is a shared 2D lobby. Pick a name, walk your avatar around and chat
              with whoever is in the room, live.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button className="btn btn-primary h-12 px-6 text-base" onClick={onSignUp}>
                Create a player
              </button>
              <button className="btn btn-quiet h-12 px-6 text-base" onClick={onSignIn}>
                I already have one
              </button>
            </div>
          </div>

          <div>
            <WorldPreview />
            <p className="mt-5 text-sm text-mist">
              This is the real lobby map. The people walking around here are bots; inside,
              they're other players.
            </p>
          </div>
        </section>

        <section className="border-t-2 border-line bg-deep">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">How it works</h2>

            <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4 md:flex-col">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-mustard font-display text-xl font-bold text-night"
                    style={{ boxShadow: "0 4px 0 var(--color-mustard-dark)" }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1.5 max-w-xs leading-relaxed text-mist">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-14 flex flex-col items-start gap-4 rounded-xl bg-panel p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <p className="text-lg font-medium">The lobby is open. See who's around.</p>
              <button className="btn btn-primary h-12 px-6 text-base" onClick={onSignUp}>
                Create a player
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-mist sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>MetaVerse is an open-source multiplayer project.</span>
        <a
          href="https://github.com/sdeepanshu7/MetaVerse-Game"
          target="_blank"
          rel="noreferrer"
          className="rounded text-paper underline underline-offset-4 hover:text-mustard"
        >
          View the source on GitHub
        </a>
      </footer>
    </div>
  );
}
