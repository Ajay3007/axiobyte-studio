I already have a working Three.js + Vite project called `nic-3d`.

IMPORTANT: DO NOT rebuild the NIC model from scratch.

The existing project already contains a polished 3D NIC with:
- Overview
- Front
- Top
- Rear
- PCIe camera views
- Component interactions
- Component information panels
- Heatsink lift interaction
- NIC controller
- RJ45 ports
- Magnetics
- PCIe connector
- RX/TX queue visualization
- `__AXIOBYTE__.demoRx()`
- `__AXIOBYTE__.demoTx()`

I now want to turn this existing interactive 3D NIC into a professional **16:9 YouTube educational video** explaining:

# "What Is a NIC?"

I have these files in the project:

- `nic-video-script.md` → complete narration/script + visual directions
- `voiceover.mpeg` → actual recorded voiceover
- `timeline.json` → word-level/phrase-level timestamps for synchronizing visuals

The video should use the existing `nic-3d` codebase as the 3D engine and build a new **timeline-driven video presentation/rendering system around it**.

==================================================
CORE REQUIREMENT
==================================================

DO NOT treat this as a screen recording of the existing website.

I want a professionally composed technical animation/video.

Think:

Existing Three.js NIC
        ↓
Video Director
        ↓
timeline.json
        ↓
Camera choreography
        ↓
Component highlights
        ↓
Technical diagrams
        ↓
Packet animations
        ↓
Callouts / labels
        ↓
1920 × 1080
        ↓
Final MP4 + voiceover

The final result should feel like a premium engineering/technology YouTube video, not a website demo.

==================================================
1. FIRST: INSPECT THE EXISTING PROJECT
==================================================

Before writing new code:

1. Inspect the full `nic-3d` repository.
2. Understand its architecture.
3. Find:
   - scene initialization
   - camera setup
   - camera presets
   - component IDs
   - raycasting
   - component highlight system
   - heatsink animation
   - RX animation
   - TX animation
   - existing public APIs
   - existing UI
4. Specifically locate and understand:
   - `__AXIOBYTE__.demoRx()`
   - `__AXIOBYTE__.demoTx()`
5. Identify the best way to programmatically control:
   - camera
   - component focus
   - highlighting
   - heatsink
   - RX/TX animations

DO NOT duplicate existing functionality.

Reuse the existing scene, geometry, materials and APIs wherever possible.

==================================================
2. READ THE THREE VIDEO INPUTS
==================================================

Read and analyze:

`nic-video-script.md`
`timeline.json`
`voiceover.mpeg`

The markdown is the storytelling specification.

The voiceover is the actual audio.

The timeline is the synchronization source.

IMPORTANT:

The timestamps written in the markdown may not exactly match the actual 11-minute voiceover.

Therefore:

VOICEOVER + timeline.json are the MASTER TIMING SOURCE.

Do not assume the markdown section times are exact.

Determine:

- actual audio duration
- timeline duration
- section boundaries
- word/phrase timestamps
- important technical terms

Then generate the video from those timings.

==================================================
3. KEEP THE EXISTING WEBSITE WORKING
==================================================

Do NOT break the current interactive NIC demo.

Create two modes:

INTERACTIVE MODE
- mouse interaction
- OrbitControls
- buttons
- hover
- click
- normal UI

VIDEO MODE
- timeline driven
- deterministic camera
- no mouse interaction
- no website controls
- no cursor
- no browser-like UI
- automated camera movement
- automated component highlighting
- automated packet animation
- technical callouts
- cinematic transitions

Use something like:

`APP_MODE = "interactive"`

and:

`APP_MODE = "video"`

or a better equivalent.

Both modes must use the SAME NIC 3D model.

==================================================
4. VIDEO FORMAT
==================================================

The final video must be:

1920 × 1080
16:9
30 FPS
H.264
AAC audio

Target output:

`final/nic-video.mp4`

The composition must be designed intentionally for 16:9.

Do NOT simply render the current webpage and crop it.

==================================================
5. VIDEO SHOULD BE TIMELINE-DRIVEN
==================================================

Create a dedicated video system.

Suggested architecture:

src/video/
    VideoDirector.js
    TimelineParser.js
    SceneTimeline.js
    CameraDirector.js
    AnimationDirector.js
    CalloutManager.js
    DiagramManager.js
    CaptionManager.js
    TransitionManager.js
    VideoRenderer.js

