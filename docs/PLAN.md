# vibe-explainer — poora plan

> Naam abhi kaam chalaane ke liye hai, final naam baad mein.
> Status: **PLAN, approval baaki.** Code tab tak nahi likhenge.
> Date: 2026-11-19

---

## 1. Ye kya hai

**Ek problem:** AI se code likhwaya (vibe coding). Code ban gaya, par pata nahi
ki AI ne kya badla, kyun badla, kaise kaam karta hai, aur isse kya toot sakta hai.

**Hamara solution:** ek local console jo AI ka har kadam record karta hai, aur
fir **teacher ki tarah** visual mein samjhata hai:

- abhi AI kya kar raha hai (live)
- kya-kya kiya (logs)
- kya badla (changes)
- kaun kisse juda hai (wiring)
- isse kya affect hoga (impact)
- ye sab samajh ke seekho (lesson + quiz)

**Kiske liye:** naye developers, students, aur koi bhi jo AI se code likhwata hai.

**Kyun bana rahe hain:** open source showcase. Bechne ke liye nahi.
Ankit ke portfolio aur job ke liye: "ye problem dekhi, ye tool banaya".

**Pakki baatein:**
1. Sab kuch user ke PC pe chalega. Hamara koi server nahi hai.
2. Code sirf us model ko jaata hai jise user ne teacher chuna hai (Ollama chuno to bilkul bahar nahi jaata).
3. User ki git branch, commits aur staging ko kabhi nahi chhooyega.
4. Ek command mein install.

---

## 2. Console: user ko kya dikhega

Ek browser page: `http://localhost:4321`

```
┌───────────────────────────────────────────────────────────────────────┐
│ ● LIVE   Claude kaam kar raha hai… "auth.js edit kar raha hai"  [Hindi▾][Beginner▾] │
├──────────────┬────────────────────────────────────────────────────────┤
│ OVERVIEW     │ [Live] [Logs] [Changes] [Wiring] [Impact] [Seekho]     │
│ PROMPTS      │                                                        │
│ ▸ Forgot     │                                                        │
│   password   │            chuna hua tab yahan dikhega                 │
│ ▸ Fix login  │                                                        │
│ ▸ Dark mode  │                                                        │
└──────────────┴────────────────────────────────────────────────────────┘
```

| Tab | Kya dikhega |
|---|---|
| **Overview** | Project ka khaaka: main hisse, kitni files, aaj kaunse hisse chhue gaye |
| **Live** | AI abhi kya kar raha hai, step by step: 📖 padha → ✏️ badla → ▶️ chalaya |
| **Logs** | Poori raw history: har tool call, har command aur uska output, errors, aur AI ne galti khud kaise theek ki |
| **Changes** | Badli files, diff (laal hata / hara aaya), aur har badlaav ke bagal mein saral explanation |
| **Wiring** | Naksha: file → file, function → function. Naya ya badla hissa highlighted |
| **Impact** | Badle function kahan-kahan use hote hain, kya toot sakta hai, risk (kam / beech / zyada) |
| **Seekho** | Lesson: kya kiya / kyun / kaise kaam karta hai / pehle vs ab. Phir 2-3 quiz sawaal |

Switch: **Beginner / Developer** aur **Hindi / English**. Saari explanations inhi se badlengi.

### 2.1 Layout aur naye features (mockup round 3, 2026-11-19, Ankit ne chune)

Mockup: `docs/mockup/console.html`. Look "Friendly learning app" hai: peach background, safed gol cards, har channel ka apna rang, aur violet rang sirf dabane wali cheezon pe. Pehla grey "Flight Recorder" look reject hua.

**Dark theme:** header mein chaand/suraj ka button hai. Pehli baar system ki setting follow hoti hai, uske baad user ki pasand yaad rehti hai. Dark mein gehra plum background aur gehre cards hain. Rangon ke matlab wahi rehte hain: channel ke rang, hara/peela/laal daawe, aur violet = dabane wali cheez.

**Layout**
- **Beginner = guided lesson.** Har prompt 4 steps ka chhota course hai: **1. Kya hua → 2. Kya badla → 3. Dhyan do (impact + wiring) → 4. Quiz**. Upar progress bar hai, aur neeche Aage/Peeche buttons. "Lesson poora" dabao to prompt pe "seekh liya" lag jaata hai.
- **Developer = tabs** (Live, Logs, Changes, Wiring, Impact, Seekho).
- **Daawe ek line mein dikhte hain.** Sab theek ho to ek hari line aati hai. Koi daawa bina saboot ho to laal box aata hai, jisme wahi daawa aur uska kaaran hai. Baaki daawe "Saare daawe" button ke peeche hain.
- **Timeline chhoti rehti hai** (ek patli line). "Poori timeline kholo" se 4 channel wali timeline khulti hai. Timeline pe kisi pal pe click karo to us pal ka "Live" view khulta hai.
- **Step bar / tabs** scroll karte waqt upar chipke rehte hain. Mobile pe ye neeche ek bar mein hote hain.

