"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid username or password");
      setLoading(false);
    } else {
      router.push("/tasks");
      router.refresh();
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#04090f",
      }}
    >
      <div
        style={{
          background: "#0a1a28",
          border: "1px solid #1a3a50",
          borderRadius: 12,
          padding: "40px 48px",
          width: 360,
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#daeaf8", marginBottom: 4 }}>
            MKFRM
          </div>
          <div style={{ fontSize: 13, color: "#4a7a9b" }}>Team Task Board</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                color: "#4a7a9b",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                background: "#04090f",
                border: "1px solid #1a3a50",
                borderRadius: 6,
                padding: "10px 12px",
                color: "#daeaf8",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="your username"
              autoComplete="username"
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                color: "#4a7a9b",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                background: "#04090f",
                border: "1px solid #1a3a50",
                borderRadius: 6,
                padding: "10px 12px",
                color: "#daeaf8",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div
              style={{ color: "#ef4444", fontSize: 13, marginBottom: 16, textAlign: "center" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "#1a6aa0",
              color: "#daeaf8",
              border: "none",
              borderRadius: 6,
              padding: "11px 0",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
