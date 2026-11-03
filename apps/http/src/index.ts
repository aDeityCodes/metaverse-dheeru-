import express from "express";
import { router } from "./routes/v1";

const app = express();
/* =========================
   CORS
========================= */

app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://meta-verse-game-frontend-ibvw.vercel.app",
    "https://metaverse-game-ten.vercel.app",
  ];

  const allowedSuffixes = [
    "-sdeepanshu7s-projects.vercel.app",
    "-adityasinghnehra-8669.vercel.app",
  ];

  const origin = req.headers.origin;

  if (
    origin &&
    (allowedOrigins.includes(origin) ||
      allowedSuffixes.some((suffix) => origin.endsWith(suffix)))
  ) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* =========================
   BODY PARSER
========================= */

app.use(express.json());

/* =========================
   API ROUTES
========================= */

app.use("/api/v1", router);

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`);
});