**Naye features**
| Feature | Kahan | Kaise kaam karega |
|---|---|---|
| Tests chalao | Laal daawe wale box mein | Project ka test command chalata hai aur nateeja wahin dikhata hai. Daawa sach nikle to stamp badal jaata hai |
| Fix prompt copy | Daawe ke box aur har Impact card mein | Teacher har risk ke liye ek tayyar prompt likhta hai, jo ek click mein copy hota hai |
| Line pe sawaal | "Kya badla" mein code ki har line | Line pe click karo, aur teacher us line ko tumhare level pe samjhata hai. Aage ka sawaal bhi pooch sakte ho |
| Seekhne ka record | "Progress, export aur khaaka" page | Har lesson ke concepts jama hote hain. Quiz ke jawab se status tay hota hai: Pakka / Revision chahiye / Abhi quiz nahi diya. "Revision quiz" button bhi hai |
| Export | Wahi page | Session se PR description, commit message aur "aaj ka note" banata hai, copy button ke saath |

**Round 5 (2026-11-20): aur samjhaane wale aur kaam ke features**
| Feature | Kahan | Data kahan se |
|---|---|---|
| Health card: "Rakh sakte ho / Pehle check karo / Risky" | Har prompt ke upar | Tests chale ya nahi, bina saboot daawe, Impact ke risks, security notes |
| Prompt checklist: "Tumne kya maanga tha" | Health card ke bagal mein | Teacher prompt ko alag-alag maangon mein todta hai, aur har maang ko diff/events se milata hai: poora / aadha / nahi |
| AI ne ye raasta kyun chuna | "Kya hua" step | AI ki soch (transcript) se: kaunse options the, kya chuna, aur kyun |
| Error samjhao | "Kya hua" step, Logs, Live | Fail hue command ka output, saral bhaasha mein, aur AI ne use kaise theek kiya |
| Shabd pe hover | Lesson, notes, impact ke text | Ek glossary. Har text mein sirf pehli baar wala shabd underline hota hai |
| Packages + security | "Dhyan do" step / Impact tab | `package.json` ka diff (size, licence, downloads), aur diff ka scan: secrets, eval/innerHTML, error leak |
| Ab kya karo checklist + Khud test karo | Naya step 4 / "To-do" tab | Bina saboot daawe, adhoore daawe, Beech/Zyada risks aur security notes se to-do list banti hai, tick karne wali. Saath mein manual test ke steps aur "kya dikhna chahiye" |
| Session se poochho | Har jagah, neeche kone mein chat | Poore session ka record. Teacher jawab deta hai. Kuch tayyar sawaal bhi hain |

Beginner ke steps ab 5 hain: Kya hua, Kya badla, Dhyan do, Ab kya karo, Quiz. Developer mein naya "To-do" tab hai.

**Round 6 (2026-11-20): Playground, "Khud try karo"** (Beginner step 4 / Developer tab "Playground")

Sab kuch ek **sandbox** mein hota hai: git worktree `~/.vibe-explainer/sandbox/`. Asli project tabhi badlega jab user khud "Mere project mein lagao" dabaye aur diff dekh ke haan bole.
| Hissa | Kya karta hai | Asli build mein |
|---|---|---|
| 1. Badal ke dekho | Badle hue code ka koi hissa edit karo, phir "Sandbox mein chalao". Teacher ki raay, lint, tests, impact, aur "AI ka vs tumhara" diff dikhta hai. Teen raaste: project mein lagao (confirm ke saath), AI ke liye prompt banao, ya sandbox mita do | Editor: Monaco/CodeMirror. Sandbox mein lint aur tests chalte hain. Teacher (`claude -p`) edit ka asar samjhata hai. "Kya badla" mein har code ke saath "Edit karke dekho" button |
| 2. Kya hoga agar…? | Teacher sawaal poochhta hai, user andaaza chunta hai, phir sandbox mein wo badlaav chal ke asli output dikhata hai, saath mein samjhaana | Teacher sawaal aur un badlaavon ki patch list banata hai, aur sandbox har patch ko chala ke nateeja nikaalta hai |
| 3. Ab tum karo | Usi change se juda chhota kaam. Teacher ke likhe tests se check hota hai, 3 hint milte hain, phir solution. Poora karne pe concept "Pakka" ho jaata hai | Teacher kaam, tests, hints aur solution banata hai. Tests sandbox mein chalte hain |
| 4. Pehle vs ab, screen pe | Teen versions: AI se pehle, AI ke baad, aur tumhare edit ke baad. App ke page pe click karke dekho, jaise bug: galat email pe button atak jaata hai | Sandbox mein dev server chalta hai aur console mein iframe mein dikhta hai. Sabse mushkil hissa, isliye pehli release ke baad |

