# Mobile Responsiveness Design

**Date:** 2026-07-08
**Scope:** All 4 pages — `/`, `/feed`, `/agents`, `/policy`
**Target:** Phone (375px+)
**Approach:** Responsive Reflow (B)

## Context

App is desktop-only today. Being shown to a founder on mobile. Needs to look polished. Dark theme, Tailwind v4, Next.js App Router.

## Changes by Component

### 1. `PageHead` (`page-chrome.tsx`)
- Currently `flex items-end justify-between` — right-side content clips on mobile
- Change to `flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`
- Title font size: reduce from `text-[34px]` to `text-[26px] sm:text-[34px]`

### 2. Home page 3-panel grid (`app/page.tsx`)
- Bottom section: `grid lg:grid-cols-[minmax(360px,1.05fr)_minmax(420px,1fr)_320px]`
- Prefix with `flex flex-col gap-4 lg:grid` (drop `overflow-x-auto` on mobile)
- Panels stack vertically, each full width

### 3. `SettlementScene` (`settlement-scene.tsx`)
- Wrap in `w-full overflow-x-auto` container
- Scene itself has a min-width so it scrolls horizontally on narrow viewports rather than clipping

### 4. `FeedTable` (`feed-table.tsx`)
- Hide secondary columns on small screens: proof column → `hidden md:table-cell`, identity status → `hidden sm:table-cell`
- Keep visible: time, agent, amount, decision
- Filter tabs: wrap to scroll horizontally `overflow-x-auto whitespace-nowrap`

### 5. `AgentsTable` (`agents-table.tsx`)
- Hide on mobile: address, ERC-8004 ID, delegator columns → `hidden md:table-cell`
- Keep visible: name/status, mandate amount, expiry
- Search + filter row: `flex-col gap-2 sm:flex-row`

### 6. `PolicyWorkbench` (`policy-workbench.tsx`)
- Any side-by-side panel layout: `flex-col lg:flex-row`
- Ensure selects and rule rows are full-width on mobile

### 7. App Shell mobile header (`app-shell.tsx`)
- Already exists; verify nav links don't overflow — add `overflow-x-auto` to nav row if needed

## What We're NOT Doing
- No tab switcher for the 3-column home panels (that's approach C)
- No custom mobile settlement visualization
- No full card rewrite of tables (just column hiding)
