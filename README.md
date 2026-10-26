# Chat2Play 🎮💬
**Meet strangers. Break the ice. Play together.**

An Android/iPhone-friendly, React + TypeScript stranger-chat and synchronous mini-game prototype.

## Run locally
1. Install Node.js 22.12+ or 24+.
2. Open PowerShell in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open http://localhost:5173/ in two browser tabs to test matching.
6. For two phones on the same Wi-Fi, open http://YOUR_PC_LAN_IP:5173/ on both phones. Allow the Node/Vite firewall prompt for **private networks only**. Do not expose this prototype to the public Internet.
7. Run `npm run build` for TypeScript checks and production frontend compilation.
8. With the backend running, run `npm run test:smoke` for a two-client integration test.

## Scope of the first prototype
- No registration and no required username
- Optional self-described gender and mutual, strictly compatible gender preference filters
- Adult (18+) self-confirmation checkbox (not proof of age)
- Instant anonymous one-to-one matching and text chat
- Temporary chat: server relays messages and never persists message bodies; browser memory clears when a session ends
- Mutual game invitation / approval
- Server-authoritative Tic-Tac-Toe and Rock Paper Scissors
- In-session likes and mutual-like notification, **not permanent saved connections**
- Next stranger / leave / report-and-leave demo UI
- Desktop and narrow-phone screen layouts

## How live sessions work
The Node process stores a waiting user set, profiles and 1:1 rooms in RAM only.
Socket.IO clients emit events over a WebSocket connection:
- `queue:join`, `queue:waiting`, `match:found`, `queue:cancel`
- `chat:send` to `chat:message` (500-character maximum; basic per-connection rate limit)
- `game:propose`, `game:respond`, `game:move`, `game:state`, `game:close`
- `like:toggle`, `like:state` (ephemeral, requiring two likes for the mutual status)
- `match:next`, `match:leave`, `match:ended`
- `report:send` (reason-only, bounded server memory; there is no real human moderation service)

Only the two sockets belonging to a room can operate on that room. The server validates inputs and game turns.
For RPS, choices are hidden until both players have made a move.

## Privacy contract
- **No transcripts are written to disk/database.** The chat display lives in each browser's React component state and disappears when the session ends. There is no replay after reconnect.
- Queue profiles and room/game state exist in server RAM during live sessions.
- Likes are ephemeral and are lost on disconnect/restart.
- The minimal demo reports list is in RAM only, contains a report reason and a temporary socket identifier, and does not capture chat messages.
- No E2E encryption is claimed. Chat is transmitted via encrypted WSS in a production HTTPS setup, and relay servers necessarily see message content in transit.
- A client could screenshot or copy messages; neither participant nor third-party infrastructure can be guaranteed to forget captured content.

## Production architecture
```
Mobile browser (React + TypeScript PWA)
         |
     HTTPS/WSS
         |
CDN/static hosting      Long-lived Node Socket.IO gateway(s)
                              |
                  Matchmaking service (atomic Redis queue)
                              |
              Redis TTL room/presence/game state
                              |
                 Redis adapter (fanout across nodes)
                              |
         PostgreSQL: opt-in saved contacts ONLY
         Never store ephemeral chat transcripts
```
Start with one Node instance. To expand beyond one node, use Redis both as a **distributed matchmaking/state system** and a Socket.IO broadcast adapter. The adapter alone does NOT synchronize custom queues or game state. Use atomic Redis operations/Lua scripts or a single room-worker owner to avoid double matches and competing game moves. Apply room TTLs and disconnect grace periods. WebSocket-only clients can avoid HTTP polling stickiness, but consider transport fallback and connection-state recovery carefully.

Permanent saved connections must wait for optional pseudonymous accounts or a recoverable anonymous credential, with both users consenting. Store only consent record, public pseudonym, and account references; never save messages. Add saved-contact blocking, remove consent, deletion and account recovery controls.

## Before real public launch (not yet implemented)
- Real age assurance suitable for target markets; robust child-safety controls; do not rely solely on checkbox
- Anti-bot and IP/device-based abuse rate limiting with minimal privacy-respecting metadata retention
- Trust/safety reporting inbox, moderator workflows, repeat-abuser controls, appeals, and escalation
- Abuse prevention for sexual exploitation/grooming/harassment; user-visible safety reminders
- Origin enforcement and hardened CORS; authentication tokens, CSRF/session security where applicable
- Abuse and vulnerability testing; encrypted HTTPS/WSS; secrets stored outside Git
- Transparent Privacy Policy/Terms, deletion and retention policy, jurisdiction compliance
- Capacity tests, deterministic rematch behavior, reconnect grace periods, observability excluding message content
- Persistent saving only via explicit bilateral consent (not screenshots/transcripts)