Beginner ke steps ab 6 hain: Kya hua, Kya badla, Dhyan do, Khud try karo, Ab kya karo, Quiz.

Teen baatein asli build mein tay karni hongi:
- "Tests chalao" user ke PC pe command chalata hai, isliye pehli baar permission maangega, aur command project ki settings se aayega.
- "Line pe sawaal" aur "Fix prompt", dono teacher model (`claude -p`) ki usage lete hain.
- Seekhne ka record `~/.vibe-explainer/` mein save hoga.

---

## 3. Kaise kaam karega (peeche ki kahaani)

Example: user ne Claude Code mein likha *"login pe Forgot password button lagao"*.

```
 Prompt
   │
   ▼
[1] RECORDER   AI ka har kadam pakadta hai  ──────────────► events.jsonl
   │
   ▼
[2] SNAPSHOT   kaam se pehle aur baad code ki photo ───────► diff.patch
   │
   ▼
[3] ANALYZER   kaunse functions badle, kaun unhe use karta hai ─► analysis.json
   │
   ▼
[4] TEACHER    sab model ko de ke lesson banwata hai ──────► lesson.json
   │
   ▼
[5] CONSOLE    browser mein sab dikhata hai (live)
```

### 3.1 Recorder

**Claude Code mein:** hooks. Har event pe Claude Code hamara script chalata
hai aur stdin pe JSON deta hai (`session_id`, `transcript_path`, `cwd`,
`tool_name`, `tool_input`, `tool_response`, `prompt`).

| Hook | Kab chalega | Hum kya karenge |
|---|---|---|
| `SessionStart` | Session shuru | Session ki entry banao |
| `UserPromptSubmit` | User ne prompt diya | Naya "turn" shuru karo + **pehle wala snapshot** |
| `PreToolUse` | AI koi tool chalane wala hai | Live pe dikhao "abhi ye kar raha hai" |
| `PostToolUse` | Tool chal gaya | Result likho (edit ka purana/naya code, command ka output) |
| `Stop` | AI ne jawab khatam kiya | **Baad wala snapshot**, phir analyzer aur teacher chalao |

Upar se Claude Code ki transcript file (`.jsonl`) se AI ki soch aur jawab
padh lenge. Isse "kyun kiya" achhe se samjha sakenge.

**Doosre AI tools mein:** file watcher (`npx vibe-explainer watch`). Jab
files badalna band ho jaayein (kuch seconds shaanti), to us waqt ka snapshot
lo. Isme AI ki soch aur commands nahi milenge, sirf "kya badla".

### 3.2 Snapshot (user ki git ko chhue bina)

- Ek **alag, temporary git index** mein poora folder add karo (`.gitignore` maana jaayega).
- `git write-tree` → `git commit-tree` → hamare apne ref `refs/vibe/<session>/<turn>` pe rakh do.
- User ki branch, staging aur commits waise ke waise rahenge.
- Pehle vs baad: `git diff <pehle> <baad>`.
- Project git mein nahi hai to hamari apni chhupi git repo (`~/.vibe-explainer/…`) mein `--work-tree` ke saath.

### 3.3 Analyzer

- **web-tree-sitter** (WASM version, taaki Windows pe compile ki dikkat na ho) se files padho: functions, classes, imports, calls.
- Diff ki lines ko functions se milao: "ye functions badle / naye bane / hate".
- Ulta search: "inhe kaun call ya import karta hai" (yahi impact hai).
- Risk ka simple hisaab: kitni jagah use hota hai, test hai ya nahi, public API hai ya nahi.
- Shuru mein languages: JavaScript / TypeScript, Python. Baaki baad mein.

### 3.4 Teacher

