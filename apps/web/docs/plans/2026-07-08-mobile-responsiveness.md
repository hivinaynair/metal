# Mobile Responsiveness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the 4-page demo app usable on a 375px phone for a founder presentation.

**Architecture:** Targeted Tailwind class changes only — no structural rewrites. Key insight: the 3-panel home grid already stacks on mobile (no explicit `grid-cols` below `lg`). The real problems are (1) `SettlementScene` overflows and gets clipped, (2) tables are too wide, (3) title font is too large, (4) mobile nav has no active state.

**Tech Stack:** Next.js App Router, Tailwind v4, shadcn/ui Table

---

### Task 1: PageFrame — allow child scroll containers + shrink title

**Files:**
- Modify: `apps/web/components/page-chrome.tsx`

**Step 1: Make the change**

In `page-chrome.tsx`, two changes:

1. Line 15 — change `overflow-x-hidden` → `overflow-x-clip`
   - `overflow-x-clip` clips the container like `hidden` but does NOT prevent child elements from establishing their own scroll containers. This lets the SettlementScene have its own `overflow-x-auto` wrapper that actually works.

2. Line 40 — change `text-[34px]` → `text-[26px] sm:text-[34px]`
   - Title is too large on a 375px screen.

Before:
```tsx
<main
  className={cn(
    "metal-grid min-h-svh min-w-0 overflow-x-hidden px-4 py-[26px] sm:px-6 lg:px-[30px] lg:pb-11",
    className
  )}
>
```
```tsx
<h1 className="font-serif text-[34px] leading-[1.05] tracking-tight text-foreground">
```

After:
```tsx
<main
  className={cn(
    "metal-grid min-h-svh min-w-0 overflow-x-clip px-4 py-[26px] sm:px-6 lg:px-[30px] lg:pb-11",
    className
  )}
>
```
```tsx
<h1 className="font-serif text-[26px] leading-[1.05] tracking-tight text-foreground sm:text-[34px]">
```

**Step 2: Commit**
```bash
git add apps/web/components/page-chrome.tsx
git commit -m "fix(mobile): clip overflow, shrink title on mobile"
```

---

### Task 2: SettlementScene — scrollable on mobile

**Files:**
- Modify: `apps/web/components/settlement-scene.tsx` (line 240)
- Modify: `apps/web/app/page.tsx` (line 82)

**Step 1: Add min-width to SettlementScene**

In `settlement-scene.tsx` line 240, add `min-w-[620px]` to the outer `<section>`:

Before:
```tsx
<section className="settlement-pipeline settlement-pipeline-shadow overflow-hidden rounded-sm border border-accent/10 text-foreground">
```

After:
```tsx
<section className="settlement-pipeline settlement-pipeline-shadow min-w-[620px] overflow-hidden rounded-sm border border-accent/10 text-foreground">
```

**Step 2: Wrap SettlementScene in a scroll container in page.tsx**

In `app/page.tsx`, wrap `<SettlementScene .../>` (lines 82–123) in a div:

Before:
```tsx
      <SettlementScene
        agentLabel={selectedScenario.displayAgent}
```

After:
```tsx
      <div className="overflow-x-auto">
        <SettlementScene
          agentLabel={selectedScenario.displayAgent}
```

And close it after the `/>`:

Before:
```tsx
        />
      </SettlementScene closing context>

      <section className="grid ...
```

After:
```tsx
        />
      </div>

      <section className="grid ...
```

Exact diff for `page.tsx` lines 82–124:

```tsx
      <div className="overflow-x-auto">
        <SettlementScene
          agentLabel={selectedScenario.displayAgent}
          agentStatus={
            selectedAgent.status === "approved"
              ? "Trusted"
              : selectedScenario.title
          }
          agentReasoning={agentReasoning}
          amountLabel={
            result?.route.price ?? fallbackRouteForAgent(selectedAgent).price
          }
          routeLabel={
            result?.route.path ?? fallbackRouteForAgent(selectedAgent).path
          }
          mandateLimit={selectedAgent.mandateLimit}
          activeStep={activeStep}
          running={loading}
          approved={Boolean(approved)}
          rejectedReason={error}
          settlementTx={result?.settlementTxUrl}
          attestationTx={result?.attestationTxUrl}
          action={
            <Button
              size="lg"
              onClick={startRun}
              disabled={loading}
              className="border border-foreground bg-foreground text-background hover:bg-foreground/85"
            >
              {loading ? (
                <>
                  <Zap className="h-4 w-4 animate-pulse" />
                  Running
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run payment
                </>
              )}
            </Button>
          }
        />
      </div>
```

