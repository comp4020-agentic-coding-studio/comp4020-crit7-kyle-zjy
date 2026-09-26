import { EventEmitter } from "node:events";

// One process, one bus: every open SSE connection subscribes here, and every
// change to the student's records is broadcast to all of them. There's no
// login, so every visitor shares the demo student — this is how a tab finds
// out that its view is stale. It only works because the app runs on exactly
// one machine (see fly.toml) — a second machine would have its own bus and
// clients would miss events.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

export interface PlannerChange {
  action: string;
  course?: string;
}
