# dsh-tip-jar 🫙

**Tip jar for DeepSeek Harness** — a contributor support system for open-source
plugins. Contributors declare their support channels once in `sponsors.json`
(USDC, fiat platforms, subscriptions, sponsor slots); users reach them in one
tap from a sponsor-center panel, a settings page, or tool-card credits.
Pure P2P, zero custody, privacy by default (pseudonymous + unverified badges).

## Features

- **Sponsor center**: conversation "Support" tab + settings "Support contributors" page
- **USDC (Polygon)**: payment QR code + copyable address (format-checked `0x`+40 hex)
- **Fiat / subscriptions**: Afdian, GitHub Sponsors, Patreon, Ko-fi links
- **Sponsor slots**: static "Sponsored by …" placements (author negotiates directly with advertisers)
- **Privacy by default**: alias only, unverified badge, no forced identity
- **Safe degradation**: missing/corrupt registry or invalid addresses → empty state or error, never a crash
- **On-chain radar** (0.1.5): watches Polygon USDC `Transfer` events (public RPCs, 60s poll, 1-block confirm, since install), aggregates per-contributor amount / count / deduped supporter count, and shows a thank-you wall
- **Ethics badges** (0.1.5): 🟢 voluntary / ⚪ unconfirmed / 🔴 paywall — driven by the registry `ethics` declaration, validation enforced (voluntary + no paywall is a listing requirement)
- **Upstream declaration** (0.1.6): plugin entries can declare an `upstream` project (attribution guard: copying code is licensed, impersonation is not — spec §5.4)
- **Embeddable component** (0.1.6): `TipJarEmbed` — other plugins can add a tip entry with one line (see `EMBED.md`)

## Quick start (30-second onboarding)

```bash
# 1. Install
dsh plugin --profile <name> add dsh-tip-jar
# 2. Copy the example registry and make it yours
copy node_modules/dsh-tip-jar/sponsors.example.json sponsors.json
# 3. Edit sponsors.json: fill in your USDC address / tip platform links
# 4. Restart the Harness → your tip entry appears in the "Support" tab
```

> 📖 Full step-by-step guide (field reference / verification / FAQ): **[QUICKSTART.md](QUICKSTART.md)**.

## Install (persistent)

```bash
npm install && npm run build

# Add to a profile (either)
dsh plugin --profile <name> add dsh-tip-jar
# or add "dsh-tip-jar" to the profile's dsh.profile.bundles (cordis.patch.yml applies automatically)
```

After restarting the Harness every session loads the sponsor center; page
refreshes do not lose it.

## Registry `sponsors.json` (workspace root)

```jsonc
{
  "schemaVersion": 1,
  "privacyNote": "Contributors may use an alias only; unverified until certified.",
  "contributors": [{
    "id": "ghost-trader",            // required, unique
    "alias": "ghost_trader",         // required, pseudonym
    "verified": false,               // required; false → unverified badge
    "bio": "one-liner",
    "ethics": {                      // enforced since 0.1.5
      "voluntary": true,             // voluntary tips (no paywall)
      "paidWall": false              // true → 🔴 paywall, not listed
    },
    "tips": {
      "usdc": "0x…(40 hex)",         // optional, format-checked
      "fiat": [{ "label": "Afdian", "url": "https://…" }],
      "qrCodes": [{ "label": "WeChat", "image": "…" }]  // optional: platform-pay receipt QR
    },
    "subscriptions": [{ "label": "Patreon", "url": "https://…" }]
  }],
  "plugins": [{
    "pluginId": "dsh-tip-jar",
    "name": "Tip Jar",
    "contributorId": "ghost-trader", // references contributors.id
    "upstream": {                    // 0.1.6: source declaration (anti-copycat L2)
      "repo": "https://github.com/…", // upstream repo URL (required)
      "author": "upstream author",    // required
      "license": "MIT"                // optional
    },
    "sponsors": [{ "name": "Advertiser", "message": "tagline", "url": "https://…" }]
  }]
}
```

Full design & manifest spec: see `dsh-sponsors/PROJECT.md` and
`dsh-sponsors/manifest-spec.md` in the project workspace.

## Development

```bash
npm test       # registry / on-chain / dispute / service suites (red/green)
npm run build  # esbuild: host / remote / client (__ModuleLoader__)
```

## ☕ Support the author

If the tip jar saved you some effort, a coffee is very welcome — fully voluntary, thanks! 🙏

| Chain | Address | QR |
|-------|---------|----|
| **Ethereum / EVM** | `0xcea407b16bc7ddd308d74330bdc271d490835123` | ![ETH](assets/eth.png) |

> Direct transfer, on-chain settlement, zero middleman. The tip-jar author does
> not collect via the plugin page — that page serves third-party contributors
> only; this is the author's personal support entry.

## License

MIT
