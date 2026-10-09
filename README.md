# UFO Defense

A Kingdom-Rush-style isometric tower defense game: 10 levels across spring, desert and winter, ending in a mothership boss fight.
Archers, Wizards and Barracks (3 levels each, unlocked as the campaign progresses), Orbital Strike and Reinforcements
abilities, and a 30-star upgrade tree.

Built with Phaser 3, TypeScript and Vite.

```bash
npm install
npm run dev        # play locally
npm run build      # production build in dist/
npm test           # simulation + progress unit tests
npm run balance    # headless balance report (writes docs/BALANCE.md)
```

Dev shortcuts (dev server only): `?scene=Game&level=level05`, `?scene=LevelSelect&unlockAll=1`, `?scene=Ending`.

- `docs/DESIGN.md`: rules, numbers and architecture
- `docs/BALANCE.md`: balance method and latest results
- `CREDITS.md`: art (Artyom Zagorskiy, CC0) and audio (Kenney.nl, OpenGameArt; all CC0)
