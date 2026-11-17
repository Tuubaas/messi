/**
 * Who this phone is, across reloads and reconnects: a random id the room knows the player
 * by, and the name they last played under.
 */

export interface Identity {
  readonly id: string;
  readonly name: string;
}

const KEY = "tubas:player";

const read = (): Identity | null => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof saved !== "object" || saved === null || !("id" in saved) || !("name" in saved)) {
      return null;
    }
    const { id, name } = saved;
    return typeof id === "string" && /^[\w-]{8,64}$/.test(id) && typeof name === "string"
      ? { id, name }
      : null;
  } catch {
    return null;
  }
};

const write = (identity: Identity) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Without storage a reload makes this phone a new player. The game still works.
  }
};

export const loadIdentity = (): Identity => {
  const saved = read();
  if (saved !== null) return saved;
  const fresh = { id: crypto.randomUUID(), name: "" };
  write(fresh);
  return fresh;
};

export const rememberName = (identity: Identity, name: string): Identity => {
  const named = { ...identity, name };
  write(named);
  return named;
};
