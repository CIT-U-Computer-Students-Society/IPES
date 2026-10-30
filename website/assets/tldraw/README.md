# tldraw Visual Annotation Workflow for IPES

This directory maintains the source `.tldr` vector files used to annotate IPES user interface screenshots for the official documentation portal.

---

## Why tldraw?
- **Vector-based**: Shapes, arrows, text callouts, and numbered badges retain their vector properties and can be edited indefinitely.
- **Maintainable**: When the IPES UI evolves, developers can simply swap the background screenshot layer and re-align arrows in seconds, rather than recreating graphics from scratch.
- **Open Standards**: `.tldr` files are standard JSON schemas compatible with [tldraw.com](https://www.tldraw.com).

---

## Standard Annotation Guidelines

1. **Numbered Badges**:
   - Primary user action sequence: Numbers `(1)`, `(2)`, `(3)`.
   - Primary color: Electric Violet (`#8B5CF6`) for actions, Amber (`#F59E0B`) for critical inputs/proof, Cyan (`#06B6D4`) for metric cards.
2. **Directional Arrows**:
   - Use clean curved or straight arrows pointing directly to the target UI element.
   - Match arrow color to the corresponding numbered badge.
3. **Bounding Boxes**:
   - Highlight important form fields or table rows with a 2px-to-2.5px rounded rectangle.

---

## How to Edit or Add Annotations

1. Go to [https://www.tldraw.com](https://www.tldraw.com).
2. Click **Menu &rarr; Open** and select any `.tldr` file in this directory.
3. Make your adjustments or import a new screenshot from `website/public/images/raw/`.
4. Click **Menu &rarr; Save As** to overwrite the `.tldr` file here.
5. Click **Menu &rarr; Export &rarr; SVG / PNG** to save the updated asset into `website/public/images/annotated/`.