- Input: prompt + AI ke steps + diff + analysis + level + bhasha.
- Output: **fixed JSON format** (section 5.3), taaki console usko seedha dikha sake.
- Default: `claude -p` (user ka Claude plan, API key nahi chahiye).
- Bada diff ho to pehle file-wise chhota summary, phir ek "big picture" lesson.
- **Loop se bachao:** `claude -p` khud Claude Code hai, to wo hamare hooks phir chala dega.
  Isliye teacher chalate waqt `VIBE_EXPLAINER_INTERNAL=1` set karenge, aur hooks ye dekhte hi kuch nahi karenge.
- **Secrets chhupao:** `.env`, keys aur tokens jaisi cheezein model ko bhejne se pehle `***` kar do.
- Mode: `auto` (har prompt pe) ya `manual` (sirf `/explain` dabane pe), taaki usage limit na khaye.

### 3.5 Console

- Chhota Node server (`localhost:4321`) data files padhta hai.
- Live updates **SSE** se (server se browser ko seedha push).
- Frontend: Vite + plain TypeScript (React tab jab zaroorat lage).
- Diff: `diff2html`. Wiring ka naksha: `Cytoscape.js`.

---

## 4. Install aur use: user ke liye 3 raaste

```
              ┌──────────── CORE (npm package) ─────────────┐
              │ recorder · snapshot · analyzer · teacher ·  │
              │ console server                              │
              └──────▲──────────────▲───────────────▲───────┘
                     │              │               │
         Claude Code plugin   npx watch        MCP server
         (poora data)         (koi bhi AI)     (kisi bhi AI chat se sawaal)
```

### Raasta 1: Claude Code plugin (sabse poora)
```
/plugin marketplace add <github-user>/vibe-explainer
/plugin install vibe-explainer
```
Plugin ke andar:
- **hooks**: recording apne aap
- **commands**: `/explain` (abhi ka change samjhao), `/console` (dashboard kholo), `/quiz` (test lo)
- **skill**: chat mein "ye kya hua samjhao" bolo to Claude hamare data se samjhaye

### Raasta 2: koi bhi AI tool (Cursor, Codex, Copilot, Gemini…)
```
npx vibe-explainer watch     # folder pe nazar
npx vibe-explainer open      # console kholo
```

### Raasta 3: MCP server
Jo AI app MCP support karta hai, usme pooch sakte ho: "kal login mein kya badla tha?"

### Teacher badalna
```
npx vibe-explainer config teacher claude    # default
npx vibe-explainer config teacher ollama    # free, PC pe, internet nahi chahiye
npx vibe-explainer config teacher gemini
npx vibe-explainer config teacher openai    # API key wale ke liye
```

---

## 5. Andar ka dhaancha

### 5.1 Code ke folders
```
vibe-explainer/
├── packages/
│   ├── core/              recorder, snapshot, analyzer, teacher, store
│   ├── cli/               npx commands: init, watch, open, explain, config
│   ├── console/           browser ka page (Vite)
│   └── mcp/               MCP server (baad mein)
├── plugin/                Claude Code plugin
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── commands/          explain.md, console.md, quiz.md
│   └── skills/explain/SKILL.md
├── .claude-plugin/marketplace.json
├── docs/                  ye plan + baaki docs
├── tests/                 fixtures (nakli sessions) + tests
└── .github/workflows/     CI + release
```

### 5.2 Data kahan rahega
User ke project ko ganda nahi karenge. Sab home folder mein:
```
~/.vibe-explainer/
├── config.json
└── projects/<project-ka-hash>/
    ├── project.json                 naam, path, languages
    └── sessions/<session-id>/
        ├── session.json             source (claude/watch), shuru/khatam
        ├── events.jsonl             har kadam, ek line ek event
        └── turns/<n>/
            ├── turn.json            prompt, snapshot refs, time
            ├── diff.patch
            ├── analysis.json        badle functions, callers, risk
            └── lesson.json          teacher ka output
```

### 5.3 Lesson ka format (teacher yahi lautayega)
```json
{
  "title": "Login pe Forgot password",
  "summary": "Ek line mein kya hua",
  "what": ["…"],
  "why": "Tumhare prompt se kaise juda",
  "how": [{ "file": "auth.js", "lines": "40-62", "explain": "…" }],
  "before_after": { "before": "…", "after": "…" },
  "impact": [{ "where": "LoginPage.jsx", "risk": "medium", "why": "…" }],
  "concepts": [{ "name": "async/await", "explain": "…" }],
  "quiz": [{ "q": "…", "options": ["…"], "answer": 1, "explain": "…" }]
}
```

---

## 6. Kya-kya chahiye

