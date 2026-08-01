# 製図アプリ — Vision

The complete app, not a first version. This describes what the thing is when it is finished, so that every decision along the way can be checked against it.

Working name only. Not yet named.

---

# PART 1 — What it is

A parametric drafting tool for Japanese clothing. You enter your measurements, bend a set of design controls, name the cloth you have, and it produces a complete, internally consistent 寸法表, 裁ち方図, and 縫い方 — live, as you change things.

It replaces the page in a sewing book. Same sections, same order, same vocabulary. The difference is that the numbers are yours and they cannot contradict each other.

## Why this is possible for 和服 specifically

Japanese garments are built from a small, shared vocabulary of mostly-straight panels — 身頃, 袖, 衿, 衽, まち, 紐 — sized by arithmetic over a handful of body measurements. The curves that exist (股ぐり, 衿ぐり, hem shaping) are few, shallow, and specified in the source material as centimetre offsets from anchor points, which is to say: as control points.

Western drafting needs curve fitting, dart manipulation, and grading. None of that applies here. That is the entire reason a small tool can cover a whole clothing tradition.

## Why it should exist

Nothing covers this. CLO3D is expensive, curve-oriented, and built for industry. Valentina/Seamly2D assumes Western drafting. 和裁 tooling is books, and the good books are out of print.

More importantly: the reasoning that connects a garment's features to *what those features do* — thermally, culturally — is not written down anywhere in a usable form. `docs/brief.md` contains one worked example of that reasoning for 甚平. Encoding it as interface is the thing the app has that a book cannot.

## Who it is for

Someone who can operate a sewing machine and wants to make Japanese clothing that fits them, in cloth they chose, with the design decisions made deliberately rather than inherited. Not a beginner's first project, not a professional 和裁士's tool.

---

# PART 2 — The pipeline

Everything the app does is one chain. Each stage derives from the one before it. Nothing is entered twice.

```
採寸          body measurements
  ↓  + ゆとり (ease, from 意匠 choices)
出来上がり寸法  finished garment measurements
  ↓  + 縫い代 (allowance, derived from edge-finish choices)
裁ち切り寸法    cut sizes
  ↓  + 生地 (bolt width, shrinkage)
裁ち方図        cutting layout
  ↓
材料 / 縫い方   materials list and build sequence
```

Two properties follow from this, and they are the whole value proposition:

1. **You cannot produce an inconsistent draft.** A sleeve edge that does not match its armhole is not a mistake you can make; it is a value the engine computes.
2. **Changing one number updates everything downstream.** Deepen the 剣先 and the collar band gets longer, the buttonhole positions move, the fabric requirement changes, and the 縫い方 step for the band updates its numbers.

---

# PART 3 — The flow

## ① 選ぶ — Pick a garment

A gallery. Each card shows the finished illustration, the tradition it comes from, and roughly how hard it is. A field to paste a shared link and land directly inside someone else's design.

## ② いきなり形になる — A complete draft immediately

Tap a size. Done — full 寸法表, full 裁ち方図, full 縫い方, all valid, before you have typed anything.

This is the most important moment in the app. Nothing asks for twelve measurements before showing you anything. You start from a working garment and bend it. A blank measurement form is where this category of tool dies.

## ③ 採寸 — Make it yours

Three ways in, all equal:

- **Preset** — S / M / L / LL, from standard JIS sizing
- **Your body** — enter measurements, with a diagram beside the fields; focus a field and it highlights on the figure
- **A garment you own** — measure a shirt that fits well, flat, and enter *those* numbers. The app back-solves your body measurements from them. This is what people actually do, and `docs/brief.md` Step 3 says so explicitly.

Below the fields, the fit read in plain language:

> 胸囲ゆとり **+14 cm** · 裾は腰骨から **12 cm 下** · 袖口は手首から **3 cm 先**

## ④ 意匠 — The design controls

The part you spend real time in, and the part nothing else has. Each control states what it costs you.

