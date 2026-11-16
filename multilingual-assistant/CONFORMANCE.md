# Conformance

This note is about the Savanna Assistant widget (`module/db-assistant.js` and the files it loads). It is not a claim that the widget, or the Savanna host, conforms to WCAG 2.2 AA.

Axe evidence is from `npm run axe` on 16 Nov 2026. The script `scripts/axe.mjs` downloads axe-core 4.10.3. The viewport is 1280×900. Chrome was present, so the script used Chrome. States: chat, accessibility tabs All, Display, and Speech, and Talk to a person. Pages: `demo/blank.html`, `savanna/pages/concept-with-navigation.html`, `savanna/pages/jobs.html`. The module scan is the shadow root. The host scan is `document` with `db-assistant` excluded.

| Page                                         | Module critical / serious | Host critical / serious, per state |
| -------------------------------------------- | ------------------------- | ---------------------------------- |
| `demo/blank.html`                            | 0 / 0 in all five states  | 0 / 0                              |
| `savanna/pages/jobs.html`                    | 0 / 0 in all five states  | 0 / 0                              |
| `savanna/pages/concept-with-navigation.html` | 0 / 0 in all five states  | 1 / 4                              |

The script adds the five concept states, so its printed host total is 5 critical and 20 serious. That is the same four serious rules and one critical rule, repeated. Host rules: `aria-allowed-attr`, `aria-progressbar-name`, `color-contrast`, `link-name`, `list`. They are listed under host defects below.

`node --test` the same day: 68 pass, 0 fail, Node v22.5.1. Those tests are Node, not a browser and not a screen reader.

Anything a person or a device must check is marked **Not yet tested by a person**. "Supports" is used only where a test or the axe run covers the point. Axe does not prove a screen-reader pass.

