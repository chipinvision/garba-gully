import { Client } from '@colyseus/sdk';
import assert from 'assert';

async function runLiveTest() {
  console.log('Connecting to live server ws://localhost:2567...');
  const client1 = new Client('ws://localhost:2567');
  const client2 = new Client('ws://localhost:2567');

  const room1 = await client1.create('garba_room', {
    nickname: 'Pooja',
    avatarId: 0,
    outfitId: 0,
    playlistId: 'PL_TEST_PLAYLIST',
  });
  console.log('✓ Host created room:', room1.roomId, 'invite token:', room1.state.inviteToken);

  const room2 = await client2.joinById(room1.roomId, {
    nickname: 'Vikas',
    avatarId: 1,
    outfitId: 1,
  });
  console.log('✓ Guest joined room:', room2.roomId);

  // Wait for state sync
  await new Promise((r) => setTimeout(r, 100));

  assert.strictEqual(room1.state.players.size, 2);
  assert.strictEqual(room2.state.players.size, 2);

  // 1. Host dances Garba
  console.log('Testing Host dancing Garba...');
  room1.send('dance', { isDancing: true, danceStyle: 'garba' });
  await new Promise((r) => setTimeout(r, 100));

  const hostInClient2 = room2.state.players.get(room1.sessionId);
  assert.ok(hostInClient2, 'Host found in guest view');
  assert.strictEqual(hostInClient2.isDancing, true, 'Host isDancing is true');
  assert.strictEqual(hostInClient2.danceStyle, 'garba', 'Host danceStyle is garba');
  console.log('✓ Guest received Host Garba dance state');

  // 2. Guest dances Dandiya Raas
  console.log('Testing Guest dancing Dandiya Raas...');
  room2.send('dance', { isDancing: true, danceStyle: 'dandiya' });
  await new Promise((r) => setTimeout(r, 100));

  const guestInClient1 = room1.state.players.get(room2.sessionId);
  assert.ok(guestInClient1, 'Guest found in host view');
  assert.strictEqual(guestInClient1.isDancing, true, 'Guest isDancing is true');
  assert.strictEqual(guestInClient1.danceStyle, 'dandiya', 'Guest danceStyle is dandiya');
  console.log('✓ Host received Guest Dandiya dance state');

  // 3. Host switches to Dandiya Raas while dancing
  console.log('Testing Host switching style to Dandiya...');
  room1.send('dance', { isDancing: true, danceStyle: 'dandiya' });
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(room2.state.players.get(room1.sessionId)?.danceStyle, 'dandiya');
  console.log('✓ Guest received Host switch to Dandiya');

  // 4. Host stops dancing
  console.log('Testing Host stopping dance...');
  room1.send('dance', { isDancing: false });
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(room2.state.players.get(room1.sessionId)?.isDancing, false);
  console.log('✓ Guest received Host stopped dancing');

  await room2.leave();
  await room1.leave();
  console.log('🎉 ALL LIVE MULTIPLAYER DANCE SYNCHRONIZATION TESTS PASSED!');
}

runLiveTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