## Useful improvements in order
1. Server-side hardening and human moderation/reporting before an invite-only beta
2. Additional quick games (Would You Rather, Word Chain, emoji guessing), each running server-authoritatively
3. Reconnect-safe session token and clear room timeout / connection-loss behavior
4. A real matchmaker backed by Redis and concurrency tests
5. Opt-in saved contacts using PostgreSQL plus recoverable anonymous account keys
6. Optional regional/language preferences, accessibility testing, PWA install
7. Deploy separate web app and always-on websocket server with HTTPS

This is a functional development prototype, not a production-safe stranger-chat platform.

## Mobile-first UI/UX update (October 2026)
The app now has:
- Fully custom Radix select dropdowns with keyboard navigation and no native select option list.
- Accessible Radix modals for Settings (light/dark, reduce motion), partner details, report and leave, and Next-stranger confirmation.
- Presence display: the count is active WebSocket connections, not verified unique humans.
- Real-time partner typing indicator, skeleton chat preview during matchmaking, send pending/success/failure icons.
- Word-wrapping responsive message bubbles, SVG-only interface button icons (Lucide), vector sticker packs.
- Emoji search through emoji-picker-react, loaded on demand.
- GIF sharing: paste GIPHY share URLs without any API key; optional GIF search via `VITE_GIPHY_API_KEY` in a local `.env`.
- Reduced-motion support, responsive mobile game drawer, animation transitions from Motion.
- Playwright-core Chrome mobile integration tests at 390px viewport.

Run `npx tsx server/ui-smoke.ts` while the development server is running. This opens two simulated mobile browser sessions and checks custom selectors, appearance, matching, message confirmation, partner details, typing, SVG sticker transfer, GIF link delivery, game invitations, no horizontal overflow, and navigation.

GIF privacy: GIF images are fetched by participants' browsers directly from GIPHY, where normal third-party request logging may apply. This does not create a Chat2Play message history, but never promise zero external request data. GIPHY search uses their content rating `g` and requires their attribution and service terms.

Keep the beta local/invite-only until genuine stranger-chat trust and safety protections are implemented.

## Two-player arcade: Memory Duel and Ping Pong

Two new ORIGINAL React + TypeScript mini-games are fully integrated into existing 1:1 Socket.IO stranger rooms, drawing inspiration (but not copying code or assets) from these MIT-licensed examples:
- Memory reference: https://github.com/neemiassgc/multiplayer-card-memory-game (Phaser + Firebase, MIT)
- Ping Pong reference: https://github.com/iAlias/PingPongMultiplayer (Canvas + Socket.IO, MIT)

The Chat2Play implementations use our own React components, CSS and canvas drawings, so they work with the existing invite/accept flow. No third-party art files were copied.

**Memory Duel:**
- Exactly two players, one 4×3 board, six randomly shuffled pairs, SVG card illustrations and animated card flips.
- The server keeps the deck private and broadcasts only already flipped/matched cards. It verifies that only the active player may flip cards.
- Matching pairs earn one point and let the player keep their turn; mismatches flip back after 1.05 seconds and switch turns.
- Highest score after all pairs are found wins; ties are possible.

**Ping Pong:**
- Exactly two players share server-authoritative ball/paddle physics at ~30 broadcasts/second.
- Player 1 controls the left purple paddle; Player 2 the right coral paddle, using pointer/touch dragging within the SVG-free Canvas court.
- The server validates player-specific paddle movement, checks collisions, bounces the ball and awards a point when it leaves the table. First to 5 wins.
- Both players see synchronized scores and ball movement. Client-side lerp smooths ball movement between updates.
- Players can minimize the expanded arena to keep chatting and reopen it from the game card. Closing the match stops gameplay for both participants.

Testing (start dev server first with `npm run dev`):
- `npm run test:arcade`: two-client server integration, private memory card visibility, turn rules, scoring, 2-player pong physics and cleanup.
- `npm run test:arcade:ui`: two simulated 390px phones, memory card flip animations, game invitation/acceptance, minimize/restore, paddle pointer dragging, no overflow or browser errors.
- `npm run test:smoke` and `npx tsx server/ui-smoke.ts` still test legacy chat, GIF, stickers, Tic-Tac-Toe, RPS, matching, themes and likes.

Memory decks and game state are RAM-only and vanish on match end. Multiplayer code is a single-server development prototype; large-scale production will need distributed room ownership, robust reconnection, stronger abuse prevention, and latency/load testing.

