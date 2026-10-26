# Blender character development — 26 October 2026

The supplied chibi turnaround sheet guided the two reusable, skinned characters. These are an interpretation of its low-poly design, with editable geometry and animation; the screenshots are renders of the actual exported models.

Current assets contain 29 clips per character, including VictoryDance, Walk, six first-person RPS clips and a full-body RPS pump. Earlier 20-clip, 22-clip and 40-playback results below describe previous revisions.

## Live RPS chant and pause

The match uses one server clock for the five-second choice timer, a short ready interval, two 900 ms **Bato!** beats and the final **Pick!** reveal. The center word changes on each beat. A synthesized drum pulse marks each word, with a stronger final hit; the overlay includes a sound toggle. Both editable Blender characters now contain `POVPump` and `RPSPump` clips. The player hand and opponent pump down and rise on each Bato beat, then throw and land on the selected sign at Pick. The arena view uses the same beat timing.

**Back to chat** pauses the shared match. The remaining player sees a notification at the top explaining that their partner is outside the game. Both players can return, and the current timer, chant or reveal resumes from its paused point. A full first-to-three two-browser check verifies each displayed word, hand action, pause, return, scores and final sign. The GLB validator reports 29 clips per character and zero warnings.

The two views now render one persistent 3D scene. The player and partner stand on opposite podiums facing each other; First-person uses the player's eye camera and Arena uses a side camera. Switching views preserves the same canvas, opponent, stage and active animation. Large vector rock, paper and scissors symbols float above the heads without cards or names: your selection appears locally, and both selections appear after Pick. The previous isolated first-person scene source is preserved in `backups/before-shared-rps-camera-20261027/`. At match end, either player can request a rematch. The requester waits for the partner to accept; if both accept within 10 seconds, a new match starts with the same target score. An unanswered request closes the game for both players and shows a chat notification.

## First-person Rock Paper Scissors throw preview

Open `http://127.0.0.1:5176/assets/characters/first-person-rps.html`, or choose **First-person throw** from the character studio's View selector. Choose Rock, Paper or Scissors, then press Throw. The sequence winds up for 0.40 seconds, throws for 0.80 seconds, blends into the selected hand formation and holds it until another throw or reset. Both character options are available. Drag the scene to look; keys 1/2/3 select a hand and Space throws when focus is outside a control.

The editable Blender sources and GLBs add `POVReady`, `POVThrow`, `POVRock`, `POVPaper` and `POVScissors`. The hand pose was revised using the supplied three-hand reference: the open left hand sits low at the left edge, while the right hand reaches toward the center with its fingers aligned to the forearm. Both palms face the ground through the throw and held signs. A two-bone solve keeps the connected arms at their real lengths. The close-up shows both complete arms and hands against a light background, with the torso and head outside the rendered mesh. The camera keeps a level horizon, stable eye height and a closer view of the gestures. The existing first-person arm offsets are skipped for these authored clips. This local browser preview loads the character GLB for reviewing the animation separately from multiplayer match rendering.

`test-first-person-rps.mjs` passes all three choices for both characters at 390×844, 320×568 and 1024×768. The report `validation/first-person-rps.json` verifies each transition, repeated throws, held outcomes, finger formations, bounds of the actual skinned hand, hidden self head, camera stability, controls outside the canvas, keyboard input, drag looking, asset loading and browser errors. Matching `pov-rps-*.png` captures show the rendered poses. The existing walking controller also passes a 390px walk/stop regression for both characters. Production build and glTF validation pass; each character has 27 clips and zero validator errors or warnings.

The live Rock Paper Scissors match now starts in first-person view, with the partner character ahead of the player's hands. The server's reveal starts the authored local throw and the opponent's throw together; the local pose follows the round clock so a slow frame rate does not delay the held sign beyond the reveal. Players can switch to the existing arena view at any point. A complete first-to-three browser match verified the first-person Rock and Scissors reveals, result and score synchronization, and the arena switch; the 320px and 390px two-player checks also passed.

The match now opens as a full-viewport game. First-person/Arena switching, score, round status, and Rock/Paper/Scissors choices are overlays inside the 3D scene. **Back to chat** minimizes the view without ending the server match; a visible **Return to game** control restores it. The full first-to-three browser check exercises this navigation during an active match. The opponent scales down on short phone screens so the top controls leave the face visible.

Original meshes and all 22 prior clips, including the revised dance, compare byte-for-byte with `archive/before-pov-rps-20261026/`. That archive also preserves the preceding editable sources and runtime files.

## Natural victory dance — gesture-reference revision

