# MCP SaaS interface rules

## Product expression

Use this formula consistently:

- **Structure:** VS Code — Activity Bar, Primary Sidebar, Workspace area, compact tool chrome.
- **Content grammar:** AWS Cloudscape — predictable resource summaries, forms, tables, ordered tasks, and explicit states.
- **Identity:** Agent Factory — neutral dark surfaces, restrained blue interaction accents, compact Korean developer-tool copy.

Reference systems are decision aids, not component dependencies or visual skins.

## Shell and navigation

- Preserve the repository's decided Workspace information architecture and exact Activity order.
- One navigation choice owns one sidebar view and one main Workspace view.
- Do not duplicate a navigation label as an in-content heading unless it adds essential context.
- Put item disclosure beside the item label and right-align row-level actions in a stable action slot.
- Use tabs only when content groups are independent and each supports a distinct task. Otherwise keep one continuous page.
- Keep the main workflow visible together when users must compare or complete its parts in sequence.

## Page and section composition

Use this default sequence when applicable:

1. Compact page or panel header.
2. Resource identity and status summary.
3. Controls needed to choose a context.
4. Numbered action steps.
5. Result, history, or secondary management.

- A section header places the title on the left and its single primary local action on the right.
- A field places its label above the control. Related fields share a baseline and control height.
- An action step uses number → title/action → one short instruction → value or result.
- A code operation uses title/action → code box → optional one-line help.
- A list item uses identity and metadata on the left, local action on the right.
- Render state as a concise label, adding a status dot only when it improves scanning. Never rely on color alone.

## Resource presentation choices

- Use a definition-list summary for one resource's stable metadata.
- Use a table for multiple resources with comparable fields, sorting, or scanning needs.
- Use cards only for small sets whose important attributes do not form useful columns.
- Use split view only when users must preserve list context while inspecting or troubleshooting one item.
- Prefer an all-at-once details page when the content fits and users benefit from comparison across sections.

## Tokens and geometry

Shared tokens belong in `static/css/ui.css`. Feature styles consume them rather than defining substitutes.

- Spacing scale: 4, 8, 12, 16, and 24 px. Use 32 px only for a deliberate page-level separation.
- Use one standard control height and one compact control height.
- Use a small common control radius. Do not create component-specific radii without semantic need.
- Use 1 px borders for real boundaries. Avoid stacked borders that render as double lines.
- Desktop resource summaries normally use three equal columns; use two when the content needs width and one at narrow sizes.
- Preserve DOM and task order when the layout collapses.

## Color and emphasis

- Use neutral surfaces for the application background, sidebar, work area, controls, and bounded code/table content.
- Reserve blue for primary actions, selection, focus, and links. Do not use it as decoration.
- Use semantic colors only for actual success, warning, and error states, always paired with text or an icon.
- Solid filled actions represent the highest-priority action in the current scope. Nearby actions remain neutral.
- Shadows are for overlays such as menus, dialogs, and transient notices—not ordinary sections.
- Use dividers sparingly and only once between actual regions or repeated rows.

## Components and interaction

- The same semantic action uses the same label, height, border, color, and placement.
- Native controls must have visible labels. Icon-only buttons require an accessible name and native title.
- Place select indicators at the trailing edge with enough padding that text cannot collide with them.
- Code and long identifiers own their overflow. Do not force the whole page to scroll horizontally.
- Provide visible focus and keyboard operation for every interactive element.
- Disabled controls must be visibly disabled and remain distinguishable from loading or permission failure.
- Do not make non-interactive rows look clickable.

## Content and states

- Write direct, task-oriented Korean. Delete introductions that repeat the heading or explain the obvious.
- Keep one instruction per step. Prefer “설정 파일을 다운로드해 프로젝트 디렉터리에 넣으세요.” over background prose.
- Use consistent nouns for the same entity and consistent verbs for the same action.
- Every data surface must deliberately handle loading, empty, normal, error, permission-denied, disabled/busy, and success states as applicable.
- Show only owner-backed state. Never infer that an integration is connected or healthy from local configuration alone.

## MCP connection flow

Automated connection is exactly two visible steps:

1. Download the configuration file and place it in the target project directory.
2. Copy the AI instructions and give them to the AI.

Manual connection shows the client-appropriate registration command or configuration, with one copy action. Token management is a secondary region and follows the same section, control, and list grammar.

## Responsive behavior

- Start with the desktop information hierarchy, then reduce columns without changing meaning or order.
- At narrow widths, stack controls and actions before compressing labels or hit targets.
- Keep sidebar labels visible throughout the supported resize range.
- Test long Korean labels, identifiers, commands, token names, and error messages at each supported width.

## Sources

- VS Code UX overview: https://code.visualstudio.com/api/ux-guidelines/overview
- VS Code views: https://code.visualstudio.com/api/ux-guidelines/views
- VS Code sidebars: https://code.visualstudio.com/api/ux-guidelines/sidebars
- VS Code panels: https://code.visualstudio.com/api/ux-guidelines/panel
- VS Code theme colors: https://code.visualstudio.com/api/references/theme-color
- Cloudscape resource details: https://cloudscape.design/patterns/resource-management/details/
- Cloudscape resource view: https://cloudscape.design/patterns/resource-management/view/
- Cloudscape split view: https://cloudscape.design/patterns/resource-management/view/split-view/
- Cloudscape design tokens: https://cloudscape.design/foundation/visual-foundation/design-tokens/
- Cloudscape spacing: https://cloudscape.design/foundation/visual-foundation/spacing/
- Cloudscape visual style: https://cloudscape.design/foundation/visual-foundation/visual-style/
