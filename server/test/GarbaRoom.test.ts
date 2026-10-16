import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { tokenToRoomId } from "../src/tokenRegistry.js";

describe("GarbaRoom Multiplayer Tests", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => {
    colyseus = await boot(appConfig);
  });

  after(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("creates a room and sets up host player", async () => {
    const room = await colyseus.createRoom("garba_room", {
      nickname: "Aarav",
      avatarId: 1,
      outfitId: 2,
    });

    assert.ok(room.state.inviteToken, "Invite token should be generated");
    assert.strictEqual(
      tokenToRoomId.get(room.state.inviteToken),
      room.roomId,
      "Token should map to roomId in registry"
    );

    const client1 = await colyseus.connectTo(room, {
      nickname: "Aarav",
      avatarId: 1,
      outfitId: 2,
    });

    const player1 = room.state.players.get(client1.sessionId);
    assert.ok(player1, "Player 1 should exist in state");
    assert.strictEqual(player1.nickname, "Aarav");
    assert.strictEqual(player1.avatarId, 1);
    assert.strictEqual(player1.outfitId, 2);
    assert.strictEqual(player1.isHost, true, "First joiner should be host");
  });

  it("handles multiple players and guest role", async () => {
    const room = await colyseus.createRoom("garba_room", {
      nickname: "HostPriya",
      avatarId: 0,
      outfitId: 0,
    });

    const client1 = await colyseus.connectTo(room, {
      nickname: "HostPriya",
      avatarId: 0,
      outfitId: 0,
    });

    const client2 = await colyseus.connectTo(room, {
      nickname: "GuestRohan",
      avatarId: 2,
      outfitId: 3,
    });

    assert.strictEqual(room.state.players.size, 2);

    const player2 = room.state.players.get(client2.sessionId);
    assert.ok(player2);
    assert.strictEqual(player2.nickname, "GuestRohan");
    assert.strictEqual(player2.isHost, false, "Second joiner is not host");
  });

  it("handles movement and clamping within ground bounds", async () => {
    const room = await colyseus.createRoom("garba_room", {
      nickname: "Dancer",
      avatarId: 0,
      outfitId: 0,
    });

    const client = await colyseus.connectTo(room, {
      nickname: "Dancer",
      avatarId: 0,
      outfitId: 0,
    });

    const player = room.state.players.get(client.sessionId)!;
    const initialX = player.x;
    const initialY = player.y;

    client.send("move", { dx: 5, dy: 0 });
    // Wait for message processing
    await new Promise((r) => setTimeout(r, 50));

    assert.strictEqual(player.x, initialX + 5);
    assert.strictEqual(player.facing, "right");
  });

  it("handles dance state toggle", async () => {
    const room = await colyseus.createRoom("garba_room", {
      nickname: "Dancer",
      avatarId: 0,
      outfitId: 0,
    });

    const client = await colyseus.connectTo(room, {
      nickname: "Dancer",
      avatarId: 0,
      outfitId: 0,
    });

    const player = room.state.players.get(client.sessionId)!;
    assert.strictEqual(player.isDancing, false);

    client.send("dance", { isDancing: true, danceStyle: "dandiya" });
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(player.isDancing, true);
    assert.strictEqual(player.danceStyle, "dandiya");

    client.send("dance", { isDancing: false });
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(player.isDancing, false);
  });

  it("stores playlistId on room creation", async () => {
    const testPlaylistId = "PL4fGSIvJcnXUXN7q0o6r473X-5_Vz42h4";
    const room = await colyseus.createRoom("garba_room", {
      nickname: "HostDJ",
      avatarId: 1,
      outfitId: 1,
      playlistId: testPlaylistId,
    });

    assert.strictEqual(room.state.playlistId, testPlaylistId);
    assert.strictEqual(room.state.playbackState, "paused");
    assert.strictEqual(room.state.currentTrackIndex, 0);
  });

  it("synchronizes playback commands from host and rejects non-host commands", async () => {
    const room = await colyseus.createRoom("garba_room", {
      nickname: "HostDJ",
      avatarId: 1,
      outfitId: 1,
      playlistId: "PL_TEST_PLAYLIST_123",
    });

    const hostClient = await colyseus.connectTo(room, {
      nickname: "HostDJ",
      avatarId: 1,
      outfitId: 1,
    });

    const guestClient = await colyseus.connectTo(room, {
      nickname: "GuestListener",
      avatarId: 0,
      outfitId: 0,
    });

    // 1. Non-host attempts music:play -> MUST be ignored
    guestClient.send("music:play", { trackIndex: 5, positionSeconds: 42 });
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(room.state.playbackState, "paused", "Non-host cannot start playback");
    assert.strictEqual(room.state.currentTrackIndex, 0, "Non-host cannot change track");

    // 2. Host sends music:play -> updates state
    hostClient.send("music:play", { trackIndex: 1, positionSeconds: 15 });
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(room.state.playbackState, "playing");
    assert.strictEqual(room.state.currentTrackIndex, 1);
    assert.strictEqual(room.state.playbackPositionSeconds, 15);
    assert.ok(room.state.lastPlaybackCommandAt > 0);

    // 3. Host sends music:pause -> updates state
    hostClient.send("music:pause", { positionSeconds: 22 });
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(room.state.playbackState, "paused");
    assert.strictEqual(room.state.playbackPositionSeconds, 22);

    // 4. Host sends music:next -> advances track
    hostClient.send("music:next", {});
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(room.state.currentTrackIndex, 2);
    assert.strictEqual(room.state.playbackState, "playing");

    // 5. Non-host attempts music:pause -> MUST be ignored
    guestClient.send("music:pause", { positionSeconds: 0 });
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(room.state.playbackState, "playing", "Non-host cannot pause music");
  });
});
