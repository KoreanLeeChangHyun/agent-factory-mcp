# SaaS UI component contract

`static/css/ui.css` owns shared tokens and primitives. Feature CSS owns layout,
including document splits, timeline tracks, sidebar indentation and responsive
composition. Workspace and login both load the shared stylesheet. No framework
or component runtime is required: static HTML, DOM builders and HTML-string
renderers use the same classes.

## Actions and navigation

| Class | Use |
| --- | --- |
| `ui-button` | Secondary action, refresh, retry, copy |
| `ui-button ui-button--primary` | The main submit/complete action in a scope |
| `ui-button ui-button--danger` | Delete, revoke or disconnect |
| `ui-button ui-button--link` | Text/statistic action; no filled background |
| `ui-button ui-button--icon` | Square action; requires accessible name and title |
| `ui-button ui-button--compact` | Compact toolbar action |
| `ui-tabs` and `ui-tab` | Navigation; independent of action button styling |
| `ui-resource-row` | Selectable resource with identity and metadata |
| `app-sidebar__*` | Sidebar headers, sections, disclosure, rows and selection |

Use native `button` elements for actions. State comes from native `disabled`,
`aria-busy`, and the appropriate `aria-current`, `aria-selected` or
`aria-pressed` attribute. Do not add `ui-button` to sidebar rows or tabs.
Selection must have a non-color cue and an accessible state.

Never style all buttons beneath a feature container in shared CSS. In
particular, a mixed `:is()` list takes the highest specificity of any member;
adding a dialog footer to such a list can override unrelated statistic or tab
styles. Avoid using extra selector specificity to repair component conflicts.

Organization's DOM builder accepts an explicit button variant; planning's
builder preserves additional layout classes without emitting duplicate class
attributes. Form submit variants are explicit. Labels or API responses must not
be parsed to infer a button's role.

## Fields, messages and sections

Native text inputs, selects and textareas inside Workspace, dialogs and login
share control geometry. `ui-field` places a visible label above the control.
Use `ui-field__help` for help and connect it with `aria-describedby` when it is
needed to understand an input. Associate field errors with the affected field;
use form-level errors when the server does not identify a field.

`ui-message` owns text wrapping and message typography. Use `role="alert"`
for errors and `role="status"` for nonurgent asynchronous feedback.
`ui-message--muted`, `--error`, and `--success` express known state. Empty
messages collapse; `ui-message--reserved` deliberately reserves a text line.
Do not apply reserved space to every empty sidebar list. Planning's compact
dashboard retains its existing fixed message slot to keep toolbar geometry.

`ui-section-header` aligns a heading and its actions and permits wrapping.
Feature-specific headers may retain geometry when needed for timeline or
editor alignment; they consume shared font and spacing tokens.

Async forms must prevent duplicate submission and restore controls after a
failure. Set `aria-busy="true"` on the form or submit button while awaiting the
operation. The busy indicator changes the button background without changing
its width or replacing its label. Never re-enable a control that was disabled
for an independent permission or validation reason. Existing confirmation
dialogs and destructive-operation validation remain functional requirements.

## Tokens and deliberate exceptions

Shared palette, font, spacing, focus, radius and overlay tokens live in
`ui.css`. Existing shell color names remain stable aliases for consumers;
their definitions no longer live in `workspace.css`. Use 30px default and
22px compact controls. Feature CSS can set the control token locally.

Editor tab-close, tree-disclosure and title-bar chrome retain their specialized
hit geometry. Timeline coordinates, chart/status fills, avatar circles,
document/PDF paper backgrounds and Google sign-in branding are not generic
action-button or surface tokens. Login can retain its centered page composition
while using the same native fields and password-login action as Workspace.
Embedded Document package styles remain owned by the Document, not this shell.

## Verification

Run the shared cascade/state regression and relevant real screen flows:

```sh
NODE_PATH=/tmp/af-pw/node_modules node tests/design_system/browser/ui-components.cjs
NODE_PATH=/tmp/af-pw/node_modules node tests/design_system/browser/ui-screens.cjs
NODE_PATH=/tmp/af-pw/node_modules node tests/organizations/browser/organizations.cjs
NODE_PATH=/tmp/af-pw/node_modules node tests/workspaces/browser/workspace-start.cjs
NODE_PATH=/tmp/af-pw/node_modules node tests/planning/browser/planning.cjs
NODE_PATH=/tmp/af-pw/node_modules node tests/connections/browser/mcp-onboarding.cjs
NODE_PATH=/tmp/af-pw/node_modules node tests/knowledge/browser/document-editor.cjs
DOCUMENT_HEADERS_ONLY=1 NODE_PATH=/tmp/af-pw/node_modules node tests/knowledge/browser/document-editor.cjs
.venv/bin/pytest -q tests/workspaces/regression/test_workspace_ui.py
.venv/bin/pytest -q tests/reporting/browser/reporting.py
```

`NODE_PATH` must point to the local installation of Playwright; the path above
is this development environment's installation, not a production dependency.
The component test loads the shipped stylesheet order in seven feature hosts
and exercises actual login HTML/JS with mocked authentication responses.
Screen flow tests use mocked APIs and do not prove database persistence.
Verify desktop and narrow widths, long Korean text, keyboard focus, disabled,
busy, empty and error states when changing a shared primitive.

The header-only document test compares all three explorer action columns at
180, 268 and 520px sidebar widths. Shared sidebar header defaults use `:where`
so a feature's explicit grid layout survives without a specificity escalation.

Two existing fixtures were brought in line with current contracts: the document
download fallback uses an unsupported binary MIME type rather than ZIP (which
now has a package preview), and the reporting fixture returns an empty array
for the Workspace groups endpoint. ZIP previews have separate delivery tests.
