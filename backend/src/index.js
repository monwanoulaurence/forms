const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const client = require("prom-client");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "devops-secret-key";

// ── Base de données ────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "authdb",
  user: process.env.DB_USER || "authuser",
  password: process.env.DB_PASSWORD || "authpass",
});

app.use(cors());
app.use(express.json());

// ── Métriques Prometheus SPÉCIFIQUES à l'app ───────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Compteur d'inscriptions
const registrationsTotal = new client.Counter({
  name: "app_registrations_total",
  help: "Nombre total d'inscriptions depuis le démarrage",
  registers: [register],
});

// Compteur de connexions réussies
const loginsSuccess = new client.Counter({
  name: "app_logins_success_total",
  help: "Nombre total de connexions réussies",
  registers: [register],
});

// Compteur de connexions échouées
const loginsFailed = new client.Counter({
  name: "app_logins_failed_total",
  help: "Nombre total de connexions échouées (mauvais mot de passe)",
  registers: [register],
});

// Jauge du nombre d'utilisateurs inscrits en BDD
const usersGauge = new client.Gauge({
  name: "app_users_registered_total",
  help: "Nombre total d'utilisateurs enregistrés en base de données",
  registers: [register],
});

// Histogramme du temps de réponse des requêtes API
const httpDuration = new client.Histogram({
  name: "app_http_request_duration_seconds",
  help: "Durée des requêtes HTTP en secondes",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [register],
});

// Middleware pour mesurer le temps de réponse
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});

// ── Initialisation BDD ─────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      firstname TEXT NOT NULL,
      lastname TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Initialiser la jauge avec le nombre d'utilisateurs existants
  const result = await pool.query("SELECT COUNT(*) FROM users");
  usersGauge.set(parseInt(result.rows[0].count));
  console.log("✅ Base de données initialisée");
}

// ── Routes ─────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Métriques Prometheus
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Inscription
app.post("/api/register", async (req, res) => {
  const { firstname, lastname, email, password } = req.body;

  if (!firstname || !lastname || !email || !password) {
    return res.status(400).json({ error: "Tous les champs sont obligatoires" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (firstname, lastname, email, password) VALUES ($1, $2, $3, $4)",
      [firstname, lastname, email, hashedPassword]
    );

    // Incrémenter les métriques
    registrationsTotal.inc();
    usersGauge.inc();

    res.status(201).json({ message: "Inscription réussie !" });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Cet email est déjà utilisé" });
    }
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Connexion
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      loginsFailed.inc();
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    loginsSuccess.inc();
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: { firstname: user.firstname, lastname: user.lastname, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Liste des inscrits (protégée par JWT)
app.get("/api/users", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token manquant" });

  try {
    jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    const result = await pool.query(
      "SELECT id, firstname, lastname, email, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
});

// ── Démarrage ──────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Backend démarré sur le port ${PORT}`));
});