**Step 3: Commit**
```bash
git add apps/web/components/settlement-scene.tsx apps/web/app/page.tsx
git commit -m "fix(mobile): settlement scene scrollable on narrow viewports"
```

---

### Task 3: FeedTable — hide columns + enable scroll

**Files:**
- Modify: `apps/web/components/feed-table.tsx`

**Step 1: Make the table container scrollable**

Line 118 — change `overflow-hidden` → `overflow-x-auto`:

Before:
```tsx
      <div className="overflow-hidden">
```

After:
```tsx
      <div className="overflow-x-auto">
```

**Step 2: Hide Resource column on mobile**

TableHead for Resource (line 124):
```tsx
              <TableHead>Resource</TableHead>
```
→
```tsx
              <TableHead className="hidden sm:table-cell">Resource</TableHead>
```

TableCell for Resource (line 168):
```tsx
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    /api/trigger-payment
                  </TableCell>
```
→
```tsx
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    /api/trigger-payment
                  </TableCell>
```

**Step 3: Hide Identity column on mobile**

TableHead for Identity (line 126):
```tsx
                      <TableHead className="text-center">Identity</TableHead>
```
→
```tsx
                      <TableHead className="hidden text-center sm:table-cell">Identity</TableHead>
```

TableCell for Identity (lines 174–180):
```tsx
                  <TableCell className="text-center">
                    {row.identityStatus !== 0 ? (
                      <CheckCircle2 className="mx-auto size-4 text-positive" />
                    ) : (
                      <X className="mx-auto size-4 text-destructive" />
                    )}
                  </TableCell>
```
→
```tsx
                  <TableCell className="hidden text-center sm:table-cell">
                    {row.identityStatus !== 0 ? (
                      <CheckCircle2 className="mx-auto size-4 text-positive" />
                    ) : (
                      <X className="mx-auto size-4 text-destructive" />
                    )}
                  </TableCell>
```

**Step 4: Commit**
```bash
git add apps/web/components/feed-table.tsx
git commit -m "fix(mobile): feed table scrollable, hide secondary columns on mobile"
```

---

### Task 4: AgentsTable — mobile filter bar

**Files:**
- Modify: `apps/web/components/agents-table.tsx`

**Step 1: Make search full-width on mobile**

Line 186 — the search label has `max-w-[280px]`:

Before:
```tsx
        <label className="flex h-10 w-full max-w-[280px] items-center gap-3 rounded-sm border border-field-border bg-field px-4 text-sm text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
```

After:
```tsx
        <label className="flex h-10 w-full items-center gap-3 rounded-sm border border-field-border bg-field px-4 text-sm text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:max-w-[280px]">
```

**Step 2: Make status select full-width on mobile**

Line 195 — FilterSelect for status has `className="max-w-[236px]"`:

Before:
```tsx
          className="max-w-[236px]"
```

After:
```tsx
          className="sm:max-w-[236px]"
```

**Step 3: Make registration select full-width on mobile**

Line 201 — FilterSelect for registration has `className="max-w-[200px]"`:

Before:
```tsx
          className="max-w-[200px]"
```

After:
```tsx
          className="sm:max-w-[200px]"
```

**Step 4: Commit**
```bash
git add apps/web/components/agents-table.tsx
git commit -m "fix(mobile): agents filter bar full-width on mobile"
```

---

### Task 5: Mobile header — active link state

**Files:**
- Modify: `apps/web/components/app-shell.tsx`

**Step 1: Add active state to mobile nav links**

The mobile header nav (lines 102–111) renders all links with `className="whitespace-nowrap"` — no active state. The component already has `pathname` from `usePathname()`.

Before:
```tsx
          <nav className="ml-auto flex items-center gap-3 overflow-x-auto text-xs text-muted-foreground">
            {nav.slice(0, 4).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
```

After:
```tsx
          <nav className="ml-auto flex items-center gap-3 overflow-x-auto text-xs text-muted-foreground">
            {nav.slice(0, 4).map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap",
                    active ? "font-medium text-foreground" : ""
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
```

**Step 2: Commit**
```bash
git add apps/web/components/app-shell.tsx
git commit -m "fix(mobile): active state on mobile nav links"
```

---

## Verification

After all tasks, visit each page at 375px width (Chrome DevTools):
- `/` — title smaller, scene scrolls horizontally, panels stack, run button works
- `/feed` — table shows Time/Agent/Amount/Decision on mobile, Resource/Identity hidden
- `/agents` — filter bar inputs are full width
- `/policy` — should already work (xl:grid-cols-2 stacks below xl)
