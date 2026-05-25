# CareerFlow — Current UI Design Reference

This document describes the current visual design of CareerFlow as it exists today.
Use it as the baseline when asking Claude (or any AI) to redesign or retheme the app.

---

## 1. Design System Foundation

### Component Library
- **shadcn/ui** — the entire component set (Button, Card, Table, Dialog, Sheet, Badge, Dropdown, Input, Select, Tabs, Toast, Tooltip, Accordion, Calendar, Popover, etc.)
- **Radix UI** primitives underneath shadcn
- **Tailwind CSS v3** for all styling
- **tailwindcss-animate** for accordion / transition animations
- **lucide-react** for all icons

### Typography
- **Font:** Inter (Google Fonts, loaded via `next/font`)
- CSS variable: `--font-inter`
- Body: `font-sans antialiased`
- Custom size utilities:
  - `.text-14` → 14px / 20px line-height
  - `.text-16` → 16px / 24px
  - `.text-24` → 24px / 30px
  - `.text-26` → 26px / 32px
  - `.text-30` → 30px / 38px
- Page headers: `text-24 lg:text-30 font-semibold text-gray-900`
- Sub-headers: `text-14 lg:text-16 font-normal text-gray-600`

### Border Radius
- `--radius: 0.5rem` (base)
- `lg` = 0.5rem, `md` = 0.375rem, `sm` = 0.25rem

---

## 2. Color Tokens (CSS Variables)

All colors are HSL values consumed via `hsl(var(--token))`.