You may improve this structure if you have a better architecture.

The important thing is separation of concerns.

Conceptually:

timeline.json
    ↓
TimelineParser
    ↓
VideoDirector
    ├── CameraDirector
    ├── AnimationDirector
    ├── CalloutManager
    ├── DiagramManager
    └── CaptionManager
    ↓
Three.js Scene
    ↓
Frame Renderer
    ↓
FFmpeg
    ↓
MP4 + voiceover

==================================================
6. AUDIO IS THE MASTER CLOCK
==================================================

This is extremely important.

Use:

`voiceover.mpeg`

as the master audio track.

Use:

`timeline.json`

to determine visual timing.

Do NOT use realtime randomness or `Date.now()` for animation timing.

Everything should be driven by a deterministic:

`currentVideoTime`

For example:

```js
videoDirector.update(time);
sceneDirector.update(time);
renderer.render(scene, camera);

The same timestamp must always produce the same frame.

This is required for deterministic rendering.

==================================================
7. WORD TIMELINE USAGE

Do NOT animate on every single word.

Instead use the word-level timeline to detect meaningful phrases/concepts.

Examples:

NIC
Ethernet
PCB
RJ45
magnetics
PHY
controller
heatsink
PCIe
RSS
RX queue
DMA
descriptor ring
DPDK
mempool
rte_eth_rx_burst()
rte_eth_tx_burst()
polling
hardware offload

When these concepts are spoken, trigger relevant visuals.

Example:

Voice says:
"PCIe"

Visual:
smooth camera transition toward PCIe connector.

Voice says:
"DMA"

Visual:
animate data movement from NIC toward host memory.

Voice says:
"RSS"

Visual:
show packet → hash → RX queue selection.

Do NOT change the entire screen for every noun.

Visual changes should feel intentional and cinematic.

==================================================
8. FOLLOW THE STORY IN nic-video-script.md

Use the script's conceptual structure:

Cold open
What is a NIC?
Anatomy of the card
PCB
RJ45 ports
magnetics
PHY
controller
heatsink
PCIe connector
bracket
What is it actually for?
How a packet is received
How a packet is transmitted
Why this design exists
Where NICs are used
Outro

Do not substantially rewrite the narration.

The voiceover is already recorded.

The visuals must adapt to the narration.

==================================================
9. REMOVE WEB UI IN VIDEO MODE

The current frontend contains things such as:

Overview
Front
Top
Rear
PCIe
Hardware mode
Packet flow
Reset camera

These are useful for the interactive website but should NOT appear in the final YouTube video.

In VIDEO MODE:

Hide:

navigation controls
reset button
mode buttons
developer controls
interactive panels
cursor
browser-like UI

Keep only deliberately designed educational overlays.

==================================================
10. CINEMATIC VISUAL STYLE

The NIC is the hero.

Use:

slow camera movement
controlled push-ins
smooth pans
realistic depth
subtle lighting changes
clean highlights
technical overlays
restrained motion graphics
smooth easing
professional typography

Avoid:

constant spinning
random motion
flashy transitions
gaming-style effects
excessive particles
excessive text
clutter

The visual language should feel like:

"professional engineering documentary"

==================================================
11. INTRO / COLD OPEN

Use the existing Overview camera.

Start with the NIC visible and breathing on screen.

Allow the model to remain on screen briefly before introducing large text.

Then introduce:

WHAT IS A NIC?

Use a polished title animation.

Do not use generic presentation-style title cards.

==================================================
12. PCB SECTION

Use existing Top view.

Show the PCB in detail.

When the narration explains PCB traces:

slowly move the camera over the board
highlight relevant traces
subtly illuminate trace groups
show the relationship between components and signal paths

Do not light up every trace at once.

==================================================
13. RJ45 SECTION

Focus on:

rj45-1

Then:

rj45-2

Use:

smooth camera push
component highlight
LED animation
subtle callout
visible port internals if the existing model supports it

The result should feel like a macro camera shot of real hardware.

==================================================
14. MAGNETICS SECTION

Focus on:

magnetics-1

Create a clean visual explanation:

Ethernet cable
↓
Magnetics
↓
PHY

Highlight the transformer package.

Use the actual existing component if available.

==================================================
15. PHY SECTION

This is an important visual moment.

Use the existing:

toggle-heatsink

or the project's equivalent API.

Sequence:

NIC
↓
heatsink lifts
↓
camera pushes in
↓
PHY revealed
↓
PHY highlighted
↓
hold
↓
heatsink returns

Use cinematic easing.

Do not make the heatsink instantly teleport.

==================================================
16. CONTROLLER SECTION

Focus on:

nic-controller

Show a technical callout such as:

NIC CONTROLLER

Then progressively introduce the concepts being discussed:

checksum
RX queues
DMA
hardware offloads

Do not show everything simultaneously.

==================================================
17. HEATSINK SECTION

Show an angled macro view of the heatsink.

Highlight:

fins
base
mounting mechanism
relation to PHY

Keep the animation subtle.

==================================================
18. PCIe SECTION

Use the existing PCIe camera preset.

Focus on:

pcie-connector

Highlight the gold edge contacts.

Then transition naturally from:

physical PCIe connector

into:

PCIe data movement

This should set up the packet flow section.

==================================================
19. RECEIVE PACKET FLOW

THIS IS THE MOST IMPORTANT SECTION OF THE VIDEO.

Use the existing:

__AXIOBYTE__.demoRx()

Do not replace the existing RX implementation unless absolutely necessary.

The visual flow should be:

Cable
↓
RJ45
↓
Magnetics
↓
PHY
↓
NIC Controller
↓
RSS
↓
RX Queue
↓
DMA
↓
PCIe
↓
Descriptor Ring
↓
DPDK
↓
Mempool
↓
Application

The packet should move through this route while the narration explains each stage.

==================================================
20. PACKET VISUALIZATION

Create a professional packet representation.

Use a glowing but restrained packet object with:

subtle glow
motion trail
directional movement
controlled speed

Avoid making it look like a cartoon game.

The packet must be clearly visible against the NIC.

==================================================
21. RX STEP-BY-STEP

When narration reaches cable:

Show packet entering from Ethernet side.

When narration reaches RJ45:

Move packet into RJ45.

When narration reaches magnetics:

Pass through magnetics.

When narration reaches PHY:

Move to PHY.

When narration reaches controller:

Highlight controller.

When narration explains RSS:

show packet → hash → queue selection.

When narration explains DMA:

show NIC controller directly writing to host memory.

When narration explains PCIe:

show movement across PCIe.

When narration explains descriptor ring:

show the descriptor becoming complete.

When narration explains DPDK:

transition into a hybrid physical + software representation.

==================================================
22. RSS VISUALIZATION

Create a concise educational animation:

Incoming Packet
↓
Packet Header
↓
Hash
↓
RX Queue

Then show multiple queues:

Queue 0
Queue 1
Queue 2
Queue 3
...
Queue N

Highlight the selected queue.

If appropriate, briefly show:

source IP
destination IP
source port
destination port

But do not cover the screen with text.

==================================================
23. DMA VISUALIZATION

When DMA is discussed, make the concept visually obvious.

Show:

NIC Controller
|
| DMA
↓
Host RAM

The CPU should NOT appear to be copying the packet.

Visually reinforce:

NIC → RAM

rather than:

NIC → CPU → RAM

Make "DMA" a clear visual anchor.

==================================================
24. PCIe DATA MOVEMENT

During PCIe explanation:

highlight the PCIe connector
animate packet crossing the connector
optionally show lane activity
make the physical connector visually connect to the memory path

Keep it technically understandable.

==================================================
25. DESCRIPTOR RING

Create an attractive descriptor ring visualization.

Represent it as a circular structure.

Example concept:

FREE
↓
DMA WRITING
↓
DONE
↓
CONSUMED

Show individual descriptors changing state.

Keep the diagram animated and synchronized with the narration.

==================================================
26. DPDK SECTION

When narration reaches DPDK, transition from the physical NIC into:

NIC
↓
PCIe
↓
RX Queue
↓
Descriptor Ring
↓
DPDK Worker
↓
Application

Show:

rte_eth_rx_burst()

as a small code-style callout.

Also show:

mbuf

and:

mempool

visually.

Do not turn this into a full code tutorial.

The goal is conceptual understanding.

==================================================
27. NO INTERRUPT / NO COPY MOMENT

When narration says:

"No interrupt"
"No context switch"
"No extra copy"

make this visually memorable.

Show these three phrases sequentially.

Then show the packet arriving in application-accessible memory.

Keep the animation elegant.

==================================================
28. TRANSMIT FLOW

When narration reaches transmit:

Call:

__AXIOBYTE__.demoTx()

Use a reverse packet path:

Application
↓
TX descriptor
↓
Doorbell
↓
NIC Controller
↓
DMA READ
↓
PHY
↓
RJ45
↓
Cable

Use visually distinct but consistent treatment from RX.

==================================================
29. DOORBELL VISUALIZATION

When narration mentions the doorbell register:

Show:

TX Queue
↓
New Descriptor
↓
Doorbell
↓
NIC Controller

Add a subtle pulse on the doorbell event.

==================================================
30. RX VS TX COMPARISON

Near the end of the transmit section show the symmetry:

RX:
Cable → NIC → DMA → Memory → Application

TX:
Application → Memory → DMA → NIC → Cable

This should be a clean visual comparison.

==================================================
31. PERFORMANCE RECAP

The recap should visually introduce:

RSS
DMA
Polling
Hardware Offload

Each concept should get a short visual explanation.

Examples:

RSS:
one NIC
→ multiple RX queues
→ multiple workers

DMA:
NIC → RAM

Polling:
worker continuously checks RX ring

Hardware Offload:
CPU work
→ NIC silicon

Do not overload the screen.

==================================================
32. FINAL ARCHITECTURE

Near the end create a clean synthesis of the complete system:

APPLICATION
↓
DPDK / mbufs
↓
RX / TX QUEUES
↓
DMA
↓
NIC CONTROLLER
↓
PHY
↓
RJ45
↓
CABLE

This can be either:

a clean animated diagram
or a hybrid with the 3D NIC

Prefer the hybrid if it looks good.

==================================================
33. CALLOUT SYSTEM

Create a reusable educational callout system.

Example:

showCallout({
    title: "DMA",
    subtitle: "Direct Memory Access"
});

Callouts must:

animate smoothly
use the same AxioByte visual language
not cover the important hardware
appear only when relevant
disappear cleanly

Use short technical labels, not paragraphs.

==================================================
34. SECTION TITLES

Use subtle section title animations such as:

WHAT IS A NIC?

ANATOMY OF THE CARD

HOW A PACKET IS RECEIVED

HOW A PACKET IS TRANSMITTED

WHY THIS DESIGN IS FAST

Do not let title cards dominate the video.

==================================================
35. CAMERA SYSTEM

Create a Video Camera Director capable of:

focus on component
move to preset
smooth zoom
orbit
pan
dolly
camera transition

The camera should never suddenly teleport unless hidden by a transition.

Example:

Overview
↓
slow push
↓
RJ45
↓
Magnetics
↓
PHY

Use easing such as:

easeInOutCubic

or another smooth easing function.

==================================================
36. VIDEO TIMELINE FORMAT

Create a clean action model.

For example:

{
    start: 72.3,
    end: 81.6,

    action: "focus",

    target: "nic-controller",

    callout: {
        title: "NIC Controller",
        subtitle: "Packet processing and queue management"
    }
}

or:

{
    start: 120.0,
    action: "rx-flow"
}

or:

{
    start: 250.0,
    action: "camera",
    preset: "pcie"
}

Adapt this to the real timeline.

==================================================
37. DEBUG MODE

Create a development-only timeline debug overlay.

Show:

TIME: 04:32.25
SECTION: PHY
ACTION: Lift heatsink
CONCEPT: PHY

Allow:

play
pause
seek
step forward
step backward
jump to timestamp

This will make iteration much easier.

The debug overlay must not appear in the final video.

==================================================
38. RENDERING PIPELINE

I need a deterministic rendering pipeline.

Preferred flow:

timeline.json
↓
VideoDirector
↓
Three.js scene
↓
frame rendering
↓
FFmpeg
↓
voiceover.mpeg
↓
final MP4

Provide an easy command such as:

npm run render

or:

npm run video

The exact implementation is your choice.

The important thing is that I should be able to generate the complete video without manually clicking through the website.

==================================================
39. FFmpeg

Use FFmpeg where appropriate for:

frame sequence → MP4
audio muxing
final encoding
optional audio normalization

Final output:

final/nic-video.mp4

Format:

1920×1080
30 FPS
H.264
AAC

==================================================
40. VIDEO FRAME DETERMINISM

Do not depend on realtime animation.

BAD:

Date.now()

GOOD:

videoDirector.update(currentVideoTime);

Given the same:

currentVideoTime

the scene should produce the same visual state.

This is essential for frame rendering.

==================================================
41. DO NOT REIMPLEMENT EXISTING NIC FEATURES

Reuse the existing project's:

camera presets
component IDs
highlight system
heatsink API
RX animation
TX animation
metadata

For example:

videoDirector.playAction("demoRx");

should call the existing RX implementation internally.

Do not create a duplicate RX animation system unless the existing one cannot support deterministic timeline control.

==================================================
42. 16:9 SAFE COMPOSITION

All visual content must be composed for:

1920×1080.

Keep important content away from:

extreme edges
corners
title-safe regions
YouTube UI areas

Callouts must not cover the NIC itself.

When using diagrams, reserve enough horizontal space.

==================================================
43. IMPORTANT TECHNICAL STORYTELLING RULE

The video should progressively move from:

PHYSICAL HARDWARE

to:

PACKET PATH

to:

HOST MEMORY

to:

DPDK

to:

HIGH-PERFORMANCE DATAPLANE

The viewer should feel that the video is going deeper into the system as it progresses.

Do not start with complex DPDK concepts too early.

==================================================
44. DO NOT INVENT FACTS

Use the supplied nic-video-script.md as the factual/storytelling source.

Do not invent unrelated hardware specifications.

Do not pretend the visual model represents a specific commercial NIC unless the source explicitly says so.

Where the model is conceptual, keep labels generic.

==================================================
45. DO NOT MODIFY THE VOICEOVER

Do not rewrite, shorten, or reorder the recorded narration.

The visuals must adapt to the existing audio.

Do not change playback speed to make synchronization easier.

==================================================
46. DEVELOPMENT STRATEGY

Do NOT immediately render the complete 11-minute video.

First build:

Preview A:
0:00 → 0:30

Then:

Preview B:
~7:15 → ~8:30

The second preview is especially important because it contains:

packet flow
RSS
DMA
PCIe
RX queues
descriptor ring
DPDK

Once these sections work visually, extend the system to the full video.

==================================================
47. QUALITY BAR

The final result should look like:

"An engineering animation built with Three.js"

NOT:

"A website screen recording"

Prioritize:

storytelling
technical clarity
camera choreography
synchronization
realistic hardware
clean typography
smooth transitions
visual consistency
==================================================
48. FINAL DELIVERABLES

Deliver:

Modified nic-3d project
Video mode
Timeline parser
Video Director
Camera Director
Animation Director
Callout system
Educational diagram system
Debug timeline mode
Deterministic frame rendering
FFmpeg integration
Final MP4 rendering command
README-video.md

README must explain:

npm install
npm run dev
npm run render

and how the video timeline works.

==================================================
49. FINAL VALIDATION

Before declaring complete, verify:

[ ] Existing interactive NIC demo still works
[ ] Video mode works
[ ] 16:9 output
[ ] 1920×1080
[ ] 30 FPS
[ ] Actual voiceover is used
[ ] timeline.json controls the visuals
[ ] audio/video synchronization is correct
[ ] camera movement is smooth
[ ] component focus works
[ ] heatsink lift works
[ ] RX animation works
[ ] TX animation works
[ ] RSS animation works
[ ] DMA animation works
[ ] PCIe animation works
[ ] descriptor ring animation works
[ ] DPDK visual explanation works
[ ] callouts are readable
[ ] no website UI in final video
[ ] no cursor
[ ] no browser chrome
[ ] deterministic rendering
[ ] final MP4 generation works
[ ] video duration matches voiceover
[ ] no runtime errors

==================================================
50. FINAL MENTAL MODEL

Think of the project as four layers:

VOICEOVER
↓
TIMELINE.JSON
↓
VIDEO DIRECTOR
↓
THREE.JS NIC ENGINE

The:

voiceover.mpeg

is the audio.

The:

timeline.json

is the timing/animation score.

The:

nic-video-script.md

is the narrative/storyboard.

The existing:

nic-3d

is the 3D hardware engine.

Combine all four into a polished, educational, cinematic 16:9 YouTube video.

IMPORTANT:
Before implementing anything substantial, inspect the existing codebase and understand how its current camera, component and animation systems work. Reuse them rather than replacing them.
