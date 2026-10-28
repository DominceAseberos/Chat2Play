# Ping Pong networking

Ping Pong uses WebRTC for frequent game updates when both players support it.
Render/Socket.IO still owns matchmaking, room membership, invitations, match
completion, and the winner's question. Turn-based games continue to run on the
server.

## Match lifecycle

1. Both scenes load and advertise WebRTC support.
2. The server authorizes negotiation for that game ID and connection epoch.
   Signals are routed only to the matched partner and queued until it is listening.
3. Both clients report an open data channel. The server sends one shared physics
   seed and stops ticking/broadcasting that match.
4. Player 0 runs the same physics module used by the server. The other player sends
   sequenced paddle inputs through a reliable, ordered input channel so release
   events cannot overtake strokes. Snapshots use a separate unordered data channel
   without retransmission so stale positions cannot queue behind lost packets.
   Drag state is repeated in input heartbeats; old sequence numbers are discarded.
5. The browser host sends one validated recovery checkpoint per second. The server
   accepts it only from the designated host for the active game and epoch.
6. The server finalizes the match when the checkpoint reaches the configured score
   with a two-point lead. The existing winner/question flow then runs normally.

The shared physics lives in `src/pongPhysics.ts`. `server/arcade.ts` re-exports
it to preserve existing tests and server imports. The peer module loads only when
needed, and an external React store keeps ball updates out of the surrounding
chat component's render cycle.

## Fallback and interruption

- Unsupported clients immediately use the server game.
- Negotiation has a 15-second timeout and then uses the server game.
- A closed/failed connection, a backgrounded tab, or lost Socket.IO connection
  returns the match to server simulation.
- The host sends checkpoints every second. The server falls back after five
  seconds without an accepted checkpoint; peers detect missing traffic after
  three seconds.
- Fallback changes the epoch so delayed peer packets cannot override server
  state. It can roll gameplay back by roughly one checkpoint interval.
- For the remainder of that match, gameplay stays on the server. The next match
  can negotiate WebRTC again.
- High-frequency server fallback snapshots are volatile; they are not retained
  in the 15-minute recovery buffer. Reconnection sends a fresh snapshot.

Background execution is controlled by the browser/OS. P2P cannot force a phone to
keep running JavaScript. Existing conversation recovery continues to apply.

## Optional Cloudflare TURN

Direct connections use public STUN. Networks that block direct P2P can use an
optional Cloudflare TURN relay. Configure these **server-only** environment values:

```
CLOUDFLARE_TURN_KEY_ID=...
CLOUDFLARE_TURN_API_TOKEN=...
```

`server/pongIce.ts` requests one-hour credentials and briefly caches them to avoid
repeated provider API calls. Long-term keys never reach the browser. The game is
still playable using server fallback if credentials are absent or retrieval fails.

TURN has a free allowance, not unlimited free service. Monitor the provider's
quota and configure access/usage controls before enabling a billed account.
https://developers.cloudflare.com/realtime/sfu/pricing/

Set `PONG_PEER_ENABLED=false` to disable peer mode immediately for new matches.
No paid service or additional account is needed for direct P2P plus server fallback.

## Trust model

This is a casual browser-hosted simulation. Validation checks packet sizes,
types, bounds, game/epoch ownership, score progression, and win conditions. It
does not prove that the host simulated honestly. Competitive rankings or prizes
require server-authoritative physics. Direct connections can expose the peers'
public network addresses; TURN relay-only policy would trade additional relay
traffic for hiding those addresses from the matched player.

## Verification

```
npm run build
npm run test:pong:physics
npm run test:pong:peer
npm run test:reconnect
```

With a production-mode server running on port 3003:

```
npm run test:pong:peer:ui
node server/pong-peer-ui.mjs --server-only
npm run test:pwa
```

The browser test opens two mobile views, negotiates a real WebRTC data channel,
checks forward/sideways serve behavior, then closes the connection and verifies
server fallback. The protocol test checks signal routing, stale/guest checkpoint
rejection, no server simulation broadcasts in peer mode, fallback state, and
winner-question completion. These establish behavior; they do not establish a
maximum production player count.
