# Todo: shipped github or vercel

## Settings layer
- [x] Add `github_repo` and `vercel_url` to `SettingKey` union and `SETTING_DEFAULTS` in `board/src/db/settings.ts`

## DB / API layer
- [x] Update `listCards` in `board/src/db/cards.ts` to LEFT JOIN `iterations` and return the latest `commitSha` per card
- [x] Update `getCard` similarly to return `commitSha`

## Type layer
- [x] Add `commitSha?: string | null` to the `Card` type in `board/src/contexts/CardPanelContext.tsx`

## Settings UI
- [x] Add "GitHub Repo" field (`github_repo`) and "Vercel URL" field (`vercel_url`) to `GlobalSettings.tsx`, update local `Settings` type, POST body, and initial fetch

## CardPanel UI
- [x] Add GitHub section: for shipped cards, show link when `commitSha` + repo info available
  - AM board cards: use `github_repo` setting + `commitSha`
  - Project cards: use `github_username` + `repoDir` basename + `commitSha`
- [x] Add Vercel section: for shipped cards, show link when Vercel URL available
  - AM board cards: use `vercel_url` setting
  - Project cards: use `demoProject.demoUrl` (keep existing Demo section, just rename label to Vercel if URL is https://)

## Verify
- [x] Confirm settings save/load round-trip works for new fields
- [x] Open a shipped card and confirm GitHub link renders and URL is correct
- [x] Open a shipped card and confirm Vercel link renders and URL is correct
- [x] Confirm shipped card with no commitSha or no settings shows neither link (no empty/broken UI)
- [x] Confirm non-shipped cards show no GitHub/Vercel sections
