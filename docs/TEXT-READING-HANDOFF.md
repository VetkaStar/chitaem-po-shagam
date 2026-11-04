# Text reading handoff - 27.10.2026

Status: source freeze v4 after the additional sound-on row-height fix below. The earlier focus layout failure is now closed by targeted tests. Independent QA owns final acceptance. No commit, push, build, dist-pages or preview5184 change.


## Freeze v4 - sound-on row height

One additional scoped CSS rule: `.text-reading-scroll .full-text-line > button.quiet` has height/min-height36px and zero vertical padding. The18px icon, horizontal button space and selected text font are unchanged. The measurement row already uses the same button and therefore receives the exact rule. No runtime or ASR change in this revision.

- `.local/task-card-review/text-reading-sound-height/viewport/report.json`:4/4 PASS, no page errors, sourcesChanged=false. Real Росток in order/focus at1280x720 and390x844, sound on/off. At desktop both states retain four fully fitting28px lines; phone allows text scrolling while fixed controls stay visible. Each on-state audio button measures36px. Existing page measurement, adult pointer/done, rejection/retry and source-offset checks also passed.
- CSS audit and scoped git diff check PASS. Production build and four production checks belong to coordinator.
- Freeze manifest: `.local/task-card-review/text-reading-sound-height/viewport/source-freeze.json`.
- CSS SHA256: `7c868b5f7e56e0f12b96ed0158b086862080242456d65b0b8cf6f0fd5c617360`. Other implementation hashes unchanged from v3.

## Freeze v3 - latest changes and evidence

Only authorized narrow fixes after the first freeze:

- Desktop focus text screen uses its actual76px header allowance and removes the extra top margin. At1280x720, both looks now have a156px text viewport and156px scrollHeight for Росток at computed28px (no text scroll).
- Desktop text shelf is106px; the primary remains42px and uses bottom60px. Its selector now also wins for the result button in the footer. The primary/secondary rectangles have6px separation in both desktop layouts; the3px shadow also stays clear. Narrower internal card padding/gaps recover the shelf space without reducing text or buttons.
- ReadingGuide and ordinary lines both align left. All four starts are161.5px in desktop focus and370.5px in desktop order.
- The hidden measurement row now contains the same optional quiet/Volume2 button and flex text span as the real row. Removed unconditional46px audio reservation. `sound` is an explicit input to measurement. At390px/font40, actual/measured text widths match223/223 with audio and273/273 without audio. Off pages contain43 characters instead of the on page's27 in the tested state; no overflow.
- A disabled completed viewport renders no child DOM. It still runs the empty exposure hook and revokes authorization, but no hidden permanent aria-busy boundary remains after done. Coverage/resetKey/ASR matching unchanged.

Verification on the frozen production sources:

- `.local/task-card-review/text-reading-freeze-v3/viewport/report.json`:6/6 PASS, no page errors, sourcesChanged=false. Cases: order1280/390, focus plain/notebook1280/390. Includes fixed short-story fit, gap and left alignment, audio on/off exact measurement, frame retention/retry, source offsets, page navigation without credit, child answer gate, real adult confirmations through done and exact constant frame/primary rectangles.
- `.local/task-card-review/text-reading-page-adult/viewport/report.json`:2/2 PASS (focus1280 and order390), same source hashes. Adds actual pointer adult confirmation in pages after opening the panel and waiting for the resized page's durable record; then completion and constant geometry.
- `tests/task-card-text-browser.mjs`:PASS at1280x800 and820x1180 for read/write error, scroll, Enter, each next line and summary; exact equality of primary/card rectangles through completion.
- `tests/text-practice-flow.mjs`, typecheck, scoped oxlint, CSS audit:PASS after the new changes. No production build or live preview touched.

QA distinction: opening the adult panel changes available height and can initiate another page exposure. The old `frozen-locator-smoke` desktop timeout's last requested input is a new two-line page, not an adult-confirmation message. Holding the recorder immediately after opening the panel can legitimately make the confirmation inert. The new targeted scenario waits for that page commit and confirms with a real pointer. No acceptance gate was relaxed.

Freeze manifest: `.local/task-card-review/text-reading-freeze-v3/source-freeze.json`.

```text
194c328a67ae2cb4b9ad0219b29e7ab95c324f49de6d73d4b75fb1024dffc1c3  app/globals.css
642b6aca643a88a4fba4fad37fdc3eab118a24ae47b6f8bff7c71a4f81f5dcc3  features/library/TextExercise.tsx
9c1560891f8b4fa9e7992da237180adb404a151346c3100333bb60ce1fdd59bb  features/library/TextReadingViewport.tsx
0f0dad4d6a9be1eea2f721f58fe6a7361209d3b885bd5c18f92204f418731f5b  features/library/RetainedTextFrame.tsx
3c1fd353c503e78de9d588e728ff893ce969081be53c56cde89afd7394518cce  features/library/text-pages.ts
c545d372b8d7b06ebfa07426781f21bf5b7c4597ad9b0c773826ebd555936bf3  features/library/use-text-microphone.ts
```

## Owned implementation