The supplied dance gesture sheet guided a new four-second VictoryDance for both characters. Two mirrored phrases replace the previous uniform side-step loop: load the supporting leg, raise the opposite knee with a diagonal fist, settle, gather into a crouch, make a small hop, and absorb the landing. The reference's raised-arm silhouettes are adapted to the characters' short arms and large heads. The torso, elbow, wrist and head reach their accents at different times. Shape-preserving motion curves carry momentum through intermediate poses; foot lift curves meet the ground with zero velocity and acceleration.

Both editable `.blend` sources and application GLBs contain the revised action. The mesh data and all 21 other clips per character were compared byte-for-byte against `assets/characters/archive/before-natural-dance-20261026/` and are unchanged.

`test-dance.mjs` samples each exported dance at 241 times, checks loop continuity, joint rotation steps, planted feet, actual skinned shoe clearance, knee lifts, weight transfer, raised hands and airborne frames, and captures front and three-quarter views. Maximum planted-foot drift is below 0.0006 model units; shoes stay above the floor. Both GLBs validate with 22 clips and zero errors or warnings. The production build and the two-client 390px RPS/Henyo integration check pass, including continued winner dancing after a complete three-round match.

Preview the motion locally at `http://127.0.0.1:5176/assets/characters/review.html?action=VictoryDance`. `previews/victory-dance.gif` and `previews/natural-dance-key-poses.png` are made from actual rendered frames. `capture-dance-video.mjs` captures 120 frames at 30 fps; `compose_dance_video.py` uses PyAV and Pillow to encode `previews/victory-dance.mp4` as two complete loops (eight seconds, 720×720, H.264). Set `C2P_BASE_URL` to change the local preview host. The earlier victory-dance section below documents the superseded eight-beat choreography. Physical phone performance has not been measured.

## First-person walking revision

Open `/assets/characters/first-person.html` on the local development or isolated production preview. The character studio's View selector also opens it. Choose the pink or blue character, use WASD / arrows or the mobile movement pad, and drag the scene to look. Look down reveals the actual connected torso, arms, hands, legs and shoes. Look ahead restores the normal forward perspective. Walk toggles continuous movement; Reset stops and returns to the starting position. Optional query parameters are `character=female|male`, `look=down` and `walk=1`.

The eye camera follows the skinned character, with a small smoothed walking sway and no camera roll. Reduced-motion settings remove the camera bob. Looking down adjusts the forward lean and field of view to fit the chibi proportions across portrait and landscape screens. Only the self head and neck triangles are hidden using a separate index buffer; there are no world-height clipping planes cutting the body. Both hands remain attached to the same skeleton. Movement follows the look direction, diagonal speed is normalized, reverse walking reverses the clip, and animation playback follows actual travel. Courtyard benches, posts and outer walls block movement.

The new Walk clip lasts 1.2 seconds and is authored for 0.9 model units per second. Alternating foot stance, swing lift, arm swings, hip sway and chest/head counter-motion are baked into both editable Blender sources and GLBs. `walk-animation.json` verifies both exports: planted-foot drift below 0.0006 units, zero positional loop error, foot lift of 0.10 units and smooth joint rotation.

Henyo also uses the complete self body with the head/neck mask. Its self model now matches the eye height and shows the legs and feet over a local floor when looking down. The seated hip override prevents standing foot corrections from sinking the seated body. Forward opponent framing, secret-word handling and remote head synchronization are retained.

`first-person-browser.json` passes both characters at 320×568, 390×844, 768×1024 and 1024×768. It verifies retained body parts, hidden self head, downward framing, walk/idle transitions, keyboard movement, drag looking, movement-pad release, wall stopping and no horizontal overflow. Matching screenshots and 64 continuous WebGL capture frames are under `assets/characters/validation/`. `first-person-walking.gif` and `first-person-views.png` in previews are made from those real captures. Both GLBs validate with 22 clips and zero errors or warnings. The production build includes the studio and walking page as separate entry points. Prior sources, runtime files and exports are preserved under `assets/characters/archive/before-first-person-walk/`.

Reproduce with `node scripts/characters/test-walk.mjs`, `node scripts/characters/test-first-person.mjs`, and `python scripts/characters/compose_first_person.py`. The first-person browser test defaults to the isolated production preview on port 5176. Physical Android performance remains unmeasured.

The final `games-390-browser.json` passes a complete three-round RPS match with continued winner dancing, and Henyo with secret-word visibility and remote head synchronization. The browser test selects the visible mobile arena's choice buttons; the page also mounts a hidden desktop sidebar whose disabled buttons must not receive test input.

## Victory dance revision

Both rigs now include a four-second, eight-beat step/tap loop with alternating arm accents, hip shifts, chest/head counter-motion, knee bounces and the happy eye/mouth expression. A foot moves only during its swing phase; the supporting foot stays in place. Consistent limb orientation and continuous Euler angles prevent sudden turns between poses. The crouch keeps the leg solve within reach during the wide steps.

