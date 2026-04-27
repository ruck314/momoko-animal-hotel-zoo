# Momoko Animal Hotel Zoo

A comfy RPG hotel-zoo. **Momoko** checks into a four-floor hotel where every
guest is a different animal — elephants, lions, tigers, sea otters, unicorns,
even an alien. Greet a chandelier monkey in the lobby, ride the elevator up,
walk into each animal's room to hear their signature sound, and curl up in
your own bed for a cozy "ZZZZ" cutscene.

## Play

Open `index.html` in any modern browser. Works offline after first visit (PWA).

## Controls

| Action               | Keyboard         | Touch           |
|----------------------|------------------|-----------------|
| Walk                 | Arrow Keys / WASD| D-Pad (left)    |
| Talk / Interact      | Space / Z / ↑    | Sparkle Button  |
| Enter Room / Elevator| ↑ (Up)           | Walk close + ↑  |
| Pause                | Escape / P       | Pause Button    |

## Features

- **Pure HTML5 Canvas + JavaScript** — no frameworks, no build tools
- **PWA** — install to home screen, works offline
- **Touch controls** — fully playable on iPad and Android tablets in landscape
- **Dual language** — English and Japanese
- **All art generated in code** — no external image or audio files
- **Web Audio chiptune** — every animal has its own procedural sound
- **Four hotel floors** — Lobby, Safari Wing, Wild Wing, Pets-Sea-Magic Wing
- **19 animal rooms** to visit
- **Lobby check-in cutscene** — a chandelier monkey escorts Momoko to the elevator
- **Sleep cutscene** — interact with the bed in Momoko's room for a "ZZZZ"

## Animals

Floor 2 (Safari Wing): Elephant, Lion, Tiger, Bear, Giraffe, Zebra
Floor 3 (Wild Wing): Wolf, Eagle, Fox, Owl, Panda, Penguin
Floor 4 (Pets, Sea & Magic Wing): Bunny, Cat, Dog, Sea Otter, Kangaroo, Unicorn, Alien
Lobby: Monkeys (chandelier escort), human Receptionist

## Tech Stack

- HTML5 Canvas for rendering
- Web Audio API for procedural sound
- Service Worker for offline caching
- `localStorage` for customization and check-in flag
- Vanilla JavaScript (ES5 compatible)

## Project Structure

```
index.html          — entry point (meta tags, Back-to-Game-Center link)
css/style.css       — layout, rotate-hint, overlay styles
js/i18n.js          — English & Japanese translations (animal sounds, dialogue)
js/audio.js         — Web Audio API sound engine + animal SFX
js/input.js         — keyboard & touch input handler
js/levels.js        — floor data (lobby, safari, wild, pets/sea/magic)
js/entities.js      — Momoko, animals, receptionist, elevator, stairs, doors
js/ui.js            — title, elevator menu, animal-room interior, sleep cutscene
js/engine.js        — game loop, state machine, rendering, floor switching
js/pwa.js           — service worker registration
sw.js               — service worker
manifest.json       — PWA manifest
```

## Adding New Animals

1. Add the species' onomatopoeia line in `js/i18n.js` under the `<species>Sound` key (EN + JP).
2. Add a procedural SFX function for the species in `js/audio.js`.
3. Add a sprite painter `draw<Species>Sprite()` in `js/entities.js`.
4. Add `{ type: 'animalDoor', x, y, species: '<species>' }` to a floor's `spawns.npcs[]` in `js/levels.js`.

## License

MIT License — Copyright (c) 2026 ruck314

Made with love for Momoko.
