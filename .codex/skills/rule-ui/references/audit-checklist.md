# UI consistency audit

Audit the requested scope against actual templates, styles, scripts, API behavior, and browser output. Absence of an obvious defect is not proof; collect direct evidence.

## 1. Meaning and information architecture

- Does each surface have one clear task and one clear primary action?
- Are navigation, page headings, and section headings non-duplicative?
- Is every displayed fact owner-backed, including connection and health status?
- Were required capabilities preserved while explanatory clutter was removed?

## 2. Shared visual language

- Search for hardcoded colors, spacing, heights, radii, borders, and shadows.
- Confirm common values are semantic tokens in `static/css/ui.css`.
- Find selectors that implement the same component differently across feature files.
- Check that primary, secondary, destructive, copy, icon, and disabled actions each have one grammar.
- Check that fields, code boxes, section headers, metadata, status, and list rows reuse shared geometry.

Useful searches:

```sh
rg -n '#[0-9a-fA-F]{3,8}|rgb\(|hsl\(' static/css
rg -n '(margin|padding|gap|height|border-radius):[^;]*[0-9]+px' static/css
rg -n 'box-shadow|border-(top|right|bottom|left)' static/css
```

## 3. Alignment and density

- Compare left edges of headings, labels, fields, code boxes, and list content.
- Compare right edges and vertical centers of section actions.
- Verify one control height within a row and consistent gaps between related elements.
- Inspect for adjacent borders that form double lines.
- Confirm ordinary sections are not card-boxed or shadowed without semantic need.

## 4. Responsive and overflow

- Verify wide desktop, the minimum supported sidebar width, a narrow editor split, and mobile width.
- Confirm grids collapse without reordering the task.
- Test long workspace names, Korean labels, UUIDs, commands, token names, and error messages.
- Confirm only the owning code/table region scrolls horizontally.

## 5. Interaction and accessibility

- Navigate every action by keyboard and confirm visible focus.
- Verify labels, accessible names, native titles for icon actions, semantic headings, lists, and tables.
- Confirm selection and status are not communicated by color alone.
- Exercise loading, empty, normal, error, permission, disabled/busy, and success states that apply.
- Check that buttons do not move when labels or states change.

## 6. API-backed workflows

- Confirm the request method and route match the backend contract.
- Verify successful persistence by reloading from the authoritative API or database-facing repository test.
- Distinguish validation errors, authentication/authorization failures, missing routes, and empty results.
- Do not treat a passing static UI test as proof that persistence works.

## Evidence format

Record each issue as:

```text
[severity] Rule — observable problem
Evidence: file:line, response/status, or browser geometry/state
Fix: smallest shared correction
Verification: focused test or browser assertion
```

Finish with the commands run, viewport/state coverage, remaining risks, and any intentionally unresolved owner decision. A broad consistency claim requires browser evidence across every affected surface, not one screenshot or one page.
