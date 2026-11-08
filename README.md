# Shardwell · lore site

The public lore of Shardwell, built from the private vault `sudo-osito/shardwell-vault`.

- `index.html`, `app.js`, `app.css`: static site, no dependencies, hash routing.
- `data/lore.json`: generated from the vault with `node build/build.mjs [vaultPath]`. Only world notes are public (World, People, Power, Creatures, Cosmology, Manuscript, Works, Concepts); author notes (confirmations, dates, open-question links) are stripped and open items become "Unwritten".
- `img/`: approved art. `fonts/`: see `fonts/README.md`.

## The Desk (#/desk, author only)
Where the author and Claude work together. The author asks for things (threads, by topic) and reviews the lore Claude proposed
(approve / ask for changes / reject per page, a note per page and per section). Stored in KV (`desk-requests`, `desk-reviews`) via
`GET /desk` and `POST /desk/request`, `POST /desk/review` on the Worker.

Claude's side, at the start of every Shardwell session:
```
node api/desk.mjs list                                  # what is waiting for Claude
node api/desk.mjs state  <requestId> working            # mark as in progress
node api/desk.mjs reply  <requestId> <file> [answered]  # answer a request (text from a file, **bold** and [[Page]] links work)
node api/desk.mjs review <pageId> <file> [applied]      # answer a page review once applied in the vault
```