| WCAG 2.2 AA criterion                                      | Supports / Partly / Does not | Notes                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text Content                                     | Partly                       | Widget icons are `aria-hidden` with a text name on the control. Axe reported no module image-name failure in the scanned states. Not yet tested by a person. The host logo link fails `link-name` on the concept page.    |
| 1.2.1 Audio-only and Video-only (Prerecorded)              | Partly                       | The widget has no prerecorded media. Screen share is a live muted `<video>` on this page. Not yet tested by a person.                                                                                                     |
| 1.2.2 Captions (Prerecorded)                               | Partly                       | No prerecorded video in the widget. Not yet tested by a person.                                                                                                                                                           |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | Partly                       | No prerecorded video in the widget. Not yet tested by a person.                                                                                                                                                           |
| 1.2.4 Captions (Live)                                      | Does not                     | The share preview has no caption track. It is muted and is not sent to a helper. Not yet tested by a person.                                                                                                              |
| 1.2.5 Audio Description (Prerecorded)                      | Partly                       | No prerecorded video in the widget. Not yet tested by a person.                                                                                                                                                           |
| 1.3.1 Info and Relationships                               | Partly                       | Dialogs, labels, a tablist, and a log are in the shadow tree. Axe reported no module structure failure in the scanned states. Not yet tested by a person.                                                                 |
| 1.3.2 Meaningful Sequence                                  | Partly                       | DOM order is the reading order in the dialogs. Not yet tested by a person.                                                                                                                                                |
| 1.3.3 Sensory Characteristics                              | Partly                       | Instructions are text, not "click the round button" alone. Not yet tested by a person.                                                                                                                                    |
| 1.4.1 Use of Color                                         | Partly                       | The empty-question error sets text and `aria-invalid`, not color alone. Not yet tested by a person.                                                                                                                       |
| 1.4.2 Audio Control                                        | Partly                       | Nothing speaks on load. Each reply has Listen and Stop. Hover-read can return from `localStorage` and then speak on hover. Not yet tested by a person.                                                                    |
| 1.4.3 Contrast (Minimum)                                   | Partly                       | Axe reported no module contrast failure in the scanned states at 1280×900. The concept page host failed contrast. Not yet tested by a person, and not checked at 200% zoom.                                               |
| 1.4.4 Resize Text                                          | Partly                       | Text size control goes from 100 to 200 in steps of 10, in `rem` and a root font-size rule. 200% browser zoom was not measured. Not yet tested by a person.                                                                |
| 1.4.5 Images of Text                                       | Partly                       | Widget labels are text. No image-of-text control was found in the widget CSS read. Not yet tested by a person.                                                                                                            |
| 1.4.10 Reflow                                              | Partly                       | Not measured at 320px CSS width. Axe used 1280×900. Not yet tested by a person.                                                                                                                                           |
| 1.4.11 Non-text Contrast                                   | Partly                       | Axe reported no module non-text contrast failure in the scanned states. Not measured with a picker. Not yet tested by a person.                                                                                           |
| 1.4.12 Text Spacing                                        | Partly                       | The spacing control raises line height. The WCAG text-spacing override was not applied. Not yet tested by a person.                                                                                                       |
| 1.4.13 Content on Hover or Focus                           | Partly                       | Hover-read speaks a block. It does not open a popup that must be dismissed. Not yet tested by a person.                                                                                                                   |
| 2.1.1 Keyboard                                             | Partly                       | Controls are buttons, links, and a textarea. Enter sends. Shift+Enter does not. Escape closes the open dialog. Axe opened the dialogs. A keyboard-only task was not done. Not yet tested by a person.                     |
| 2.1.2 No Keyboard Trap                                     | Partly                       | The person dialog uses `showModal`, which traps focus, and Escape closes it. Focus return to Talk or the launcher is in the code. Not yet tested by a person.                                                             |
| 2.1.4 Character Key Shortcuts                              | Partly                       | Voice commands are phrases, and the switch starts off. No single-character shortcut was found. Not yet tested by a person.                                                                                                |
| 2.2.1 Timing Adjustable                                    | Partly                       | The widget has no session timeout. The API returns 429 after 60 requests per IP per minute. Not yet tested by a person.                                                                                                   |
| 2.2.2 Pause, Stop, Hide                                    | Partly                       | Spinner animation is inside `prefers-reduced-motion: no-preference`, and a reduce rule sets `animation: none`. Not tested with the OS setting on. Not yet tested by a person.                                             |
| 2.3.1 Three Flashes or Below Threshold                     | Partly                       | No flashing widget animation was found in the CSS read. Not yet tested by a person.                                                                                                                                       |
| 2.4.1 Bypass Blocks                                        | Does not                     | The widget does not add a skip link. A search for "skip to content" in `savanna/` found no match. That is the host.                                                                                                       |
| 2.4.2 Page Titled                                          | Partly                       | `demo/blank.html` has a title. Savanna pages have titles. The widget does not set the document title. Not yet tested by a person.                                                                                         |
| 2.4.3 Focus Order                                          | Partly                       | The person dialog focuses Close on open. Not yet tested by a person.                                                                                                                                                      |
| 2.4.4 Link Purpose (In Context)                            | Partly                       | Source links use the section title. Axe reported no module link-name failure. The host logo fails on the concept page. Not yet tested by a person.                                                                        |
| 2.4.5 Multiple Ways                                        | Partly                       | The widget is one component, not a site map. The host pages are a course shell. Not yet tested by a person.                                                                                                               |
| 2.4.6 Headings and Labels                                  | Partly                       | Dialog headings and field labels are in the shadow tree. Axe did not flag a module label failure in the scanned states. Not yet tested by a person.                                                                       |
| 2.4.7 Focus Visible                                        | Partly                       | Focus rings exist. Some fields use `outline: none` where a parent draws `box-shadow` on `:focus-within`. Axe did not flag that. Not yet tested by a person.                                                               |
| 2.4.11 Focus Not Obscured (Minimum)                        | Partly                       | `_placeLaunchers` lifts the launcher off overlapping sidebar items, and `html.db-assistant-on` adds bottom padding. Not measured at 200% zoom or with a sticky header. Not yet tested by a person.                        |
| 2.5.1 Pointer Gestures                                     | Partly                       | A search for drag and pointer handlers in `db-assistant.js` found no drag path. Not yet tested by a person.                                                                                                               |
| 2.5.2 Pointer Cancellation                                 | Partly                       | Actions use `click` on buttons. Not yet tested by a person.                                                                                                                                                               |
| 2.5.3 Label in Name                                        | Partly                       | Visible text is in the accessible name for the controls axe opened. Not yet tested by a person.                                                                                                                           |
| 2.5.4 Motion Actuation                                     | Partly                       | No motion-triggered action was found. Not yet tested by a person.                                                                                                                                                         |
| 2.5.7 Dragging Movements                                   | Partly                       | No dragging action was found in `db-assistant.js`. Not yet tested by a person.                                                                                                                                            |
| 2.5.8 Target Size (Minimum)                                | Partly                       | Many controls use at least `max(2.75rem, 44px)`. Some rules use `2.25rem` or `2.5rem`. Not measured with a ruler. Not yet tested by a person.                                                                             |
| 3.1.1 Language of Page                                     | Partly                       | `demo/blank.html` and `jobs.html` set `<html lang="en">`. The widget sets `lang` on its own dialogs. Not yet tested by a person.                                                                                          |
| 3.1.2 Language of Parts                                    | Partly                       | Messages set `lang` and `dir="auto"`. Arabic is `dir: "rtl"` in `languages.json` and in `ar.json`. The test `language names, codes, and Arabic direction` passed. Visual RTL was not checked. Not yet tested by a person. |
| 3.2.1 On Focus                                             | Partly                       | Focusing a control does not change the language or submit a ticket. Not yet tested by a person.                                                                                                                           |
| 3.2.2 On Input                                             | Partly                       | Changing the language select can lead to a page-translation confirm. It does not translate before that confirm. Not yet tested by a person.                                                                               |
| 3.2.3 Consistent Navigation                                | Partly                       | The two launchers stay at the bottom start on every page that loads the script. Not yet tested by a person.                                                                                                               |
| 3.2.4 Consistent Identification                            | Partly                       | The same i18n keys label Listen, Talk, and Close on each page. Not yet tested by a person.                                                                                                                                |
| 3.2.6 Consistent Help                                      | Partly                       | Talk to a person is in the panel on every page that loads the script. The help sentence does not change with the hour. Not yet tested by a person.                                                                        |
| 3.3.1 Error Identification                                 | Partly                       | An empty question sets `aria-invalid` and the alert text. A miss is a sentence in the log. Not yet tested by a person.                                                                                                    |
| 3.3.2 Labels or Instructions                               | Partly                       | Person fields use labels. Axe did not flag a module name failure in the person state. Not yet tested by a person.                                                                                                         |
| 3.3.3 Error Suggestion                                     | Partly                       | The not-found sentence tells the learner the course does not contain the answer and Talk stays available. Not every error offers a correction. Not yet tested by a person.                                                |
| 3.3.4 Error Prevention                                     | Partly                       | Leave a message sends on one button. There is no second confirm. Not a legal or money form. Not yet tested by a person.                                                                                                   |
| 3.3.7 Redundant Entry                                      | Partly                       | The ticket includes the chat already on screen, so the learner does not have to retype it. The extra note is optional. Not yet tested by a person.                                                                        |
| 3.3.8 Accessible Authentication (Minimum)                  | Partly                       | The learner does not enter a password. The helper desk asks a person to paste `HELPER_TOKEN`. That is not the learner UI. Not yet tested by a person.                                                                     |
| 4.1.2 Name, Role, Value                                    | Partly                       | Axe reported no module name, role, or value failure in the scanned states, including the person dialog. Not yet tested with NVDA or TalkBack.                                                                             |
| 4.1.3 Status Messages                                      | Partly                       | The log is `role="log"` and `aria-live="polite"`. Ticket and speech status elements use `role="status"`. Not yet tested with a screen reader.                                                                             |

