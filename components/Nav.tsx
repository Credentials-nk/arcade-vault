"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

interface User {
  name: string;
}

interface NavProps {
  user: User | null;
  onSignOut: () => void;
}

export default function Nav({ user, onSignOut }: NavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/library") return pathname === "/library" || pathname.startsWith("/game");
    return pathname.startsWith(href);
  };

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link href="/" className={isActive("/") ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/library" className={isActive("/library") ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/hall" className={isActive("/hall") ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isActive("/about") ? "active" : ""}>
            Acerca de
          </Link>
        </div>

        <div className="spacer"></div>

        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>

        {user ? (
          <button className="btn ghost auth-btn" onClick={onSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}

        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
      />

      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <a
          className={isActive("/") ? "active" : ""}
          onClick={() => go("/")}
          style={{ cursor: "pointer" }}
        >
          Inicio
        </a>
        <a
          className={isActive("/library") ? "active" : ""}
          onClick={() => go("/library")}
          style={{ cursor: "pointer" }}
        >
          Biblioteca
        </a>
        <a
          className={isActive("/hall") ? "active" : ""}
          onClick={() => go("/hall")}
          style={{ cursor: "pointer" }}
        >
          Salón de la Fama
        </a>
        <a
          className={isActive("/about") ? "active" : ""}
          onClick={() => go("/about")}
          style={{ cursor: "pointer" }}
        >
          Acerca de
        </a>
        <a
          className={isActive("/auth") ? "active" : ""}
          onClick={() => go("/auth")}
          style={{ cursor: "pointer" }}
        >
          {user ? "Cuenta" : "Iniciar Sesión"}
        </a>
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
