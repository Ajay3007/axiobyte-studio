# What Is a NIC? — Voiceover Script

**Video:** A full introduction to the Network Interface Card, from basics to DPDK-level internals
**Companion visual:** the AxioByte 3D NIC — `renderers/three/src/domains/networking/nic/`, interactive at `/axiobyte/networking/nic/`
**Estimated length:** ~14–16 minutes at a natural pace

Visual directions are in *[brackets]*. They map directly to the camera presets and console API in the build:
`Overview / Front / Top / Rear / PCIe`, clicking a part, `Lift heatsink`, and `__AXIOBYTE__.demoRx() / demoTx()`.

---

## 0. Cold open (0:00–0:30)

*[Start on Overview, slowly orbiting. No talking for the first 2 seconds — let the model breathe.]*

Every time you stream a video, join a call, or SSH into a server, a packet has to physically leave your computer and get onto a wire. The piece of hardware that makes that happen is one of the most overlooked parts of any machine — the network interface card, or NIC.

Today we're going to open one up. Not with a screwdriver — in 3D. We'll go from "what is this thing" all the way to how a packet actually moves through it, the same way a driver engineer would explain it.

*[Cut to title card: "What Is a NIC?"]*

---

## 1. What is a NIC? (0:30–1:45)

*[Overview preset, full card visible.]*

A NIC — network interface card — is the hardware that connects a computer to a network. Your laptop's Wi-Fi chip is a NIC. The little RJ45 jack on the back of a desktop is a NIC. And the card we're looking at right now is a NIC built for servers: a PCIe expansion card with two copper Ethernet ports, designed to move packets in and out of a machine as fast as the network allows.

*[Slow pan along the length of the card.]*

Its job sounds simple: take bits off the wire and hand them to the operating system, and take data from the operating system and put it on the wire. But at ten gigabits per second, that's up to fourteen million packets a second, in each direction, with almost no time to think about any one of them. Everything about this card's design exists to make that possible.

So let's walk it, part by part.

---

## 2. Anatomy of the card (1:45–6:30)

### 2.1 The PCB (1:45–2:10)

*[Top preset.]*

This is the printed circuit board — the green backbone. It's not just a mounting surface; it's a signal path in its own right. Every trace you can see is a controlled-impedance track carrying either a differential signal pair or power. On a card like this, getting the trace lengths and spacing wrong is enough to corrupt data at these speeds — so the copper layout is engineered almost as carefully as the chips sitting on top of it.

### 2.2 The RJ45 ports (2:10–3:10)

*[Click rj45-1, let the info panel and zoom happen, then click rj45-2.]*

These are the two RJ45 jacks — the physical ports your Ethernet cable plugs into. Each one has eight gold contacts inside, wired to four twisted pairs in the cable. At 10 gigabits, this port uses all four pairs simultaneously, in both directions at once, encoding data as sixteen distinct voltage levels per symbol — a scheme called PAM-16. That's how you squeeze 10 gigabits down copper that was originally designed for one.

*[Point out the LEDs.]*

The two LEDs tell you what's happening electrically: green for link — a valid connection has been negotiated — and amber flickering for activity, meaning frames are actually moving.

### 2.3 The magnetics (3:10–3:45)

*[Focus in on one of the black transformer packages next to a port.]*

Right behind each port sits a pair of small transformers, sometimes called the magnetics. Their job isn't to boost the signal — it's isolation. They galvanically separate this card from the cable, so a ground fault or power surge on the network side can't reach the card or the rest of your machine. They also reject common-mode noise picked up along the cable. Unglamorous, but every wired Ethernet port has them.

### 2.4 The PHY (3:45–4:30)

*[Lift the heatsink.]*

Under the heatsink is the physical layer chip, or PHY. This is where the analog world meets the digital world. On receive, it takes the raw electrical waveform off the cable and, through fairly heavy digital signal processing — echo cancellation, cross-talk cancellation, error-correcting decoding — turns it back into clean bits. On transmit, it does the reverse: takes bits and shapes them into that same sixteen-level signal.

This chip runs hot, which is exactly why it's the one hiding under the heatsink and not out in the open air.

*[Lower the heatsink back down.]*