The RPS winner now dances after the hand reveal and continues looping after winning the match. Round clocks, scoring and server code are unchanged. The previous Celebrate arms-up action remains available separately.

The victory-dance.json report samples each exported character 129 times. It checks the exact four-second duration, coincident first/last positions, negligible loop rotation error, smooth joint motion, foot lift above 0.07 units, hip travel of 0.24 units and foot travel of about 0.36 units. Planted-foot drift is below 0.001 units. test-dance.mjs captures 64 actual rendered frames; compose_dance.py produces victory-dance.gif and victory-dance-poses.png in assets/characters/previews/.

The production build passed. The two-browser 390px test passed a complete first-to-three match, checked that the winner was still dancing after a complete loop, and passed Henyo again. Both assets validate with 21 named clips and zero errors or warnings. Previous editable sources and exports are preserved under assets/characters/archive/before-victory-dance/.

Open the studio with ?action=VictoryDance appended to its URL to start the dance immediately. Pause, Replay and the other actions remain available.

## Deliverables and phases

| Phase | Implementation | Files |
| --- | --- | --- |
| 1: female | Burgundy hair, two braids and gold ties, hair clip, pink puff sleeves, cream bib and straps, pocket star, purple trousers, five articulated digits on each hand, pink shoes with flat soles. Front, side, back and three-quarter renders were inspected before the male was built. | `assets/characters/source/female.blend`, `assets/characters/previews/female-*.png` |
| 2: male | Matching proportions and rig, dark hair, blue/purple cap with visor and badge, blue shirt, cream overalls, white shoes. Both characters were inspected together. | `assets/characters/source/male.blend`, `assets/characters/previews/male-*.png`, `assets/characters/previews/pair-web-Happy.png` |
| 3: animation | 38 bones, including two joints per digit; explicit normalized skin weights; Blink, Happy, Sad and Surprised morphs; 20 exported clips per character. | Blender sources, `scripts/characters/build_characters.py`, `assets/characters/validation/animation-browser.json` |
| 4: integration | GLTFLoader and independent AnimationMixers replace procedural avatars in RPS and Henyo. RPS uses finger gestures, throw, celebration, loss and the winner label. Henyo uses the same meshes for the other player and first-person body, exported nod/shake clips, facial expressions, synchronized gaze and the secret word card. | `public/models/characters/{female,male}.glb`, `src/CharacterActor.ts`, `src/RpsScene3D.tsx`, `src/ForeheadScene.tsx` |
| 5: verification | Production build; glTF validation; real Three.js clip playback; visual screenshots; semantic pose checks; resource disposal; two browser sessions at phone, portrait tablet and landscape sizes. | `scripts/characters/{check-models,capture-review,test-games}.mjs`, `assets/characters/validation/` |

## Model budget

| Asset | Triangles | Bones | Materials / character draw calls | GLB size |
| --- | ---: | ---: | ---: | ---: |
| Female | 7,472 | 38 | 1 / 1 | about 2.09 MB |
| Male | 6,700 | 38 | 1 / 1 | about 1.95 MB |

Vertex colors carry the palette, so the GLBs do not request external textures. Both assets have one skinned mesh and four sparse facial morph targets. The glTF validator reports zero errors and zero warnings. The full decoded geometry arrays for the pair total 4,225,688 bytes; this excludes skeleton textures, renderer overhead and other game assets.

The review scene uses five draw calls including its ground and two contact shadows. RPS measured 36 draw calls including the entire stage and result effects. Henyo counts vary with camera framing because the studio is culled. The application retains its existing 30 fps RPS / 28 fps Henyo rendering caps and modest pixel ratio.

## Animation library

`Idle`, `Walk`, `Blink`, `Happy`, `Sad`, `Surprised`, `Celebrate`, `VictoryDance`, `NodYes`, `ShakeNo`, `LookLeft`, `LookRight`, `Sit`, `Stand`, `RaiseArms`, `LowerArms`, `RPSAnticipation`, `Rock`, `Paper`, `Scissors`, `Throw`, `Lose`.

The runtime blends poses over 180 ms, with 400 ms transitions for sitting and standing. Idle, facial states, anticipation, held hand gestures and celebration loop with supporting body motion. Nod, shake, throw, raising arms and lowering arms play once and hold their final pose. Facial animation channels are merged into their matching bone clips in the GLB. Each .blend contains separately named bone and face actions on matching, initially muted NLA tracks; unmute the matching tracks to preview them in Blender, or choose an action and adjust the facial shape keys.

## Visual and playback corrections made during iteration

