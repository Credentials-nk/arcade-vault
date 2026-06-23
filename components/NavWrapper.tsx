"use client";

import { useUser } from "@/hooks/useUser";
import Nav from "./Nav";

export default function NavWrapper() {
  const { user, signOut } = useUser();
  return <Nav user={user} onSignOut={signOut} />;
}