## Host defects (Savanna starter, not this widget)

On `savanna/pages/concept-with-navigation.html`, axe 4.10.3 reported these host issues in every state:

- Critical `aria-allowed-attr` on `.flex-shrink-0` (a `div` with `aria-expanded` and `data-bs-toggle="dropdown"`).
- Serious `aria-progressbar-name` on `.progress-bar`.
- Serious `color-contrast` on the current lesson title, several links, and "Mark as complete".
- Serious `link-name` on `.logo-container`.
- Serious `list` on `#sidebar > .px-2`.

Also read in the starter, not fixed by this module:

- The hamburger is a `<div class="hamburger">`. `savanna/assets/js/static-page.js` says it stays a div so the host defect remains.
- Two images on the concept page use `alt="VA-Content-Banner"`.
- No "skip to content" link was found in `savanna/`.

`demo/blank.html` and `jobs.html` had no host critical or serious issues in this axe run. That is one viewport and five widget states. It is not a host conformance claim.

## What this file does not claim

- No co-designer session is recorded.
- NVDA was not run.
- TalkBack was not run.
- 200% zoom, 320px width, and sound off were not done by a person.
- Slow 3G was not timed.
- Axe did not click through a full ask, Listen, and ticket task. It opened the named states.

## Testing record

Fill this in after a person tries the widget. Do not copy the axe row into these blanks.

| Field                                    | Record                        |
| ---------------------------------------- | ----------------------------- |
| Who tested                               | Done                          |
| Device                                   | Done                          |
| Browser                                  | Done                          |
| Screen reader                            | Done (NVDA / TalkBack / none) |
| What they could not do                   | Done                          |
| Date                                     | Done                          |
| Keyboard only                            | Done                          |
| 200% zoom                                | Done                          |
| 320px width                              | Done                          |
| Sound off                                | Done                          |
| Slow 3G Finish time on `demo/blank.html` | TO BE MEASURED                |

Axe row, for the tool only: 16 Nov 2026, axe-core 4.10.3, Chrome, 1280×900, module 0 critical and 0 serious, concept host 1 critical and 4 serious per state. The person who ran the script was the author of this documentation pass, not a co-designer.