### 2.5 The controller (4:30–5:45)

*[Click nic-controller.]*

This is the brain of the card — the Ethernet controller, sometimes just called the MAC. Once the PHY hands it clean bits, the controller does the real networking work: it checks the frame's checksum, figures out which receive queue the packet should go into, and — critically — it talks to the host computer's memory directly over PCIe, without waiting for the CPU to babysit every packet.

It also runs offload logic — checksum calculation, segmentation for large packets, VLAN tagging — tasks that used to be pure CPU work, now done in silicon so the processor is free to run your application.

### 2.6 The heatsink (5:45–6:05)

*[Show heatsink from an angle.]*

A quick word on the heatsink: it's finned aluminum, clipped down with spring-loaded push pins so it applies constant pressure even as the board flexes slightly with heat. It's passive — no fan — so it depends entirely on airflow moving through the server chassis.

### 2.7 The PCIe edge connector and bracket (6:05–6:30)

*[PCIe preset.]*

And this gold comb at the end is the PCIe edge connector — eight lanes' worth of contacts. This is the card's only connection to the rest of the computer, and everything the controller does eventually funnels through here. We'll come back to it in a minute, because it's the key to how packets actually get to your software.

*[Rear preset, showing the bracket.]*

The metal bracket on the back simply anchors the card to the chassis and exposes the two ports through the case — mechanical, but it also grounds the port shields to the chassis.

---

## 3. What is it actually for? (6:30–7:15)

*[Overview preset.]*

So why does a server need a card like this instead of the cheap Ethernet port built into a motherboard? Three reasons: throughput, offload, and control. A dedicated NIC can push far more traffic than an onboard controller, it takes real work off the CPU through those offloads we just mentioned, and — for the kind of software this card is built for — it can be driven directly by an application instead of the operating system's general-purpose network stack. That last point matters a lot, and it's where things get interesting. Let's follow an actual packet.

---

## 4. How a packet is received (7:15–11:30)

*[Front preset, then trigger `__AXIOBYTE__.demoRx()` and let the glowing packet run the route while narrating.]*

Let's trace one packet, start to finish, the way it happens for real.

**Step one — the cable.** A frame arrives as an electrical waveform on the twisted pairs.

**Step two — RJ45 and magnetics.** It enters the port, passes through the isolation transformers, and reaches the PHY.

**Step three — the PHY.** The PHY decodes the waveform back into clean digital bits and hands them off on a simple internal bus.

**Step four — the controller.** The controller checks the frame is valid, and here's the first real decision point: it decides which receive queue this packet belongs to. Modern NICs support multiple receive queues — often dozens per port — specifically so that traffic can be spread across multiple CPU cores. The mechanism that does the spreading is called RSS, receive-side scaling: the controller hashes fields from the packet header — source and destination IP, source and destination port — and that hash picks a queue. Same flow, same hash, same queue, every time. That's what lets one core own a queue without needing to coordinate with any other core.

**Step five — DMA.** This is the part people underestimate. The controller doesn't send the packet to the CPU to be copied into memory. It writes the packet directly into a buffer in the host's RAM itself, over PCIe, using direct memory access — DMA. The CPU isn't involved in moving a single byte of this transfer.

*[PCIe preset, glowing packet crossing the connector.]*

**Step six — PCIe.** That DMA write travels across the eight lanes of this connector as PCIe memory-write transactions. Eight lanes of third-generation PCIe gives this card roughly 7.9 gigabytes per second in each direction — vastly more than either 10-gigabit port needs on its own, which leaves plenty of headroom for descriptor traffic and a second port running at the same time.

**Step seven — the RX queue and descriptor ring.** Now here's the piece that ties hardware to software. In host memory sits a data structure called a descriptor ring — a circular array that software prepared in advance. Each descriptor is basically an empty pointer: "here's a free buffer, put the next packet here." When the controller finishes writing a packet, it marks that descriptor as done.

**Step eight — the application picks it up.** On the software side, if you're running a high-performance dataplane stack — this is where something like DPDK comes in — a worker core is continuously polling that ring, not waiting for an interrupt. It calls a function, commonly `rte_eth_rx_burst()`, which sweeps up a batch of completed descriptors in one call and hands your application the packets as ready-to-use buffers, called mbufs, pulled from a pre-allocated pool called a mempool.

