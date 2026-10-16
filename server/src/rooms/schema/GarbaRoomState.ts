import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema({
  sessionId: t.string().default(""),
  nickname: t.string().default(""),
  avatarId: t.number().default(0),
  outfitId: t.number().default(0),
  x: t.number().default(400),
  y: t.number().default(300),
  isDancing: t.boolean().default(false),
  danceStyle: t.string().default("garba"), // "garba" | "dandiya"
  facing: t.string().default("down"), // "up" | "down" | "left" | "right"
  isHost: t.boolean().default(false),
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const GarbaRoomState = schema({
  players: t.map(PlayerState),
  musicStartedAt: t.number().default(0), // legacy timestamp
  inviteToken: t.string().default(""),
  hostSessionId: t.string().default(""),
  roomName: t.string().default("Garba Gully"),
  playlistId: t.string().default(""),
  currentTrackIndex: t.number().default(0),
  playbackState: t.string().default("paused"), // "playing" | "paused"
  playbackPositionSeconds: t.number().default(0),
  lastPlaybackCommandAt: t.number().default(0),
});
export type GarbaRoomState = SchemaType<typeof GarbaRoomState>;