### Tools (Ankit ke PC pe)
| Cheez | Kyun | Hai? |
|---|---|---|
| Node.js 20+ | Sab kuch isi mein | ✅ |
| Git | Snapshot | ✅ |
| Claude Code + Pro plan | Plugin test + default teacher | ✅ |
| GitHub account | Public repo, CI, releases | ✅ (ankitkumar9546) |
| npm account | `npx` se install ke liye package publish karna | ❓ banana padega |
| Ollama (optional) | Free local teacher test karna | ❓ D: pe, jab zaroorat ho |

### Libraries
| Library | Kaam |
|---|---|
| `web-tree-sitter` + grammars | Code padhna (functions, calls) |
| `chokidar` | File watcher (raasta 2) |
| `diff2html` | Diff dikhana |
| `cytoscape` | Wiring ka naksha |
| `vite` | Console banana |
| `vitest` | Tests |
| `@modelcontextprotocol/sdk` | MCP server (baad mein) |

### Seekhna padega (Ankit ke liye, CV pe bhi jaayega)
- Claude Code hooks aur plugins
- Git internals: index, tree, refs
- tree-sitter se code parse karna
- SSE / live updates
- npm package publish karna, monorepo
- GitHub Actions: Windows, Mac aur Linux pe CI, aur tag lagao to release

---

## 7. Banane ka order (har step ka check)

Ek step tabhi poora jab uska check pass ho.

| # | Step | Check |
|---|---|---|
| 0 | Repo setup: monorepo, lint, test, CI | Push pe GitHub Actions hara |
| 1 | **Recorder** (hooks → events.jsonl) | Ek prompt do, file mein saare kadam sahi order mein |
| 2 | **Snapshot + diff** | Diff sahi. `git status` aur branch bilkul pehle jaise |
| 3 | **Teacher** (`claude -p` → lesson.json) | Ankit ek asli change ka lesson padhe aur bole "samajh aaya". Loop nahi bana |
| 4 | **Console v1**: Live, Logs, Changes, Seekho | Browser mein poora session, live chalta hua |
| 5 | **Plugin** packaging + `/explain` `/console` | Naye folder mein 2 command se install, kaam kare |
| — | 🎬 **Pehla demo**: README + GIF, repo public | Koi naya banda 2 minute mein chala le |
| 6 | **Analyzer** + Wiring + Impact tabs | Badla function aur uske users naksha mein dikhen |
| 7 | **Quiz** + Beginner/Developer + Hindi/English | Switch se explanation badle |
| 8 | **`npx watch`** (Cursor/Codex ke liye) | Cursor se change karo, console mein lesson aaye |
| 9 | **Teacher adapters**: Ollama, Gemini, OpenAI | Teacher badlo, lesson phir bhi isi format mein |
| 10 | **MCP server** | Kisi AI chat se "kal kya badla" ka sahi jawab |
| 11 | npm publish + release automation + launch posts | Tag lagao → npm + GitHub release apne aap |

Step 5 ke baad dikhane laayak cheez ban jaati hai. Usko pehle public karna hai, perfect hone ka intezaar nahi.

---

## 8. Mushkilein aur unka jawab

| Mushkil | Jawab |
|---|---|
| Lesson galat ya bakwaas | Fixed JSON format, diff ki asli lines saath mein, 5-10 asli sessions pe baar-baar test |
| Bada diff (30 files) | Pehle file-wise summary, phir big picture. Diff ki limit |
| Pro plan ki limit khatam | `manual` mode, chhote turns skip, Ollama option |
| Secrets model ko chale gaye | Bhejne se pehle redaction, `.env` kabhi nahi |
| Teacher ka loop | `VIBE_EXPLAINER_INTERNAL=1` guard |
| Hooks ka format Claude Code update mein badla | Parser ek jagah, fixtures se test, version check |
| Windows pe native build ki dikkat | WASM tree-sitter, sirf pure-JS libraries |
| User ki git kharab ho jaaye | Kabhi uska index ya branch na chhoona. Har snapshot ke test mein ye check |

---

## 9. Abhi tay karna hai (Ankit)

1. **Naam:** final naam kya hoga?
2. **Licence:** MIT (sabse simple, sab use kar sakein)? Ya kuch aur?
3. **Folder:** `D:\vibe-explainer`, theek hai?
4. **Console ki bhasha:** shuru mein Hindi aur English dono, ya pehle sirf English?
5. **Pehla demo kab public:** step 5 ke baad (meri salah) ya poora banne ke baad?
