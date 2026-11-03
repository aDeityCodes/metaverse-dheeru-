import { useState } from "react";
import Game from "./Game";
import Landing from "./Landing";
import Auth from "./Auth";

type Screen = "landing" | "signin" | "signup" | "game";

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("userId");
}

export default function App() {
  // Read the token synchronously so returning players don't see a landing-page flash.
  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem("token") ? "game" : "landing"
  );
  const [authMessage, setAuthMessage] = useState("");

  const go = (next: Screen, message = "") => {
    setAuthMessage(message);
    setScreen(next);
    window.scrollTo(0, 0);
  };

  if (screen === "signin" || screen === "signup") {
    return (
      <Auth
        key={screen}
        mode={screen}
        message={authMessage}
        onSuccess={() => go("game")}
        onBack={() => go("landing")}
        onSwitchMode={(mode) => go(mode)}
      />
    );
  }

  if (screen === "game") {
    return (
      <Game
        onLogout={() => {
          clearSession();
          go("landing");
        }}
        onAuthError={() => {
          clearSession();
          go("signin", "Your session has expired. Sign in again to rejoin the lobby.");
        }}
      />
    );
  }

  return <Landing onSignIn={() => go("signin")} onSignUp={() => go("signup")} />;
}
