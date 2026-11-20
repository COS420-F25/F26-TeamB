// KAIte/react/components/Screen.tsx
//
// The wrapper every full-screen component renders into. It carries the "kaite"
// class that styles/kaite.css scopes every rule under. An inactive screen
// stays mounted but hidden, so its state survives going Back.

import type { ReactNode } from "react";

export interface ScreenProps {
  id: string;
  /** Hidden when false. Defaults to true so a screen can be used on its own. */
  active?: boolean;
  /** The standard wide layout; the chat screen turns it off for a narrower column. */
  canvas?: boolean;
  children: ReactNode;
}

export function Screen({ id, active = true, canvas = true, children }: ScreenProps) {
  const className = ["kaite", "screen", canvas ? "canvas" : "", active ? "active" : ""].filter(Boolean).join(" ");
  return (
    <section className={className} id={id}>
      {children}
    </section>
  );
}