import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setError("");

      const res = await fetch(`${API_BASE}/api/auth/login-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const raw = await res.text();
      console.log("LOGIN STATUS:", res.status);
      console.log("LOGIN RESPONSE:", raw);

      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw || "Backend nuk ktheu JSON.");
      }

      if (!res.ok) {
        throw new Error(data.message || "Gabim gjatë login.");
      }

      if (!data.token) {
        throw new Error("Token mungon nga backend.");
      }

      localStorage.setItem("token", data.token);
      window.location.reload();
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err.message || "Gabim gjatë login.");
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Dream Weddings-KS</h2>
        <p>Hyr në panelin e menaxhimit të galerive ALBAN</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Kyçu në Panel</button>

        {error && <div className="error-box">{error}</div>}
      </form>
    </div>
  );
}

export default LoginPage;