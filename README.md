# Shardwell · lore site

The public lore of Shardwell, built from the private vault `sudo-osito/shardwell-vault`.

- `index.html`, `app.js`, `app.css`: static site, no dependencies, hash routing.
- `data/lore.json`: generated from the vault with `node build/build.mjs [vaultPath]`. Only world notes are public (World, People, Power, Creatures, Cosmology, Manuscript, Works, Concepts); author notes (confirmations, dates, open-question links) are stripped and open items become "Unwritten".
- `img/`: approved art. `fonts/`: see `fonts/README.md`.
