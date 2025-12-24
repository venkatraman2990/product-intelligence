# Accelerant Design System

**Skill ID:** `accelerant-design-system-v1`  
**Type:** Design & UI  
**Category:** Visual Design > Enterprise SaaS  
**Status:** Active  
**Last Updated:** December 23, 2025

---

## Overview

Replicate the Accelerant Risk Exchange visual design language when creating interfaces, dashboards, and documents. This skill captures the typography, color palette, spacing, component patterns, and layout structures used across the Accelerant platform.

---

## Color Palette

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Accelerant Blue | `#3B82F6` | Primary buttons, links, active states, icons |
| Accelerant Blue Hover | `#2563EB` | Button hover states |
| Accelerant Blue Light | `#EFF6FF` | Selected sidebar items, badge backgrounds |
| Accelerant Blue Border | `#BFDBFE` | Badge borders, focus rings |

### Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| Slate 900 | `#0F172A` | Primary headings, table text |
| Slate 600 | `#475569` | Secondary text, sidebar items |
| Slate 500 | `#64748B` | Descriptions, helper text |
| Slate 400 | `#94A3B8` | Placeholder text, icons |
| Slate 200 | `#E2E8F0` | Borders, dividers |
| Slate 100 | `#F1F5F9` | Badge backgrounds, hover states |
| Slate 50 | `#F8FAFC` | Page background |
| White | `#FFFFFF` | Cards, sidebar, header |

### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| Success Green | `#10B981` | Positive indicators, "Below expected" badges |
| Purple | `#7C3AED` | Technical/Insurer type badges |
| Emerald | `#059669` | Member type badges |

---

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale
| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page Title | `24px` (text-2xl) | Semibold (600) | Slate 900 |
| Section Header | `18px` (text-lg) | Semibold (600) | Slate 900 |
| Card Title | `16px` (text-base) | Semibold (600) | Slate 900 |
| Body Text | `14px` (text-sm) | Regular (400) | Slate 600 |
| Description | `14px` (text-sm) | Regular (400) | Slate 500 |
| Table Header | `12px` (text-xs) | Medium (500) | Slate 500, uppercase |
| Badge Text | `12px` (text-xs) | Medium (500) | Varies by type |
| Breadcrumb | `14px` (text-sm) | Regular (400) | Slate 500 |

### Letter Spacing
- Uppercase labels: `tracking-wider` (0.05em)
- Logo/Brand: `tracking-tight` (-0.025em)

---

## Spacing System

### Base Unit
`4px` — All spacing derives from multiples of 4

### Common Spacing Values
| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps, icon padding |
| `space-2` | 8px | Badge padding, small gaps |
| `space-3` | 12px | Sidebar item padding |
| `space-4` | 16px | Card padding, section gaps |
| `space-5` | 20px | Card internal padding |
| `space-6` | 24px | Section margins |
| `space-8` | 32px | Page padding, large gaps |

### Layout Dimensions
| Element | Value |
|---------|-------|
| Sidebar Width | `256px` (w-64) |
| Header Height | `57px` |
| Card Border Radius | `12px` (rounded-xl) |
| Button Border Radius | `8px` (rounded-lg) |
| Badge Border Radius | `9999px` (rounded-full) |
| Input Border Radius | `8px` (rounded-lg) |

---

## Component Patterns

### Header
```
- Background: White
- Border: 1px bottom, Slate 200
- Padding: 12px vertical, 24px horizontal
- Logo: Left-aligned, blue icon + semibold text
- Navigation: Right-aligned, 14px text, 24px gaps
- Avatar: 32px circle, blue background, white initials
```

### Sidebar
```
- Background: White
- Border: 1px right, Slate 200
- Width: 256px fixed
- Item Padding: 12px horizontal, 10px vertical
- Active State: Blue 50 background, Blue 700 text
- Inactive State: Slate 600 text, Slate 50 hover
- Section Divider: 1px Slate 200, 32px top margin
- Category Label: 12px uppercase, Slate 400, tracking-wider
```

### Cards
```
- Background: White
- Border: 1px Slate 200
- Border Radius: 12px
- Padding: 20px
- Shadow on Hover: shadow-md
- Transition: 150ms ease
```

### Data Tables
```
- Background: White
- Border: 1px Slate 200
- Border Radius: 12px (container only)
- Header Background: Slate 50
- Header Text: 12px uppercase, Slate 500
- Row Border: 1px Slate 100
- Row Hover: Slate 50 background
- Cell Padding: 16px horizontal, 20px vertical
```

### Buttons

#### Primary (Filled)
```
- Background: Accelerant Blue
- Text: White, 14px, Medium weight
- Padding: 8px vertical, 16px horizontal
- Border Radius: 8px
- Hover: Darker blue (#2563EB)
```

#### Secondary (Outlined)
```
- Background: Transparent
- Border: 1px Accelerant Blue
- Text: Accelerant Blue, 14px, Medium weight
- Padding: 8px vertical, 16px horizontal
- Border Radius: 8px
- Hover: Blue 50 background
```

### Badges/Pills

#### Type Badges
```
- Padding: 4px vertical, 8px horizontal
- Border Radius: 9999px (full)
- Border: 1px
- Font: 12px, Medium weight
```

| Type | Background | Text | Border |
|------|------------|------|--------|
| Member | Emerald 50 | Emerald 700 | Emerald 200 |
| Internal | Slate 50 | Slate 700 | Slate 200 |
| Insurer | Purple 50 | Purple 700 | Purple 200 |

