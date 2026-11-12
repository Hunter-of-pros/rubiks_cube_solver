# Known Limitations

This file tracks current constraints and edge cases we know about as we build the system.

- **Stage**: Only the initial repository skeleton exists so far; no C++, Python, or React code is implemented yet.
- **Vision constraints (anticipated)**: Sticker recognition on glossy/stickerless cubes under strong glare or warm indoor lighting will need careful normalization and a manual override UI.
- **Solver trade-offs (anticipated)**: Optimal IDA* solves fast for shallow scrambles but scales poorly without large pattern databases on deep 20-move scrambles—which is why we will implement and benchmark Kociemba's two-phase solver alongside it.

