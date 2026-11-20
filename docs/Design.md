# Design

The approved look is **"Friendly learning app, calm"**. Ankit approved it on 2026-11-20, after
four rounds (history in `docs/PLAN.md` §2.1). The reference build is `docs/mockup/console.html`.
**When this file and the mockup disagree, the mockup wins.** Fix this file to match.

## 1. Principles
1. **Understanding before data.** Every screen answers "what does this mean for me" first. The raw detail is one click away.
2. **Show evidence, not the agent's word.** Claims carry a stamp and a jump to the moment that proves them.
3. **Colour is meaning.** Each colour has one job (§2). No decorative colour.
4. **Calm surfaces.** Hairline borders, no floating shadows, generous space. Rounded and friendly, never busy.

## 2. Colour tokens

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--ground` | `#F5F4F8` | `#14131A` | page |
| `--card` | `#FFFFFF` | `#1C1A24` | cards |
| `--ink` / `--ink-2` / `--ink-3` | `#231A33` / `#584E69` / `#7B7389` | `#EDEAF3` / `#BCB5CA` / `#8E879D` | text |
| `--line` / `--line-2` | `#E7E4EC` / `#D8D4E0` | `#2A2733` / `#383444` | hairlines |
| `--action` | `#5A50C8` | `#8A82E2` | **only** things you can press: buttons, active tab, links, timeline handle |
| `--soch` / `--soch-ink` | `#E8F0FA` / `#2F5A86` | `#1E2836` / `#A8C3E3` | channel: Thinking |
| `--read` / `--read-ink` | `#E7F3EC` / `#2B6646` | `#1D2B25` / `#A3D3B6` | channel: Read |
| `--edit` / `--edit-ink` | `#FAF3DC` / `#735A14` | `#2F2A1C` / `#E2CC8C` | channel: Edit |
| `--run` / `--run-ink` | `#FAECE4` / `#86452A` | `#31241F` / `#E4B7A2` | channel: Run |
| `--ok` (= read) | | | claim backed, done, safe |
| `--unk` (= edit) | | | can't verify, partly done, check first |
| `--bad` / `--bad-ink` / `--bad-solid` | `#FBE9EB` / `#A3293A` / `#D14A59` | `#35202A` / `#EFA4AE` / `#DB6270` | no evidence, failed, risky, removed code |
| `--add` / `--del` | `#ECF6F0` / `#FBEEF0` | `#1A2A22` / `#33202A` | diff lines |
| `--live` | `#E0525A` | `#E0626A` | recording dot only |

**Theme**: `data-theme` on `<html>`. The first visit follows `prefers-color-scheme`. A header button switches the theme and the choice is saved.

## 3. Type
- Headings: **Baloo 2** (600, 700, 800). Rounded and warm, made by an Indian foundry, and it fits a Hinglish audience.
- Body: **Nunito** (400 to 800).
- Code, times, data: **JetBrains Mono**. Use it only for those, never as decoration.
- The real build **self-hosts** the fonts (the mockup loads Google Fonts). Everything stays local.

## 4. Shape and space
- Radius: cards 22px, small 14px, pills 999px.
- Borders: 1px `--line`. Emphasis is 1.5px (the selected prompt, the claim alert). No box shadows at rest.
- Page gutter: 28px desktop, 16px mobile. Card padding: 20 to 22px.
- Motion: `cubic-bezier(.16,1,.3,1)` for panels. A soft spring for presses and the timeline handle. All motion stops under `prefers-reduced-motion`.

## 5. Layout
- **Header**: mark, project, "Sample data" tag (mockup only), REC pill, theme, language, level.
- **Left rail**: prompt cards (number, prompt, time, files, flags, "learned" tick) and "Progress, export & map".
- **Main column**, top to bottom: prompt title, health card + "what you asked", claim alert or claim line, timeline strip (thin by default), sticky step bar or tabs, step content.
- **Mobile (≤900px)**: the rail becomes a horizontal chip row, the step bar or tabs become a fixed bottom bar, and the chat button floats above it.

## 6. Components (names as in the mockup)
`summary/health/asks`, `alert` + `cbar`, `strip`/`trace`/`tick`/`pin`/`cursor`, `stepper`/`stepchip`,
`tabs`, `card`, `lesson .hero`, `decision`, `errcard`/`errbox`, `diffwrap`/`code`/`note` (plain-words column),
`askans` (line question), `impact` + `fixprompt`, `seccard`/`pkg`/`checks`, `todo`/`tlist`/`manual`,
`pg` (playground: `editor`, `pgres`, `cmp`, `pred`, `challenge`, `browser`), `quiz`/`opts`,
`chatfab`/`chatpanel`, `term` (glossary tooltip), `facts`/`clist`/`exbox`/`areas` (overview).

## 7. Writing
- Hinglish and English are both first-class. Every string exists in both.
- Plain words first. Technical terms get a glossary tooltip.
- Buttons name their action ("Run the tests", "Copy fix prompt"), never "OK" or "Submit".
- Never claim what the record cannot show. If something can't be checked, say so ("Can't verify").