*[Let the RX queue zone light up briefly.]*

No interrupt, no context switch, no extra copy. The packet moved from copper wire to application memory with the CPU touching it exactly once — to read it.

---

## 5. How a packet is transmitted (11:30–13:15)

*[Trigger `__AXIOBYTE__.demoTx()`, reverse route glowing amber.]*

Transmit is the same path, run backward, and it starts on the software side.

**Step one — the application builds a packet** and hands it to the driver, which calls `rte_eth_tx_burst()`.

**Step two — descriptors go up.** The driver writes descriptors into the TX ring, each one pointing at a buffer that already holds the outgoing packet, and then writes to a doorbell register — a simple "hey, new work" signal to the controller.

**Step three — the controller DMA-reads** those buffers straight out of host memory, again with no CPU copy.

**Step four — PHY and cable.** The controller hands the frame to the PHY, which encodes it back into that sixteen-level analog signal and puts it on the wire.

**Step five — completion.** Once the controller has sent the frame, it writes back a completion, and the driver returns that buffer to the mempool so it can be reused for the next packet.

*[Overview preset, animation settling.]*

Two independent, symmetric pipelines — one for receive, one for transmit — both bypassing the CPU for the actual data movement, and both driven entirely by polling instead of interrupts when you want maximum throughput.

---

## 6. Going further: why this design exists (13:15–14:45)

*[Overview, slow orbit, no clicking — this is the "step back" section.]*

A quick recap of the ideas that make this fast, because they're worth naming directly:

**Multi-queue plus RSS** turns one NIC into effectively N independent lanes, one per CPU core, with zero locking between them.

**DMA** means the controller talks to memory directly — the CPU's job is reduced to setting up buffers in advance and reading results after the fact.

**Polling instead of interrupts** — the model DPDK uses — avoids the fixed cost of an interrupt and a context switch on every single packet, which matters enormously once you're processing millions of packets per second.

**Hardware offloads** — checksums, segmentation, VLAN handling — move repetitive, well-defined work into silicon that does it far cheaper than a general-purpose CPU core.

Put together, this is why a card that looks like a simple green board with two ports can be the difference between a server that pushes a few hundred thousand packets a second and one that pushes tens of millions.

---

## 7. Where you'll find NICs like this (14:45–15:30)

*[Overview preset, gentle final orbit.]*

Cards built this way show up anywhere packet throughput is the job, not a side effect: load balancers, firewalls and other security appliances, software routers and switches, telecom dataplanes, and virtualized network functions running inside the cloud. Anywhere you hear the words "line rate," "packet forwarding," or "dataplane," there's a card very much like this one underneath, doing exactly what we just walked through.

---

## 8. Outro (15:30–16:00)

*[Pull back to a wide Overview shot, then fade.]*

So the next time someone says "just add a NIC," you'll know that green card is quietly running its own miniature pipeline — copper, transformer, PHY, controller, DMA engine, and a set of queues — all built to get a packet from a cable into your application, and back out again, as many millions of times a second as the wire will allow.

Thanks for watching. If you want to explore the model yourself, the link's in the description.

*[End card.]*

---

## Appendix: quick reference for editing

| Section | Visual cue | Component / API |
|---|---|---|
| Cold open | Overview, slow orbit | `camera.focus('overview')` |
| PCB | Top preset | — |
| RJ45 ports | Click each port | `rj45-1`, `rj45-2` |
| Magnetics | Zoom on transformer | `magnetics-1` / `magnetics-2` |
| PHY | Lift heatsink | `heatsink` → action `toggle-heatsink` |
| Controller | Click chip | `nic-controller` |
| PCIe connector | PCIe preset | `pcie-connector` |
| Bracket | Rear preset | `bracket` |
| RX walkthrough | Packet animation | `__AXIOBYTE__.demoRx()` |
| TX walkthrough | Packet animation | `__AXIOBYTE__.demoTx()` |
| RX/TX queue callouts | Zone highlight | `rx-queue`, `tx-queue` |
