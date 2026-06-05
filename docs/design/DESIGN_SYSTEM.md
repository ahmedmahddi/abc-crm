# ABC CRM Design System

## Direction

ABC CRM is operational software for a bureau d'étude. The visual system must support quick field
work, document review, and dense office workflows without looking like a generic SaaS dashboard.

## Principles

- Prefer flat surfaces, visible structure, and calm contrast.
- Use compact cards only when they group one operational task.
- Use borders and spacing before shadows. Shadows are reserved for overlays.
- Use modest radii: `4px` for small controls and `7px` for grouped surfaces.
- Keep actions explicit. Avoid icon-only controls unless the label is available to assistive
  technology.
- Start layouts at phone width. Enhance information density on tablets and desktops.
- Do not add decorative metrics, gradients, glass effects, oversized icons, or placeholder charts.

## Tokens

| Purpose | Token | Value |
| --- | --- | --- |
| Primary action | `--primary` | `#125885` |
| Primary emphasis | `brand-700` | `#0E476C` |
| Page background | `--background` | `#F7F9FB` |
| Surface | `--card` | `#FFFFFF` |
| Border | `--border` | `#D9E0E4` |
| Muted copy | `--muted-foreground` | `#5E6970` |
| Danger | `--danger` | `#C44545` |
| Radius | `--radius` | `0.45rem` |

## Mobile Rules

- Primary controls must meet the WCAG 2.2 minimum target size.
- Use bottom navigation for frequent field tasks and desktop sidebar navigation for wider screens.
- Use stacked records on phones and introduce tables only as desktop progressive enhancement.
- Surface connection state, pending sync, and conflicts where operators make decisions.

## Component Rules

- Buttons use semantic variants only: primary, secondary, outline, ghost, and danger.
- Cards are bordered grouping surfaces, not decorative tiles.
- Status badges use text plus color; never color alone.
- Long forms use labeled sections and sticky mobile action bars.
- Empty states describe the next operational action.
