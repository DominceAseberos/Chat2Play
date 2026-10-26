# Chat2Play — reliability and scaling notes

This is the **existing anonymous, two-real-users web app**. No fake users, bots, profiles, permanent chat history, or durable message storage were added.

## Current implementation (single Node.js process)

- Matchmaking remains server-authoritative. Reciprocal preferences outrank fallback; shared games improve score within the tier. Fallback requires both users to opt in and a minimum waiting time (8 seconds by default). Strict preferences never fall back.
- Pending queue joins are coalesced for about 30 ms so a quick Cancel can win before assignment. A matchmaking sweep considers the **oldest 96** waiting users plus a **rotating window of 32**, and creates at most 32 pairs per sweep. This bounds the expensive O(k²) scoring to k <= 128 (though gathering eligible users still scans the queue). **Tradeoff:** this is a scalable approximation, not an exhaustive optimal global pairing for thousands of users.
- Presence broadcasts are coalesced for 200 ms. Pong runs only for active rooms and pauses when either player's connection is inside the recovery grace period.
- Transient disconnects have a **12-second partner grace period**. Socket.IO Connection State Recovery keeps state for up to **20 seconds**. The connected stranger is notified, then notified again when the partner returns; the conversation/game is not destroyed prematurely. If recovery fails or the grace period expires, the other user receives a clear session-ended message and can Find Again. Queue participants are not falsely shown as online partners.
- When browser visibility changes, the partner can see a non-disclosing **Away in another tab** status, not a false disconnect.
- The browser reconnects with randomized exponential backoff, supports WebSocket with HTTP long-polling fallback, and displays a Retry control on connection trouble.
- Text/GIF/sticker messages are schema-validated, acknowledgement-based, limited to 500 characters for text and 16 KB max socket payload, and rate-limited per socket (700 ms between successful sends). Clients may manually retry a message using the **same UUID**, and the server deduplicates the most recent 100 UUIDs for that socket. A timeout means **delivery unconfirmed**, not proof the recipient did not receive it.
- Local user preferences for theme, sound, reduce motion, and skipping Next confirmation live only in browser storage. There is no permanent chat database, account, or claim of end-to-end encryption.

## Explicit capacity limits

All matching queues, anonymous profiles, room/game data, dedupe caches, report prototypes, and block lists currently live **in process memory**. This implementation is suited to one server and local/prototype use. **Do not just start multiple app instances behind a load balancer**: they would have independent queues and games and could fail to find partners across instances.

For serious concurrent traffic:
1. Run performance tests at realistic simultaneous connections, joins/sec, active Pong rooms, and GIF messages. Collect p95 matchmaking wait, websocket RTT, event-loop delay, memory/GC, disconnect rate, recovery success, rejected message rate, and server egress.
2. Move matchmaking and authoritative game/room ownership to a **shared, single-writer coordinator or partitioned workers**, with distributed atomic claims, lease expiry, and unique room assignment. A Socket.IO adapter by itself **does not share the queue or in-memory room state**.
3. For multi-server recovery, prefer a Socket.IO adapter that supports connection recovery (for example **Redis Streams**). Ordinary Redis Pub/Sub adapter **does not support connection state recovery**. Put Redis behind private network controls with authentication, TLS, and ACLs.
4. If using polling fallback across replicas, set up **sticky sessions** on the load balancer. A websocket-only transport can avoid that requirement, but is less tolerant of networks blocking WebSockets.
5. Add actual moderation/report processing, per-IP/token admission limits, abuse alerts, structured audit metrics (without copying private chat content), graceful shutdown/draining, and tests for server restarts and scale-out before opening to the public.
6. Consider adaptive backpressure on active Pong tick broadcasts and room limits **after** measuring, rather than pretending an unmeasured user count is safe.

## Verification

Run from the project root:

```powershell
npm run build
npm run test:matching
npm run test:smoke
npm run test:arcade
npm run test:arcade:ui
npm run test:gifs
npm run test:reconnect
```

A separate local multi-socket test matched 24 test connections (12 real client-client rooms for test purposes), verified acknowledged delivery, deduplication under retries, and rejection of an oversized message. It does **not** prove large-scale production capacity.

## References

- https://socket.io/docs/v4/connection-state-recovery/
- https://socket.io/docs/v4/client-options/
- https://socket.io/docs/v4/redis-adapter/
- https://socket.io/docs/v4/adapter/
- https://socket.io/docs/v4/delivery-guarantees/
