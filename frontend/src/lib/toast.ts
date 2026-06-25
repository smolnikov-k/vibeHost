/**
 * Lightweight toast notification system.
 * Uses a simple event emitter pattern — no external deps.
 */

export type ToastType = 'error' | 'success' | 'info';

export interface ToastEvent {
  id: number;
  message: string;
  type: ToastType;
}

type Listener = (toast: ToastEvent) => void;

let nextId = 1;
const listeners: Set<Listener> = new Set();

export function showToast(message: string, type: ToastType = 'error') {
  const event: ToastEvent = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(event));
}

export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
