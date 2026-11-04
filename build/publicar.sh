#!/bin/zsh
# Rebuilds the site from the vault: public data (free chapters) to data/novel.json, the members-only Codex to Cloudflare KV.
set -e
cd "$(dirname "$0")/.."
node build/build.mjs "${1:-$HOME/Documents/Shardwell}"
(cd api && ~/Proyectos/neisstech-organics/worker/node_modules/.bin/wrangler kv key put lore --path ../build/out/lore.json --namespace-id a65328af52e6464a85aaca1413dc0f4a --remote)
git add -A && git commit -qm "Rebuild from the vault" && git push -q || echo "nothing to commit"