- `features/library/TextExercise.tsx`
- `features/library/TextReadingViewport.tsx`
- `features/library/text-pages.ts`
- `features/library/RetainedTextFrame.tsx`
- `features/library/use-text-microphone.ts` - only the additional acceptance gate, no recognition threshold or matching change.
- Text-scoped rules at end of `app/globals.css`.
- `tests/text-practice-flow.mjs`, `tests/text-reading-viewport-browser.mjs`, `tests/fixtures/text-reading.tsx`.

Settings/config/storage/TextDisplayControls belong to the parallel settings implementation. AppPortal and other cards unchanged.

## Cause and resulting behavior

The former outer FreeExposureFrame hid the entire card on every exposure key change, including per-line feedback. Text, microphone status and adult checks also shared one scrolling body.

The text now has its own measured viewport; title, line/status row, microphone controls, adult confirmation and bottom actions stay outside it. Short-story control is the authored four-line Росток. Optional detailed instructions remain in Настройки; the illustration remains available beside the title. TextDisplayControls is available across read/questions/write. `textFontSize` is the selected CSS-pixel size without inverse interface zoom; the shared interface scale continues to scale the entire UI.

Pages use actual DOM measurement at available width/height/font. A logical line can span several pages, with original UTF-16 source offsets preserved. ReadingGuide selection and progress use those offsets. Navigation changes only the page. Font/presentation/resize do not reset readStart, covered, accepted/readLines or award credit. Active word/line selects its page. Scroll mode follows the active word inside the text region. Whole visible scroll passages retain the original joined-passage exposure entry; page exposure contains only the displayed fragments, never future pages.

## Durable boundaries and TR1

RetainedTextFrame keeps only a successfully recorded React snapshot. Initial/error state cannot render a new unrecorded snapshot. Text pages and picture hints have their own boundaries; recognition/answer/check/voice uses current readiness. The viewport revokes target authorization when pending or when the active target is off the displayed page. `useTextMicrophone` rechecks its current canAccept callback before partial, regular-final and experimental-final processing. A feedback-only gate does not recreate capture; disabling or changing the actual target retains the existing hook's cancellation behavior. Stored prefix and coverage remain unchanged by layout changes.

TR1: no pending overlay is drawn over the passage. Errors/retry are portalled into a reserved 30px row beside/replacing the line counter. The counter row is outside the scrolling text. Retained subtree branches are inert except the notice slot, so a parent failure cannot disable its own retry. Local and parent rejection/retry were both exercised with real pointer clicks. Picture content waits for its recorded visible-passages hint.

The complete result keeps the text viewport disabled while its material is hidden, avoiding hidden-page exposure after completion.

## Verification completed

- Full project `pnpm test` passed before the final TR1 notice-placement change; includes the new microphone gate regression.
- Typecheck passed after the TR1 implementation.
- Scoped oxlint passed before the final notice placement; final complete lint is owned by coordinator.
- CSS audit passed after TR1: only globals.css, no inline styles, repeated selectors or duplicate declarations.
- `tests/text-practice-flow.mjs` passed after TR1: partial/final/experimental gate blocking, preserved prefix and capture generation, old read/write/question flows, selection and single awards.
- `tests/task-card-text-browser.mjs` passed earlier in this change: real read/write error, Enter, next line and summary at1280x800 and820x1180. Final integrated rerun belongs to QA.
- Targeted TR1 smoke: `.local/task-card-review/text-reading-notice/viewport/report.json`: 1 case, 0 failures/errors, sourcesChanged=false. Includes real Росток at1280x720 with four lines fitting at28px; parent rejection/retry with frame-by-frame retained text; long paragraph visual pages; child rejection/retry; preserved selection after font/resize; page navigation without completion; guarded questions during child pending.
- Earlier phone smoke: `.local/task-card-review/text-reading-phone/viewport/report.json`: 1 case, 0 failures/errors;390x844 long paragraph/pages. This predates TR1 slot placement and is not final phone acceptance.
- The first own full matrix (`text-reading-final-v2`) was not acceptance evidence: its focus cases attempted to use hidden sidebar navigation. The test now enters through the real home cards `ШАГ 6 Тексты` -> `Рассказы`, as the existing task-card browser suite does. No UI/fixture/expectation changes were made for this navigation repair. The replacement matrix completed: `.local/task-card-review/text-reading-navigation-fixed/viewport/report.json`: 12 cases, 10 PASS, 2 FAIL, no page errors, sourcesChanged=false. Failures are `focus-plain-1280` and `focus-notebook-1280`: real Росток at28px, text viewport clientHeight136, scrollHeight154, card bottom638, adult control bottom544. Thus the four-line story still needs18px of scrolling in focus at1280x720. This is a product layout failure, not navigation. Its expectation was not relaxed; UI remains frozen. Screenshots: `focus-plain-1280-failure.png` and `focus-notebook-1280-failure.png` beside that report. All order cases and focus820/390 cases passed the current assertions, including the separate controlled exposure scenarios where reached.

All browser checks use temporary Vite ports, isolated localStorage/IndexedDB profiles, headless Edge and synthetic inputs. They do not certify child-speech recognition quality. Some early diagnostic runs failed because the harness clicked hidden mobile navigation/label spans; current harness enters through home cards and clicks the text-picker summary. Those reports are not acceptance evidence.
