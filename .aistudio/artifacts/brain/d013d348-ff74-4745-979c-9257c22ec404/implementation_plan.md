# iPhone 8 Mobile Adaptation & Progressive Web App (PWA) Implementation Plan

Transform the production-grade Curtain Studio Quote Calculator into an iPhone 8-compatible, touch-ergonomic Progressive Web App (PWA) with full offline support and GitHub-ready deployment, without removing or disrupting any existing workshop calculation algorithms, cutting sheet logic, or invoice generators.

## User Review & Critical Decisions

> [!IMPORTANT]
> The implementation strictly preserves 100% of the desktop experience (3-column layout, worked examples, proforma invoices, KETEL math, and PDF generation) while introducing responsive touch ergonomics for iPhone 8 screens (375px width, 667px height, Retina @2x, iOS Safari).

- **Confirmed Decision 1 (Navigation)**: On iPhone 8 and mobile screens, implement a fixed bottom navigation tab bar with three primary tabs:
  - **🪟 Windows / Editor**: Active window inputs, Counter Express bar, layer configurations, and visual KETEL arithmetic.
  - **📋 Quote Summary**: Real-time totals, 7-item breakdown, project savings, approval checklist, and proforma preview/print triggers.
  - **📁 Orders & Presets**: Multi-window manager, add/duplicate/remove window, quick worked examples (Normal, KETEL, Hem, Railroad), save/load drafts, and Shop Settings.
  - *On desktop screens ($\ge 960\text{px}$)*: The desktop 3-column split view remains active automatically.
- **Confirmed Decision 2 (Offline & GitHub Readiness)**: Standard PWA implementation with standalone `manifest.json`, resilient `service-worker.js` with Cache-First asset handling and Stale-While-Revalidate network caching, and relative path resolution so it runs smoothly on GitHub Pages, custom domains, or local hosts.
- **Confirmed Decision 3 (iOS Home Screen Installation)**: Apple Web App tags (`apple-mobile-web-app-capable`, `apple-touch-icon.png`, status bar styles) and a non-intrusive manual installation helper modal accessible via an "Install PWA" trigger, allowing effortless Add-to-Home-Screen on iOS Safari.
- **Confirmed Decision 4 (Inner Sheer & Roflet Fullness)**: Unlocked the Inner Sheer / Roflet layer from being forced to 2.5× fullness. Users can now choose either 2.5× or 3.0× fullness for both Pinch Pleat and Roflet styles.

---

## 1. Overview & Core Concept

- **What It Does**: Enables curtain workshop estimators, interior designers, and tailors to compute precise curtain fabric requirements, KETEL extensions, hardware, and customer quotes on-site directly from their iPhone 8 or mobile device, even without an active internet connection.
- **Target Audience / Persona**: On-site curtain measurers, shop owners, and workshop tailors working in the field or in the shop using handheld smartphones.
- **Key Value**: Delivers counter-speed calculations in the palm of your hand on compact 375px screens without cramped text, horizontal clipping, or accidental zoom jitters, while keeping the complete desktop workstation interface intact.

---

## 2. User Experience & Visual Design

### Mobile Layout & Thumb-Zone Ergonomics (iPhone 8: 375px × 667px)
- **Top Header Bar**:
  - Compact sticky header ($52\text{px}$) with brand wordmark and quick draft indicator.
  - Customer name and currency inputs reflow into an ergonomic mobile header bar with clean touch spacing.
- **Bottom Navigation Tab Bar**:
  - Pinned to the bottom viewport with `env(safe-area-inset-bottom)` support.
  - 3 ergonomic thumb tabs with high-contrast active indicator:
    - **Windows** (Active Window Editor)
    - **Quote** (Cost breakdown & Total)
    - **Orders** (Window list & Shop Settings)
  - Height: $56\text{px}$, minimum touch target $\ge 44 \times 44\text{px}$ per tab to prevent mis-taps.
- **Mobile Input Optimization**:
  - Set `font-size: 16px` on form controls (`input`, `select`) on mobile viewports to eliminate iOS Safari's disruptive auto-zoom behavior on focus.
  - Touch-friendly numeric keypad activation with `inputmode="decimal"` and `inputmode="numeric"`.
  - Generous card padding ($12\text{px}$–$16\text{px}$) and clear typographic separators for calculations.