This is [yousai.net](https://yousai.net/how_to/wahuku/jinbei_seizu)'s 改造の仕方 section — which real Japanese sewing sites already treat as first-class — promoted to a live control panel.

| Control | Range | Tradeoff shown |
|---|---|---|
| 剣先 depth | 12–25 cm | deeper = better exhaust venting, stronger 甚平 read |
| 掛襟 width | 3–8 cm | wider = stronger 半纏 read |
| 身八つ口 | on / off | strong cooling, strong 祭 tell |
| 袖付け opening | 0–10 cm | the single largest cooling contributor |
| かがり thread | 白 / 生成 / 共色 | the 和 dial — white is the loudest 祭 signal |
| ステッチ colour, rows | — | on solid black cloth, this *is* the visible design |

## ⑤ 生地 — The cloth you have

**A design and a fabric are separate things, paired.** A design is 採寸 plus 意匠. A fabric is its own object. You point one at the other, and swapping the fabric recomputes the whole right-hand side without touching the design.

This matters because the normal case is making the same garment again in different cloth. The first one is 綿麻; the second is しじら on a 40 cm 反物, which nests completely differently, needs more metres, and wants a different seam finish. Same design, three outputs.

### 生地棚 — your shelf

Fabrics you own or are considering, saved and named. Each carries width, fibre, shrinkage, price, and how much you have left after previous projects. Start one from the library below, or enter your own.

Swapping between them is one click, and the 裁ち方図, 買う長さ, cost, and 材料 all follow.

### 見比べ — compare

The same design against two or three fabrics at once: metres needed, total cost, and whether it fits at all. This is the decision you actually make in the shop.

### The fabric pushes back on the design

Cloth is not just a width and a price. It constrains construction, and the validation should say so rather than letting you find out at the machine:

- **Fray-prone** (loose-weave linen) → 三つ折り or 袋縫い, which demands more 縫い代 than ジグザグ
- **Sheer** → wants a lining or a doubled panel, which changes the layout entirely
- **Heavy** → different needle, and a collar band that will not sit at 4 cm
- **Stretchy or unstable** → grain discipline stops being optional

So the pairing is two-way. The design determines what you cut; the fabric determines how you can finish it.

### The library

Start from a common Japanese cloth and adjust, rather than entering everything cold:

| Cloth | Typical width | 水通し shrinkage | Notes |
|---|---|---|---|
| 綿麻 | 110–140 cm | 3–5%, uneven | Fast moisture release |
| 阿波しじら | 38–40 cm | 3–4% | Puckered; only ridges touch skin |
| 二重ガーゼ | 105 cm | 5–8% | Shrinks hard, pre-wash twice |
| 高密度コットン | 110 cm | 2–3% | Holds a collar band well |
| 麻 100% | 140 cm | 4–6% | Creases; needs pressing discipline |

The 裁ち方図 re-nests as you change width. Output is **買う長さ** with shrinkage folded in, and a hard warning if the pieces do not fit.

### 材料 — everything else, derived

The materials list is computed, not entered. Every line falls out of a decision made elsewhere, and appears or vanishes as those decisions change.

| Item | Derived from |
|---|---|
| 生地 | Layout length + 水通し shrinkage |
| ミシン糸 | Total seam length × thread-per-seam factor → metres → spools |
| 接着芯 | Present only if a collar band or placket exists; area from those panels |
| ボタン | Count from buttonhole positions; diameter constrained by band width |
| 平テープ / ゴム | Present only if a drawstring or elastic waist is chosen; length from waist + tie allowance |
| レース糸 | Present only if かがり is on; length from vent perimeter × stitch density |
| 刺し子糸 | Present only if 刺し子 is on; length from the marked stitch paths |

Two things the list carries beyond quantities:

- **手持ち / 買う** — tick what you already own. What remains is a shopping list, with a running total from the prices you entered.
- **Constraints, not just amounts** — "11 mm buttons, because a 4 cm band takes 10–12 mm," or "needle #11 for this fabric weight." The list says *what to buy*, not merely how much.

Thread quantity is worth calling out because nobody computes it and everyone guesses. Total seam length is already known from the panel paths, so the estimate is close to free.

## ⑥ ずっと検算している — Continuous validation

Not a button you press. Five classes, all live:

1. **寸法 consistency** — seam lengths that must match, matched. Mismatch highlights both edges with the delta.
2. **縫い代 sufficiency** — 三つ折り at 1 cm twice needs 2 cm allowance. Pick the finish and the allowance follows; if you force a smaller one, it says so.
3. **Fabric fit** — does it nest on your bolt, at your width, in the length you have.
4. **Wearability** — ease inside a sane band, hem landing somewhere sensible on the body, sleeve reaching the wrist.
5. **Grain** — every piece oriented along the bolt unless deliberately overridden, because on visible weaves a crosswise piece looks wrong.

Every reconciliation error in `docs/brief.md` is unreachable by construction here.

## ⑦ 読む — The document

The right-hand side, scrolling, in the order Japanese sewing books use:

**出来上がり図** → **寸法表** → **材料** → **裁ち方図** → **縫い方**

## ⑧ 作業モード — At the machine

The mode nobody builds. Large type, one step at a time, tap to check off, screen stays awake, 寸法表 one tap away. Designed for a phone propped next to the machine with your hands full.

Progress persists. You will not finish in one sitting.

## ⑨ 送る — Share

The whole design encodes into the URL. Send it; the recipient opens it, replaces the 採寸 with their own, keeps your 意匠.

## Layout

```
┌─── 採寸 ────┬──────────────────────────┐
│  ▸ 意匠     │   出来上がり図            │
│  ▸ 生地     │   寸法表                  │
│             │   材料                    │
│  live       │   裁ち方図                │
│  always     │   縫い方                  │
│  visible    │                    ▸作業  │
└─────────────┴──────────────────────────┘
```

Left never moves — it is what you keep touching. Right is the sewing-book page, rewriting itself. On narrow screens the left collapses to a bottom sheet.

Not tabs, not a wizard. Tabs would hide the inputs; a wizard would punish going back, which is the motion the app is entirely for.

---

# PART 4 — The model

Described as concepts, not code.

## Three separate objects

| Object | Contains | Owned by |
|---|---|---|
| **型 — template** | Panels, curves, controls, build steps. Has a parent | The registry. Shared, versioned, forkable |
| **仕立て — design** | 採寸 plus 意匠 choices, against one 型 | You. Shareable by link |
| **生地 — fabric** | Width, fibre, shrinkage, price, remaining stock | You. Reusable across designs |

A design references a fabric rather than containing one. One design renders against any fabric on your shelf; one fabric supplies any number of designs. Neither is nested in the other.

## A template is not a category of clothing

It is a parametric draft with a parent. 掛襟シャツ is not a kind of garment — it is a **fork of 甚平** whose panel set and controls were changed. `docs/brief.md` Part 1 is exactly that fork, written by hand: delete the 衽, close the 身八つ口, add a gusset, swap the closure.

Templates form a tree, not a taxonomy. 浴衣 and もんぺ are famous templates; yours is one nobody has heard of. Structurally there is no difference.

### What a template is *for*: bounding the control surface

Without templates, the 意匠 panel would have to offer every knob any garment could ever have — 繰り越し, おはしょり, rise, crotch curve — mostly greyed out. The template says "these five panels, these twelve knobs."

That is its whole job. It is a scoping mechanism, not a classification.

## Two levels of customization

Forking is the escalator between them.

| Level | What you can do | Result |
|---|---|---|
| **Use** | Turn the declared knobs | Always valid. Cannot break |
| **Fork** | Add or remove panels, move a curve, attach stitching anywhere, declare new knobs | A new template, with a parent |

The template author chooses which changes are knobs and which require a fork. 千鳥かがり can be either: exposed as `かがり: on/off, thread colour` when the author knew it should be adjustable, or attached to any edge of any panel by someone who forked. Either way 縫い方 grows a step and 材料 grows a レース糸 line, derived.

The line between the levels is structure versus value. "剣先 at 18 cm" is a value. "The 衽 panel does not exist" is structure — the panel either gets cut or it does not, and both the 裁ち方図 and the 縫い方 change shape.

### Editing stays parametric

Forking never means dragging points to pixel positions. You set a point relative to a measurement or to another point — "8 cm along the shoulder from CF" — so constraints survive the edit.

This is the discipline that keeps the tool from degenerating into CAD. The moment arbitrary positions are allowed, the app can no longer tell you the sleeve does not match the armhole, and that guarantee is the entire product.

## Panels come from a shared vocabulary

Every 和服 garment is assembled from the same named parts. A template picks the ones it needs.

| Part | Appears in |
|---|---|
| 身頃 (前 / 後) | every top |
| 袖 | every top |
| 衿 (地衿 / 掛衿) | 着物, 甚平, 作務衣, 半纏 |
| 衽 | 着物, 甚平, 浴衣 — the overlap panel |
| まち | gussets, underarm and crotch |
| 紐 | ties |
| 前 / 後ろパンツ | every bottom |
| 帯 / 腰紐 | waistbands |

Shared parts mean shared drawing, shared validation, and shared 縫い方 fragments. Adding a garment is mostly declaring which parts and how they are sized.

## A panel is a closed path

Not a rectangle — a rectangle is the case where every segment is straight. Segments are lines, arcs, or curves, and every point is an expression over the measurement set rather than a fixed number. Curves are anchored the way the source diagrams already specify them: as centimetre offsets from a corner.

Each panel carries its quantity, whether it is cut on the fold (わ), its per-edge seam allowance, and its notch positions.

## Stitching is first-class

Three kinds, all modelled, all rendered:

| Kind | Example |
|---|---|
| **ほつれどめ** — edge finish | ジグザグ, ロック, 三つ折り, 袋縫い, パイピング |
| **ステッチ** — topstitch line | コバステッチ on a band, hem topstitch |
| **かんぬき止め** — point reinforcement | bar tacks at vent tops |
| **手縫い飾り** — hand decoration | 千鳥かがり, 刺し子 |

Each carries distance from the edge, thread colour, stitch length, and row count.

Stitching is not cosmetic in the model. Edge finish **determines seam allowance**, and it **rewrites the 縫い方** — 三つ折りにして縫う and ロックしてから縫う are different sequences.

A stitch line attaches either to a panel edge (a hem) or to a seam between two panels (a collar band). Both are needed.

## Controls are typed, not bespoke

Every 意匠 control is one of: length, width, toggle, enum, or colour. The UI renders any of them generically. What is per-garment is the *list* — each entry naming what it changes and carrying its tradeoff text.

## 縫い方 is generated

Steps come from the template, filtered by the choices. Turn 身八つ口 on and its steps appear. Change the hem finish and that step's text and numbers change with it.

Headings are verb-final, the way the books write them: 後中心を縫う, 襟を縫う, 脇を縫う, すそを縫う.

---

# PART 5 — Garment coverage

The target. Ordered by how much new machinery each demands.

**Rectangles and shallow diagonals**
甚平 (上), 作務衣 (上), 半纏, 法被, 前掛け, 帯, 巾着

**Adds the 衽 and a real 衿 system**
浴衣, 単衣着物, 襦袢, 羽織

**Adds the 股ぐり curve** — the first genuinely curved seam, and the first place fit can actually fail
甚平ズボン, もんぺ, 作務衣ズボン, ステテコ

**Adds pleat systems**
袴

**Adds three-dimensional shaping** — the honest edge of the approach
足袋

**Adapted / modern**
掛襟シャツ and anything else derived from the above by moving the 意匠 controls outside their traditional ranges. This is the category `docs/brief.md` lives in, and it comes free once the controls exist.

---

# PART 6 — Visualisation

Ranked by what each actually tells you.

| | What you see | Verdict |
|---|---|---|
| **ゆとり readout** | "chest ease +14 cm, hem 12 cm below hip, cuff 3 cm past wrist" | Highest value per effort in the entire app |
| **Silhouette overlay** | garment outline over a scaled body figure, front and side | Catches gross proportion errors |
| **出来上がり図** | the garment drawn hanging on a figure, generated from the panel data | The right answer for "how does it look worn" |
| **Live cloth drape** | physics simulation on a body mesh | **Excluded. See below.** |

## Why there is no drape simulation

Not because it is too hard — because it would tell you nothing.

Rectangular panels with 15–20 cm of ease have no emergent drape behaviour to discover. The simulation renders "it hangs straight," which the draft already said. Drape simulation earns its keep on fitted garments with darts and curves, which is exactly what 和服 does not have.

The failure mode is also asymmetric. Cloth physics without self-collision puts sleeves through the torso and hems through legs, and users read that as *the app is wrong* even when the pattern is correct. A clean line drawing never has that failure mode.

What a 和服 looks like worn is determined by four numbers — body width, body length, sleeve length, neckline depth. It is a tube hanging from the shoulders. That is precisely why it is drawable rather than needing simulation.

Revisit only if 袴 or fitted adaptations enter scope, where drape genuinely carries information.

## Export

- **寸法表** — the primary output. Large-print, wall-tapeable. 和裁 uses no paper pattern; you mark 裁ち切り寸法 directly on the cloth.
- **裁ち方図** — the layout diagram as an image.
- **SVG / PDF** — for 広幅 cloth with diagonals and curves, where a traced pattern beats marking by hand.
- **1:1 tiled print** — supported, deliberately not the primary path.

---

# PART 7 — Community

"Support everything" is not reachable by one person hand-authoring templates. 浴衣, 袴, and 足袋 each need someone who has actually made one.

So templates are contributable data. Fork an existing one, adjust it, publish it. Templates carry provenance — what source they were drafted from, who verified them, whether anyone has actually sewn the result.

The registry is the long-term asset. `docs/brief.md` Part 7 notes that the reasoning about which features carry thermal load versus cultural signal does not appear in published form. A registry of parametric, annotated, verified 和服 drafts would be the same kind of thing, and larger.

---

# PART 8 — Non-goals

- **Live cloth physics.** Covered above.
- **Western drafting.** Darts, grading, sleeve caps, princess seams. Different problem, well served elsewhere.
- **Photorealistic fabric rendering.** The 出来上がり図 is a line drawing on purpose.
- **Commerce.** No fabric sales, no marketplace, no accounts required to use it.
- **Teaching sewing.** It generates 縫い方; it does not teach 運針.

---

# PART 9 — Open questions

- **Naming.** The app has none.
- **Back-solving body from garment.** Measuring a shirt you own is the most useful input path and the least well-defined — the inverse of ease is not unique.
- **Curve offsetting.** Seam allowance on a curve needs flattening, offsetting, and resolving inside-corner self-intersections. The one piece of real geometry work in the project.
- **Template format stability.** Contributed templates outlive the schema. Versioning has to exist from the first published one.
- **反物 vs 広幅 as a first-class split.** They produce different layouts, different seam counts (a centre-back seam appears on narrow cloth), and different 繰り越し handling. Possibly a property of the template rather than of the fabric.
