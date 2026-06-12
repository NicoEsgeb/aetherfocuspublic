# Lore section videos — energy + card pairs

Four pairs on the home page. Each pair = one **energy reacting to music** clip
next to one **card flip in app** clip. They autoplay muted + loop when scrolled
into view (lazy, same as the Origin section).

Required filenames (exact, lowercase):

| Pair | Left — energy reacting | Right — card flip |
|------|------------------------|-------------------|
| 1    | `01-energy.mp4`        | `01-card.mp4`     |
| 2    | `02-energy.mp4`        | `02-card.mp4`     |
| 3    | `03-energy.mp4`        | `03-card.mp4`     |
| 4    | `04-energy.mp4`        | `04-card.mp4`     |

Tips:
- **Record landscape** (Mac screen capture). Cells are 16:10, `object-fit: cover`.
- 5–8s loops, H.264 mp4, no audio. Keep each well under ~1 MB if you can.
- A missing file just shows a dark cell — nothing breaks.
- To add or remove pairs, copy/delete a `.lorepair` block in `index.html`.
