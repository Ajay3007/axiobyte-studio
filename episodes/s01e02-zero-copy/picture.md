# THE ONE PICTURE — s01e02

## The One Picture

The bytes never move. A yellow arrow does all the travelling.

The whole episode is an argument about movement, made by refusing to move one
object. The payload is drawn once and does not move again — not through the parser,
not through the firewall, not at transmit. What moves instead is the pointer.

## The counter-picture

The first forty seconds build the opposite on purpose: the traditional path, where
the same bytes are copied buffer to buffer in red. The copies exist so that when
they stop, the stillness reads as the point.

## The payoff frame

Stationary blue cells, four stages, one yellow arrow. No red anywhere on screen.

The closing line — "a packet is best thought of not as bytes, but as a pointer to
those bytes" — is not a caption. It is a description of what is already on screen.

## What must never happen

- The packet buffer moves after DMA has written it.
- Red appears anywhere after the turn.
- A stage redraws the payload instead of pointing at it.

```yaml
assertions:
  - id: OP-1
    statement: "The packet buffer never moves after DMA has written it."
    actor: packet#1
    unchanged: [address]
    after: zerocopy.instead

  - id: OP-2
    statement: "No copy occurs after the turn."
    forbids: [copy]
    after: zerocopy.instead
```
