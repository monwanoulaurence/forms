import { useState } from "react";

export default function App() {
  const [page, setPage] = useState("login"); // login | register | users
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const clearMessages = () => { setError(""); setSuccess(""); };

  // ── Inscription ──────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      setSuccess("Inscription réussie ! Vous pouvez vous connecter.");
      e.target.reset();
      setTimeout(() => setPage("login"), 1500);
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  // ── Connexion ────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      setToken(json.token);
      setUser(json.user);
      setPage("users");
      fetchUsers(json.token);
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  // ── Liste des inscrits ───────────────────────────────────────────
  const fetchUsers = async (t) => {
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${t || token}` },
      });
      const json = await res.json();
      if (res.ok) setUsers(json);
    } catch { setError("Impossible de charger les utilisateurs"); }
  };

  const handleLogout = () => {
    setToken(null); setUser(null); setUsers([]);
    setPage("login"); clearMessages();
  };

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">⬡</span>
            <div>
              <h1>DevOps<span>Auth</span></h1>
              <p>Projet DevOps — OVH Cloud</p>
            </div>
          </div>
          {token && (
            <div className="user-info">
              <span>👤 {user?.firstname} {user?.lastname}</span>
              <button className="btn-outline" onClick={handleLogout}>Déconnexion</button>
            </div>
          )}
        </div>
      </header>

      <main>
        {/* Navigation */}
        {!token && (
          <nav>
            <button className={page === "login" ? "active" : ""} onClick={() => { setPage("login"); clearMessages(); }}>
              Connexion
            </button>
            <button className={page === "register" ? "active" : ""} onClick={() => { setPage("register"); clearMessages(); }}>
              Inscription
            </button>
          </nav>
        )}

        {/* Messages */}
        {error && <div className="alert error">⚠ {error}</div>}
        {success && <div className="alert success">✓ {success}</div>}

        {/* Formulaire Inscription */}
        {page === "register" && (
          <div className="card">
            <h2>Créer un compte</h2>
            <form onSubmit={handleRegister}>
              <div className="form-row">
                <div className="field">
                  <label>Prénom</label>
                  <input name="firstname" placeholder="Jean" required />
                </div>
                <div className="field">
                  <label>Nom</label>
                  <input name="lastname" placeholder="Dupont" required />
                </div>
              </div>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" placeholder="jean@example.com" required />
              </div>
              <div className="field">
                <label>Mot de passe</label>
                <input name="password" type="password" placeholder="••••••••" required minLength={6} />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Inscription..." : "S'inscrire"}
              </button>
            </form>
            <p className="switch">Déjà un compte ? <button onClick={() => setPage("login")}>Se connecter</button></p>
          </div>
        )}

        {/* Formulaire Connexion */}
        {page === "login" && (
          <div className="card">
            <h2>Se connecter</h2>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" placeholder="jean@example.com" required />
              </div>
              <div className="field">
                <label>Mot de passe</label>
                <input name="password" type="password" placeholder="••••••••" required />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
            <p className="switch">Pas encore de compte ? <button onClick={() => setPage("register")}>S'inscrire</button></p>
          </div>
        )}

        {/* Liste des inscrits */}
        {page === "users" && token && (
          <div className="card wide">
            <div className="users-header">
              <h2>Utilisateurs inscrits <span className="badge">{users.length}</span></h2>
              <button className="btn-outline" onClick={() => fetchUsers()}>↺ Actualiser</button>
            </div>
            {users.length === 0 ? (
              <p className="empty">Aucun utilisateur inscrit.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Prénom</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.firstname}</td>
                      <td>{u.lastname}</td>
                      <td>{u.email}</td>
                      <td>{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