- **Modal Adaptations**:
  - Fullscreen bottom-sheet modal on mobile for the Proforma Invoice and Cutting Sheet preview, with sticky print and PDF buttons anchored to the bottom.

---

## 3. Technical Architecture & Component Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│                        iPhone 8 / Mobile View                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Top Header: Curtain Studio [ETB] [Draft Autosaved]               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Active Tab Content (Single Panel Visible on 375px Viewport):    │  │
│  │                                                                  │  │
│  │  [Tab 1: Windows / Editor]    [Tab 2: Quote]    [Tab 3: Orders]  │  │
│  │  • Window 1 (Living Room)     • 7-Item Table    • Window List    │  │
│  │  • Express Entry (W/H/Price)  • Subtotals       • + Add Window   │  │
│  │  • KETEL Visual Math          • Grand Total     • Presets Grid   │  │
│  │  • Hardware & Fold Sliders    • Print/PDF CTAs  • Shop Settings  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Fixed Bottom Navigation Bar (48px+ targets, thumb-friendly):     │  │
│  │    [🪟 Windows]            [📋 Quote]            [📁 Orders]    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Progressive Web App (PWA) Architecture
1. **Web App Manifest (`public/manifest.json`)**:
   - `id`: `/`
   - `name`: `Curtain Studio · Quote Calculator`
   - `short_name`: `CurtainQuote`
   - `start_url`: `.` (ensures relative compatibility for GitHub Pages subpaths like `/curtain-quote/`)
   - `scope`: `.`
   - `display`: `standalone`
   - `theme_color`: `#214f40`
   - `background_color`: `#f5f4ef`
   - Icons: Standard PNG assets at 192x192, 512x512, and maskable formats.
2. **Service Worker (`public/service-worker.js`)**:
   - Pre-caches core application shell (`index.html`, default assets, fonts, icons).
   - Stale-While-Revalidate caching strategy for static resources.
   - Offline fallback guarantees that the calculator, drafts, and print views function completely without an internet connection.
3. **PWA Assets & Apple Touch Configuration**:
   - `apple-touch-icon.png` (180x180 PNG for iOS home screens).
   - `pwa-192x192.png` & `pwa-512x512.png`.
   - Apple meta tags in `<head>`: `apple-mobile-web-app-capable="yes"`, `apple-mobile-web-app-status-bar-style="default"`, and `apple-mobile-web-app-title="CurtainStudio"`.
   - Viewport meta: `width=device-width, initial-scale=1.0, viewport-fit=cover`.

---

## 4. Key Steps for Execution

1. **PWA Assets Generation**:
   - Create crisp, high-resolution brand icons in `public/` (`apple-touch-icon.png`, `pwa-192x192.png`, `pwa-512x512.png`, `icon.svg`).
2. **Manifest & Service Worker Implementation**:
   - Create `public/manifest.json` configured for standalone PWA launching.
   - Create `public/service-worker.js` with comprehensive offline caching and lifecycle events (`install`, `activate`, `fetch`).
3. **Index.html Enhancements**:
   - Link `manifest.json`, iOS touch icons, and meta tags in `<head>`.
   - Register the Service Worker gracefully with an offline-ready status indicator.
   - Add mobile viewport CSS with media queries for screens $\le 900\text{px}$ (iPhone 8 375px):
     - Convert `#app-shell` from 3 columns to mobile single-panel view controlled by the bottom tab bar.
     - Add fixed bottom navigation bar (`#mobile-nav-bar`) with active tab state switching.
     - Ensure all tap targets are at least $44\text{px}$ high.
     - Prevent iOS auto-zoom by enforcing $16\text{px}$ input font size on mobile screens.
     - Add non-intrusive iOS Safari Add-to-Home-Screen guide modal.
4. **Verification & Testing**:
   - Verify layout on 375px width (iPhone 8 viewport dimensions).
   - Verify service worker registration and offline capabilities.
   - Run compilation and lint checks to ensure zero regressions.
