"use client";

import { signOut, useSession } from "next-auth/react";

export default function LogoutButton() {
  const { data: session } = useSession();
  if (!session) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, color: "#4a4845", letterSpacing: "0.04em" }}>
        {session.user?.name}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 500,
          color: "#8c8780",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 5,
          cursor: "pointer",
          letterSpacing: "0.03em",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
