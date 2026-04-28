"use client";

import { useSyncExternalStore } from "react";

let isOpen = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

export function setMobileNavOpen(open: boolean) {
  if (isOpen === open) return;
  isOpen = open;
  emit();
}

export function toggleMobileNav() {
  isOpen = !isOpen;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useMobileNavOpen() {
  return useSyncExternalStore(
    subscribe,
    () => isOpen,
    () => false,
  );
}