- Reset the exporter's last evaluated expression before saving/rendering the neutral character.
- Fit the fringe to the head curvature and tuck male upper hair inside the cap.
- Give the shoes broad, flat soles with ground contact.
- Replace mirrored Euler arm poses with armature-space aiming, so the celebration clears the torso.
- Turn the RPS hand toward the viewer and separate the scissors fingertips instead of converging them.
- Restore the sampled animation pose before gaze/blink overlays, preventing cumulative rotation and permanently closed eyes on constant clips.
- Use the vertical bone axis for left/right looking and the NO shake.
- Match outgoing head-pose angles to the existing server's bounds while preserving the wider first-person camera movement.
- Fit the RPS camera to the viewport and reserve room above the head for the winner label.
- Move the forehead card in front of the male cap visor to prevent geometry crossing its text.

## Tests and evidence

- `female-gltf.json` and `male-gltf.json`: format validation, 20 named clips, 38 joints, vertex colors, four morph targets and triangle budgets.
- `animation-browser.json`: actual GLTFLoader playback of all 40 clips; finite joint transforms; raised wrists above shoulders; separated scissors fingers; eye closure and reopening; head-turn stability and direction.
- The same report checks three repeated load/dispose cycles. Renderer geometry and texture counts return to their original values after every cycle.
- `games-browser.json`: two independent clients at 320×568, 390×844, 768×1024 and 1024×768; chat relay, RPS win/loss and a complete first-to-three match, Henyo secrecy, first-person looking down, head synchronization and layout overflow checks.
- `games-henyo-browser.json`: all four sizes passed again after the final word-card placement correction.
- Matching PNGs in `assets/characters/validation/` show the actual game screens. Earlier failure PNGs are retained as debugging history; use the JSON reports for the final test results.
- Production command: `npm run build -- --outDir dist-character-preview` (frontend and backend type checks plus Vite). Existing chunk-size advisories remain; there are no build errors.
- Existing Pong physics smoke checks passed. The existing two-browser Pong check also passed at 390×844.

Testing used desktop Edge with software WebGL and mobile viewport emulation. This verifies browser integration and resource budgets, but does not establish frame rate or thermal behavior on a physical Android phone. Real-device profiling and subjective approval of the likeness remain the next review steps.

## Local review and reproduction

The character studio is at `http://127.0.0.1:5174/assets/characters/review.html` while its Vite server is running. It provides character, view and animation selectors, pause, sitting and hand close-ups.

The isolated production preview is at `http://127.0.0.1:5176/`, connected to a separate instance of the unchanged server on port 3011. `scripts/characters/vite.preview.config.ts` contains that test-only routing. The existing public server and `dist/` directory were not replaced.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/characters/build_characters.py -- --character female --render
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/characters/build_characters.py -- --character male --render
npm install --prefix scripts/characters/validation-tools
node scripts/characters/check-models.mjs
node scripts/characters/capture-review.mjs
$env:C2P_BASE_URL='http://127.0.0.1:5176/'
node scripts/characters/test-games.mjs
```

The authoring script is deterministic and rebuilds the mesh, skeleton, facial controls, actions, source file and GLB. `--render` additionally produces the four Blender studio views. Runtime verification uses the exported GLB, rather than trusting the Blender source alone.

Original modified scene files were copied to `backups/before-blender-20261026/src/`. No scoring, timers, matching, chat or backend game logic was changed. No public deployment was performed.


## Revision: coordinated body motion, supplied hand formations, expression mouths

The follow-up changes apply to both editable Blender sources and both GLB exports. Arm gestures now include pelvis shifts, spine/chest rotation, head counter-motion, movement of the other arm, and knee flexion. A two-bone leg solve is baked into the standing clips to keep the feet in place. Seated playback keeps the supporting upper-body movement and restores the seated foot orientation.

The hand reference supplied in the follow-up is implemented as a closed fist with an opposing thumb, a five-finger open palm, and a two-finger V with ring/pinky folded and the thumb crossing them. Digit targets use the palm frame so the finger segments keep consistent roll and do not twist at the joints.

The neutral mouth is now a small smile. Happy uses a wider opening and tongue, Sad/Lose use a frown with worried eyes/brows, and the new Surprised clip uses a round mouth and raised eyebrows. The mouth contours are authored independently, sharing one mesh and morph topology.

`whole-body-motion.json` validates both characters: body motion during gestures, planted-foot stability, fingertip formation, and distinct mouth bounds. The maximum sampled foot drift is below 0.001 model units. `whole-body-motion.gif` shows exported Three.js playback, and `hands-and-expressions.png` shows the actual hand and face close-ups. These are in `assets/characters/previews/`.

Prior sources and GLBs are preserved in `assets/characters/archive/before-body-motion/`.

The final open-mouth surfaces use matched contour strips to keep their normals consistent when morphing. The production preview passed another three-round RPS match and Henyo check at 390 pixels after this correction (`games-390-browser.json`). The character studio also includes Replay; switching expressions while paused updates the face immediately.
