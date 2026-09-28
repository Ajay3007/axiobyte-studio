"""The Three.js backend — the Studio side of ``renderers/three``.

Like Blender, the Studio never imports the tool: Three.js runs in a browser. This
package builds the command, runs the backend's own offline renderer
(``renderers/three/tools/render.mjs``) over one shot's window, and records what
came out. The same scene the renderer films is the interactive page under
``experiences/`` — one scene, two targets (ARCHITECTURE.md §8.6).
"""

from __future__ import annotations

from axiobyte_studio.backends.three.video import (
    ThreeShotJob,
    node_binary,
    three_root,
    workspace_root,
)

__all__ = ["ThreeShotJob", "node_binary", "three_root", "workspace_root"]
