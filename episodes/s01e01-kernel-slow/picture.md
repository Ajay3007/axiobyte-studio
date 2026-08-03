# THE ONE PICTURE — s01e01

## The One Picture

One packet, three taxes. The packet barely moves; the *core* is what keeps getting
interrupted, copied out of, and switched away from.

The screen is split for the whole film. On the left, where the packet is. On the
right, a vertical timeline of what the core is actually doing — and that column is
the argument. By the end it is almost entirely other people's work.

## The counter-picture

None yet — this episode *is* the counter-picture. It builds the cost that s01e02's
zero-copy and s01e03's poll-mode exist to remove. Every red mark here is a debt the
pillar spends the next four episodes paying off.

## The payoff frame

The core's timeline, full, with the packet's own processing a thin sliver of it.
Interrupts, copies and switches fill the rest.

## What must never happen

- The packet is shown moving fast. It is not the slow part; the core is.
- A cost appears without the core's timeline showing it.
- DPDK is mentioned before all three taxes have been paid on screen.

```yaml
assertions:
  - id: OP-1
    statement: "The packet's bytes are copied, and that is the point — but only in the kernel path."
    actor: packet#1
    forbids: [reference]
    after: kernel.arrives
```
