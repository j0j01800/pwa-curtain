# Implementation Plan: Inner Sheer 3x Fullness Support

## Problem Summary
Currently, the **Inner Sheer Layer** defaults to the `Roflet` style. Under the existing implementation:
1. When `style` is set to `Roflet (2.5 lock)` or `STAMP (2.5 lock)`, the Fullness dropdown is disabled and locked to `2.5×`.
2. Both `index.html` (`layerFullness`) and `src/engine.ts` (`fullness`) hardcode `if (l.style === 'roflet' || l.style === 'stamp') return 2.5`, preventing inner sheers from using `3.0×` fullness.
3. In curtain fabrication, inner sheer fabrics are frequently made with `3.0×` fullness to achieve richer, denser folds.

The user clarified that they want the **3× (`3.0×`) option** available and selectable for the **Inner Sheer Layer** in the fullness dropdown, rather than being locked to 2.5×.

---

## Proposed Changes

### 1. `src/engine.ts`
- Update `fullness(l: LayerState): number` so that:
  - If `l.fullness === 3.0`, it returns `3.0` even for `roflet` (or specifically for inner sheer).
  - STAMP remains standard `2.5` unless explicitly overridden.
  - Default remains `2.5` when not specified.

### 2. `index.html`
- **UI Dropdown Unlock for Inner Sheer:**
  - Update the Fullness select in the Layer Card (`line ~3435`):
    - For `inner` sheer layers (or when `style === 'roflet'`), ensure the Fullness `<select>` is **enabled** so the user can freely choose between `2.5×` and `3.0×`.
  - Update the Style label:
    - Display `Roflet` (or show `Roflet (2.5×)` / `Roflet (3.0×)`) so it does not permanently say `(2.5 lock)`.
- **Calculation Logic (`layerFullness`):**
  - Update `layerFullness(l)` in `index.html` to respect `Number(l.fullness) === 3.0 ? 3.0 : 2.5` for inner sheer and roflet.
- **Workshop Cutting Sheet & Quotes:**
  - Ensure the workshop cutting sheet and quotation descriptions reflect the selected fullness (e.g. `Inner: roflet (3×)`).

### 3. Tests & Verification
- **Unit Tests (`src/engine.test.ts`):**
  - Add test verifying that an inner sheer layer with `style: 'roflet'` and `fullness: 3.0` calculates fabric requirements with 3.0× fullness instead of falling back to 2.5×.
  - Verify outer drape pinch pleat and stamp behaviors remain untouched.
- **Compilation & Lint:**
  - Run `compile_applet` and `lint_applet` to confirm zero errors.
- **Browser Verification:**
  - Verify in the UI that selecting `3.0×` for Inner Sheer:
    - Successfully toggles the fullness.
    - Accurately increases required sheer fabric meters by 20% (from $2.5 \times \text{width}$ to $3.0 \times \text{width}$).
    - Updates quote totals, cutting sheets, Proforma Invoice, and PCalc($) seamlessly.
