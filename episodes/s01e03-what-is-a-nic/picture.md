# THE ONE PICTURE — s01e03

## The One Picture

One green board, and one packet crossing it. Every part the camera visits is a
stop on that packet's road, and by the end the road is the whole card.

The episode opens the card part by part — PCB, ports, magnetics, PHY, controller,
PCIe — and then sends a single packet through exactly those parts, in that
order, so the anatomy tour turns out to have been the route all along.

## The counter-picture

A NIC as a socket: a passive hole the CPU reaches through to fetch bytes. The
first minutes let that picture stand, because "take bits off the wire and hand
them to the operating system" sounds like exactly that.

## The payoff frame

The packet resting in a filled descriptor slot in host memory, the whole route
lit behind it from RJ45 to PCIe — and the CPU never on it.

## What must never happen

- The CPU appears on the receive path before the application reads the packet.
- One flow is split across two receive queues.
- A packet reaches memory by any road other than PCIe.

```yaml
assertions:
  - id: OP-1
    statement: "The CPU copies nothing while the NIC writes the packet to memory."
    forbids: [copy]
    after: rx_dma.dma
  - id: OP-2
    statement: "A flow keeps its queue: same flow, same hash, same queue."
    actor: packet#1
    unchanged: [queue]
    after: rx_steer.rss
```