#### Count Badges
```
- Background: Slate 100
- Text: Slate 600, 12px
- Padding: 2px vertical, 8px horizontal
- Border Radius: 9999px
```

### Search Input
```
- Background: White
- Border: 1px Slate 200
- Border Radius: 8px
- Padding: 10px vertical, 16px horizontal, 40px left (for icon)
- Icon: Slate 400, 16px, left-positioned
- Focus: 2px Blue ring, transparent border
```

### Charts & Visualizations

#### Bar Charts
```
- Bar Color: Accelerant Blue
- Bar Border Radius: 2px top corners
- Grid Lines: Slate 200, dashed for projections
- Axis Text: 12px, Slate 500
- Background: White
```

#### Trend Lines
```
- Actual Line: Solid, 2px, Blue or Purple
- Expected Line: Dashed, 2px, Teal/Cyan
- Data Points: 4px circles on hover
```

#### Loss Ratio Bars (Horizontal)
```
- Positive (favorable): Emerald 500
- Background Track: Slate 100
- Height: 8px
- Border Radius: 4px
```

---

## Layout Structures

### Page Layout
```
┌─────────────────────────────────────────────────────┐
│  Header (white, border-bottom)                      │
├──────────┬──────────────────────────────────────────┤
│          │  Breadcrumb                              │
│  Sidebar │  Page Title + Description                │
│  (white) │  Action Button (top-right)               │
│          │                                          │
│          │  Section Header + Count Badge            │
│          │  Search + View Toggle                    │
│          │                                          │
│          │  Content Grid/Table                      │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Dashboard Layout
```
┌─────────────────────────────────────────────────────┐
│  Filter Bar (horizontal pills/dropdowns)            │
├─────────────────────────────────────────────────────┤
│  Analytics Section Header                           │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌───────┐  ┌───────────┐ │
│  │  Primary Chart      │  │ KPI 1 │  │ KPI 2     │ │
│  │  (2/3 width)        │  │       │  │           │ │
│  │                     │  └───────┘  └───────────┘ │
│  └─────────────────────┘                           │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────┐│
│  │  Summary Card    │  │  Trend Chart             ││
│  │  (Loss Ratio)    │  │  (Full Width)            ││
│  └──────────────────┘  └──────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Comparative Analysis Layout
```
┌───────────┬───────────┬───────────┬───────────┐
│  Column 1 │  Column 2 │  Column 3 │  Column 4 │
│  Dropdown │  Dropdown │  Dropdown │  Dropdown │
├───────────┼───────────┼───────────┼───────────┤
│  Item     │  Item     │  Item     │  Item     │
│  27.3%    │  33.6%    │  33.6%    │  33.6%    │
│  ▓▓▓░░░   │  ▓▓▓▓░░   │  ▓▓▓▓░░   │  ▓▓▓▓░░   │
│  +0.20    │  +0.14    │  +0.14    │  +0.14    │
├───────────┼───────────┼───────────┼───────────┤
│  Item     │  Item     │  Item     │  Item     │
│  ...      │  ...      │  ...      │  ...      │
└───────────┴───────────┴───────────┴───────────┘
```

---

## Iconography

### Style
- Stroke-based icons (Lucide React style)
- Stroke width: 1.5px - 2px
- Size: 16px (small), 20px (medium), 24px (large)
- Color: Inherits from text color

### Common Icons
| Context | Icon |
|---------|------|
| Organizations | Grid/Building |
| Users | Users |
| Settings | Cog/Gear |
| Search | Magnifying Glass |
| Filter | Sliders |
| Expand | Chevron Right |
| External Link | Arrow Up Right |
| Add/Create | Plus |
| View Toggle | Grid / List |

---

## Interaction States

### Hover
- Cards: Elevate with `shadow-md`
- Table Rows: Background Slate 50
- Buttons: Darken background or add background
- Links: Darken text color

### Focus
- Inputs: 2px Blue ring, remove border color
- Buttons: 2px Blue ring offset

### Active/Selected
- Sidebar Items: Blue 50 background, Blue 700 text
- Tabs: Blue text, blue underline
- Toggle: Blue background

### Disabled
- Opacity: 50%
- Cursor: not-allowed

---

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 768px | Sidebar collapses, single column |
| Tablet | 768px - 1024px | Sidebar overlay, 2 column grid |
| Desktop | > 1024px | Full sidebar, 3-4 column grid |

---

## Animation & Transitions

```css
/* Default transition */
transition: all 150ms ease;

/* Hover shadow */
transition: box-shadow 150ms ease;

/* Color changes */
transition: color 150ms ease, background-color 150ms ease;
```

---

## Do's and Don'ts

### Do
- ✓ Use consistent 4px spacing increments
- ✓ Apply rounded-xl (12px) to cards
- ✓ Keep table headers uppercase and small
- ✓ Use subtle borders (Slate 200) not shadows for containers
- ✓ Maintain high contrast for primary actions

### Don't
- ✗ Use more than 2 font weights per view
- ✗ Apply shadows to static containers (reserve for hover)
- ✗ Use pure black (#000) for text
- ✗ Mix rounded corners (keep consistent radii)
- ✗ Add excessive spacing between related elements

---

*Reference: Accelerant Risk Exchange Platform — December 2025*