### Light Mode
| Token | HSL | Approximate Color |
|---|---|---|
| `--background` | `0 0% 100%` | Pure white |
| `--foreground` | `222.2 84% 4.9%` | Near-black (navy-tinted) |
| `--card` | `0 0% 100%` | White |
| `--primary` | `221.2 83.2% 53.3%` | Medium blue (~#3B82F6 / Tailwind blue-500) |
| `--primary-foreground` | `210 40% 98%` | Near-white |
| `--secondary` | `210 40% 96.1%` | Very light blue-gray |
| `--secondary-foreground` | `222.2 47.4% 11.2%` | Dark navy |
| `--muted` | `210 40% 96.1%` | Same as secondary |
| `--muted-foreground` | `215.4 16.3% 46.9%` | Medium gray |
| `--accent` | `210 40% 96.1%` | Same as secondary |
| `--destructive` | `0 84.2% 60.2%` | Red (~#EF4444) |
| `--border` | `214.3 31.8% 91.4%` | Light gray-blue border |
| `--input` | `214.3 31.8% 91.4%` | Same as border |
| `--ring` | `221.2 83.2% 53.3%` | Blue (matches primary) |

### Dark Mode
| Token | HSL | Approximate Color |
|---|---|---|
| `--background` | `222.2 84% 4.9%` | Very dark navy |
| `--foreground` | `210 40% 98%` | Near-white |
| `--primary` | `217.2 91.2% 59.8%` | Lighter blue |
| `--secondary` | `217.2 32.6% 17.5%` | Dark navy-gray |
| `--muted` | `217.2 32.6% 17.5%` | Same as secondary |
| `--muted-foreground` | `215 20.2% 65.1%` | Light gray |
| `--border` | `217.2 32.6% 23.5%` | Dark border |

### Chart Colors (Light)
| Token | Use |
|---|---|
| `--chart-1` | Orange-red (`12 76% 61%`) |
| `--chart-2` | Teal (`173 58% 39%`) |
| `--chart-3` | Dark slate (`197 37% 24%`) |
| `--chart-4` | Warm yellow (`43 74% 66%`) |
| `--chart-5` | Orange (`27 87% 67%`) |

### Hardcoded accent colors used in components
- Job status badges: `bg-cyan-500` (Applied), `bg-green-500` (Interview), `bg-red-500` (Expired/Rejected)
- Sidebar logo text: `text-blue-500`
- Loader spinner: `text-blue-500`
- Dashboard card title: `text-green-600`
- Delete actions: `text-red-600`
- Filter chips: `bg-primary/10 text-primary` with `hover:bg-primary/20`

---

## 3. Layout Architecture

### Overall Shell
```
<div class="flex min-h-screen w-full flex-col bg-muted/40">
  <Sidebar />                         ← fixed, 56px wide (w-14), left edge
  <div class="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-14">
    <Header />                        ← sticky top bar, h-14
    <GlobalActivityBanner />          ← optional banner below header
    <main class="lg:grid lg:grid-cols-3 xl:grid-cols-3 ...">
      {page content}                  ← 3-column grid on large screens
    </main>
  </div>
</div>
```

The main content area uses a **3-column CSS grid** on `lg`+ screens. Most pages span all 3 columns (`col-span-3`).

### Sidebar
- **Position:** Fixed, left edge, full viewport height
- **Width:** `w-14` (56px) — icon-only, no labels visible at this size
- **Background:** `bg-background` (white / dark navy)
- **Border:** `border-r` (right border only)
- **Icon size:** `h-5 w-5` for nav icons
- **Logo:** Briefcase icon in a `rounded-full bg-primary` circle (h-9 w-9)
- **Active state:** `border-b-2 border-black dark:border-white` under the icon — underline style, not background highlight
- **Hover state:** `hover:text-foreground` (color shift only)
- **Tooltip:** Labels appear as Radix tooltips on the right side on hover
- **Settings link:** Pinned to bottom of sidebar (`mt-auto`)
- **Mobile:** Sidebar is hidden (`sm:flex` — only shows on sm+). Mobile uses a Sheet drawer triggered by a hamburger button in the header.

### Header
- **Height:** `h-14` (56px)
- **Position:** `sticky top-0 z-30` on mobile; `sm:static sm:h-auto sm:border-0 sm:bg-transparent` on desktop (becomes transparent/non-sticky)
- **Contents (left to right):**
  1. Hamburger button (mobile only, `sm:hidden`) — opens Sheet drawer
  2. Title text: `"JobSync - Job Search Assistant"` (`font-semibold`)
  3. Spacer (`flex-1`)
  4. Profile dropdown (avatar + dropdown menu)
- **Background:** `bg-background` on mobile; transparent on desktop

### Mobile Drawer (Sheet)
- Opens from the left
- Contains same nav links as sidebar, with full text labels
- Links are `text-muted-foreground hover:text-foreground` with icon + label

---

## 4. Page-Level Patterns

### Auth Pages (Sign In / Sign Up)
- Centered card layout (`(auth)` route group)
- Card contains form fields (Email, Password)
- Uses `AuthCard` wrapper component
- Primary CTA: full-width blue Button (`w-full`)
- Error messages: `text-sm text-red-500` below form
- Password field has show/hide toggle (Eye/EyeOff icon)

### Dashboard Home
- **Top row:** 4-column grid of stat cards
  - "Dashboard" card (spans 2 cols) — quick-action buttons (New Job, New Task)
  - Number card toggle (Jobs 7d / 30d with trend)
  - Top Activities card
- **Charts row:** Bar chart with tab toggle (Jobs / Activities)
- **Side column:** Recent Jobs / Recent Activities toggle card
- **Bottom:** Activity calendar heatmap (Nivo `@nivo/calendar`) with year tabs

### My Jobs Page
- Full-width `Card` with `CardHeader` + `CardContent`
- Header contains: title, filter chips, search input, status filter select, Export button, Add Job button
- Table columns: Company Logo | Date Applied | Title | Company | Location | Status | Match% | Source | Actions
- Status displayed as colored `Badge` components
- Row actions in `DropdownMenu` (View, Edit, Add Note, Change Status sub-menu, Delete)
- Infinite scroll (IntersectionObserver sentinel)
- Records count + records-per-page selector at bottom

### Job Detail Page
- Multi-section layout with tabs or collapsible sections
- Sections: job info, notes, tags, cover letter, activity

### Profile / Resume Builder
- Structured form-based editor
- Sections: Contact Info, Work Experience, Education, Certifications, Summary, Other
- Cards per entry with Edit/Delete actions

### Settings Page
- Sidebar navigation within settings (`SettingsSidebar`)
- Sections: AI Settings, API Keys, Display, Integrations
- API key inputs use password-type inputs with last-4-digits masking

### Gmail Page
- Tab container (`GmailTabsContainer`)
- Thread list view with classification labels
- Needs Review queue for low-confidence classifications

### Gmail Page (detail)
- Unauthenticated empty state: `rounded-lg border bg-card p-6` with a CTA Button linking to Settings
- Connected state: header with email address + classifier type + last sync time, two-button action bar (Settings link, Sync now)
- Two tabs: **Needs Review** (default) and **All Threads** — `Tabs / TabsList / TabsTrigger / TabsContent`
- Thread rows: flat card list with `flex flex-col gap-2`
- Empty tab state: `rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground`
- Inline label correction via dropdown on each row
- Load more: centered outline Button at list bottom (no infinite scroll — explicit pagination)

### Settings Page (detail)
- Layout: `flex gap-8` — left sidebar nav + right content panel
- Settings sidebar: `w-48 shrink-0`, ghost buttons with `border-l-2` active indicator
  - Active: `border-l-primary bg-muted font-medium`
  - Inactive: `border-l-transparent hover:border-l-muted-foreground/25`
- Sections: AI Provider, API Keys, Integrations, Appearance
- Section content: `space-y-4` with `<h3 class="text-lg font-medium">` section heading + `text-sm text-muted-foreground` description
- Warning callout pattern: `rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm`
- Connected status badge: `bg-emerald-500 hover:bg-emerald-500` (hardcoded green, not from token system)
- Confidence threshold: Radix `Slider` with numeric display (`tabular-nums text-muted-foreground`)
- Excluded senders: raw `<textarea>` styled manually: `min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono`
- Inline code in prose: `<code class="mx-1 rounded bg-muted px-1">`

### Auth Page (detail)
- Outer wrapper: `mx-auto w-full max-w-md px-4` (no card — wraps everything)
- Branding block: `mb-8 text-center`, `<h1 class="text-3xl font-bold tracking-tight">JobSync</h1>`, subtitle `text-sm text-muted-foreground`
- Tab toggle: `flex rounded-xl border bg-muted p-1`, active pill `bg-background shadow-sm`, inactive `text-muted-foreground`
- Form card: `rounded-xl border bg-card p-6 shadow-sm`
- Form card heading: `text-xl font-semibold` + `text-sm text-muted-foreground` subtitle

---

## 5. Component Patterns

### Cards
```tsx
<Card>
  <CardHeader>
    <CardTitle>...</CardTitle>
    <CardDescription>...</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```
Cards have white background, subtle border (`border`), `rounded-lg` corners. Used for every major content block.

### Buttons
- Primary: `bg-primary text-primary-foreground` (blue)
- Outline: `border border-input bg-background hover:bg-accent`
- Ghost: transparent, `hover:bg-accent`
- Destructive: red
- Sizes: default, `sm` (`h-8`), `icon` (square)
- Full-width auth buttons: `w-full`
- Action bar buttons: `size="sm" className="h-8 gap-1"`

### Badges
- Default: dark background
- Secondary: muted gray
- Status-specific hardcoded: cyan (Applied), green (Interview), red (Rejected/Expired)
- Note count badge: secondary, small (`h-5 px-1.5 py-0`)

### Tables
- Standard shadcn `Table` with `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell`
- Responsive: many columns hidden below `md` with `hidden md:table-cell`
- Row hover from Tailwind's default table styles

### Forms
- react-hook-form + Zod validation
- shadcn `Form` / `FormField` / `FormItem` / `FormLabel` / `FormControl` / `FormMessage`
- Input + Label stacked vertically with `gap-4` between fields

### Dialogs / Sheets
- Radix `Dialog` for modals (Add Job, Add Note, etc.)
- Radix `Sheet` for drawers (mobile nav, details panels)

### Toasts
- shadcn `Toaster` (bottom of screen)
- Variants: `success` (green), `destructive` (red), default

### Dropdowns
- `DropdownMenu` for row actions and profile menu
- Sub-menus via `DropdownMenuSub` for status change

### Rich Text
- Tiptap editor (`TiptapEditor`) and viewer (`TipTapContentViewer`) for job descriptions, notes, cover letters

### Charts (Nivo)
- Bar chart: `@nivo/bar` — weekly jobs applied / activity time
- Calendar heatmap: `@nivo/calendar` — full-year activity view

### Empty States
Two patterns used throughout:
1. **Dashed border box**: `rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground` — used in Gmail thread list
2. **Plain centered text**: `text-center py-8 text-muted-foreground` — used in Tasks/Activities when list is empty

No illustrations or icons in empty states — plain text only.

### Loading States
- **Full-section spinner**: `<Loading />` component — a centered `Loader2` (or similar) with `animate-spin`
- **Inline spinner**: `<Loader2 className="h-4 w-4 animate-spin" />` inside buttons or next to text
- **Infinite scroll loader**: `<Loader className="h-5 w-5 animate-spin text-blue-500" />` in sentinel div
- **Skeleton**: not used — all loading states are spinners

### Warning / Info Callouts
- Yellow warning: `rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm`
- No success/info callout variants — only yellow warning exists
- Error messages: inline `text-sm text-red-500` below form fields, or destructive toast

### Global Activity Banner
- Sticky banner below the header when a timed activity is running
- `GlobalActivityBanner` component — shows current activity name + elapsed time + Stop button
- Uses `ActivityContext` for global state

---

## 6. Spacing & Density

- Dashboard shell padding: `px-5 sm:px-8 py-7 lg:py-12`
- Main content gap: `gap-4`, `md:gap-4`
- Card header padding: default shadcn (`p-6`, `pb-3` for compact headers)
- Table cell padding: default shadcn
- Sidebar nav gap: `gap-4` between icons, `px-2 sm:py-5`
- Form field gap: `gap-4` between fields, `gap-2` within a field group

---

## 7. Theme / Mode

- **System default** — follows OS preference
- Toggled via `next-themes` `ThemeProvider` with `attribute="class"` (adds `dark` class to `<html>`)
- All color tokens have both light and dark values in `globals.css`
- Currently **no theme toggle button in the UI** — it strictly follows system preference

---

## 8. Key Files to Edit for Redesign

| What to change | File |
|---|---|
| Color tokens (light + dark) | `src/app/globals.css` |
| Font | `src/app/layout.tsx` + `tailwind.config.ts` |
| Border radius base | `src/app/globals.css` (`--radius`) |
| Sidebar layout & styling | `src/components/Sidebar.tsx` |
| Sidebar nav link active/hover | `src/components/NavLink.tsx` + `src/app/globals.css` (`.navlink`) |
| Top header | `src/components/Header.tsx` |
| Dashboard shell layout | `src/app/dashboard/layout.tsx` |
| Dashboard page content | `src/app/dashboard/page.tsx` + dashboard components |
| Button variants | `src/components/ui/button.tsx` |
| Card styling | `src/components/ui/card.tsx` |
| Badge colors | `src/components/ui/badge.tsx` |
| Global body / base styles | `src/app/globals.css` |

---

## 9. What the Current Design Looks Like (Summary)

**Aesthetic:** Clean, minimal, corporate SaaS. Heavily influenced by the default shadcn/ui starter palette.

**Strengths of current design:**
- Consistent component library (shadcn everywhere)
- Good light/dark mode support
- Functional and dense — a lot of information on screen

**Weaknesses / things to improve:**
- Very generic — looks like every other shadcn app
- Primary blue is stock Tailwind blue-500, no brand identity
- Sidebar is icon-only with no expanded state — navigation is hard to discover
- Header title is plain text with no visual hierarchy
- Dashboard "Dashboard" card is a placeholder (green title, two plain outline buttons)
- No visual personality — could belong to any SaaS product
- Status badge colors are inconsistent (some hardcoded, some from the token system)
- No illustrations, no empty-state art, no branded loading states

---

## 10. Redesign Prompt Starter

Use this as a starting point when asking Claude to redesign:

> "I'm redesigning CareerFlow, a job application tracker built on Next.js + shadcn/ui + Tailwind CSS.
> The current design is a plain shadcn default theme. Here is the design reference: [paste this file].
>
> Please redesign [specific component / the whole app] with the following direction:
> [your aesthetic goal — e.g. 'a dark, modern fintech feel', 'warm and approachable like Notion', 'bold and colorful like Linear']
>
> Changes should target:
> - `src/app/globals.css` for color token overrides
> - `src/app/layout.tsx` for font changes
> - Individual component files listed in Section 8
>
> Keep the shadcn component structure intact. Only change Tailwind class names and CSS variable values."
