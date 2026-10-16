/**
 * tokenRegistry.ts
 * Shared in-memory registry mapping invite tokens → Colyseus roomIds.
 * Kept in its own module to avoid circular dependencies.
 */

export const tokenToRoomId = new Map<string, string>();