## Noir glass UI reference redesign (October 2026)
Applied a custom editorial mobile-first dark glassmorphism design from the conversation's supplied three-phone design reference. Visual changes live in `src/glass.css`, imported after the existing `styles.css`, so the functional app is still the same.

Design includes glossy charcoal cards, frosted message bubbles, soft pink/silver light blooms, gradients, tactile round controls, a curved floating composer, a compact functional mobile dock for Chat/Games/Stranger/Settings, coordinated game panels and modal styling, and light mode.

The new theme defaults to dark for all users after this visual refresh, with a separate `c2p:theme-noir` local preference so prior light-mode settings don't interfere. Light mode remains available in Settings.

No invented permanent message directory or fake photographic profile cards were added. The original reference uses identified dating-app profiles; Chat2Play stays anonymous and ephemeral. Abstract avatar SVGs replace photographic identities.

Browser validation: `npx tsx server/noir-check.ts` covers light/dark switching, two-mobile matching and texting, dock controls, game drawer and profile modal, page errors and 390px horizontal overflow. Existing UI and 2-player server/arcade test suites are retained.

Screenshots used for local visual inspection: `noir-home-mobile.png`, `noir-chat-mobile.png`, `noir-games-mobile.png` (not committed).

## Smart ranked matchmaking (October 2026)

Chat2Play now matches **only people who actively join the search queue**, not every connected browser. Matchmaking is server-controlled in `server/matching.ts`, with live room creation in `server/index.ts`.

- **Preferred tier:** reciprocal filters must match BOTH ways. All eligible waiting pairs are considered; among pairs in the same tier, prioritize number of shared minigames, then waiting duration.
- **Automatic fallback tier:** if no preferred pairing is possible and at least one person has waited ~8 seconds, users with **Flexible matching** switched on can pair outside gender filters. BOTH users must have switched it on. Preferred pairs always take priority over fallbacks.
- **Strict tier:** when Flexible matching is off, a user can NEVER be assigned a non-reciprocal fallback partner.
- Queue reevaluation runs every 400ms while two or more people are waiting, so expired fallback thresholds work without a new arrival.
- Queues are ephemeral; canceled/disconnected/matched clients are not kept in the waiting set. Blocked socket pairs are excluded from the ranking.
- `match:found` now sends `matchType: "preferred" | "fallback"`. The conversation intro explicitly explains when flexible matching was used.
- Default fallback threshold is `FALLBACK_WAIT_MS=8000`; developers can override for local testing via `MATCH_FALLBACK_MS` (minimum 1000ms, maximum 30000ms).
- Preference ranking is evaluated among people available **at that moment**. It cannot predict whether a better match will enter the queue seconds later, nor does online presence alone imply availability.
- Backward compatible queue clients without a `fallback` field default to `automatic`; the current React UI transmits its selected option explicitly.

`npm run test:matching` starts an independent server on port 3101 using a shortened fallback wait, checks ranking, preferred/fallback matches, strict behavior, queue cancelation, and cleanly stops that test server.

## GIFs

The GIF tab contains two separate sections:

- **Chat2Play reactions:** ten lightweight, original looping GIFs hosted in `public/gifs`. They work without a GIF API key, do not require a CDN, and can be sent as ephemeral chat messages. They were programmatically authored for this project (not downloaded from GIPHY). Re-generate them with `python create_local_gifs.py` if Pillow is installed.
- **GIPHY search:** client-side GIF search/trending when `VITE_GIPHY_API_KEY` is available from `.env`. Requests are debounced and limited to 12 results, with G-rated filtering and smaller WebP renditions where possible. A "Powered by GIPHY" label accompanies search results. GIPHY and original local assets are kept in separate sections.

GIPHY integration details: https://developers.giphy.com/docs/api/ . API beta keys are rate-limited (currently 100 calls per hour). Follow GIPHY's terms: search from client-side, do not download or redistribute GIPHY GIFs as a local collection, and retain required attribution. `VITE_` keys are exposed in browser bundles; use a limited-use Web key, never a private password or unrelated secret. The local `.env` is intentionally ignored by Git.

On the server, GIF message validation explicitly permits same-origin `/gifs/<slug>.gif` assets or HTTPS GIPHY media links and rejects arbitrary third-party hosts. Local content is NOT written to the database.

`npm run test:gifs` uses two simulated phones to check the UI fallback, online search visibility, local GIF loading and delivery, and mobile overflow. It requires `npm run dev` in a separate terminal.
