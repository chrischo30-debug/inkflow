# Design System Strategy: The Curated Gallery

## 1. Overview & Creative North Star
This design system is built upon the Creative North Star of **"The Curated Gallery."** In the world of high-end tattooing, the interface must act as a silent, sophisticated frame that elevates the artist's portfolio while maintaining the surgical precision of a professional booking engine. 

We are moving away from the "grid-of-boxes" template. Instead, this system utilizes **Intentional Asymmetry** and **Editorial Spacing**. By leveraging generous whitespace and high-contrast typography scales, we create a layout that feels less like a database and more like a premium lifestyle magazine. The experience should feel bespoke, tactile, and effortless.

## 2. Colors: Tonal Depth & The Accent
The palette is rooted in a sophisticated "Warm Charcoal and Bone" foundation, punctuated by a singular, visceral red (`primary: #780009`).

### The "No-Line" Rule
To achieve a high-end editorial feel, **1px solid borders are strictly prohibited for sectioning.** We define boundaries through tonal shifts rather than structural lines. For example, a sidebar should be defined by a shift from `surface` to `surface_container_low`, not a stroke. This creates a more organic, seamless visual flow.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, premium materials. Use the `surface_container` tiers to define depth:
*   **Base Layer:** `surface` (#fcf9f8) for the main canvas.
*   **Secondary Sections:** `surface_container_low` (#f6f3f2) for sidebar or background navigation.
*   **Active Content Cards:** `surface_container_lowest` (#ffffff) to provide a soft "pop" against the background.
*   **Nesting:** When placing an element inside a card, use `surface_container_high` (#eae7e7) to create a "recessed" or "inset" feel.

### The "Glass & Gradient" Rule
For floating elements like modals or mobile navigation, apply a semi-transparent `surface` color with a `backdrop-blur` of 20px. To give the deep red accent "soul," use a subtle linear gradient from `primary` (#780009) to `primary_container` (#9b1b1b) at a 135-degree angle. This prevents the color from looking "flat" and adds a dimension of luxury.

## 3. Typography: Editorial Authority
We pair the architectural strength of **Epilogue** for headers with the clean, modernist legibility of **Manrope** for functional data.

*   **Display & Headlines (Epilogue):** These are the "Artistic" voice. Use `display-lg` for hero booking stats or the artist's name. The generous scale conveys confidence.
*   **Body & Labels (Manrope):** These are the "Professional" voice. Use `body-md` for tattoo descriptions and `label-md` for timestamps and metadata. 
*   **Hierarchy Tip:** Always lean into high-contrast sizing. A `display-sm` header paired with a `label-md` sub-header creates an editorial rhythm that feels more intentional than standard sizing.

## 4. Elevation & Depth: The Layering Principle
Depth is achieved through **Tonal Layering** rather than traditional drop shadows.

*   **Natural Lift:** Instead of shadows, place a `surface_container_lowest` card on a `surface_container_low` background. This creates a soft, tactile lift that mimics fine stationery.
*   **Ambient Shadows:** If a floating element (like a context menu) requires a shadow, use a large blur (32px+) with a very low opacity (4%-6%). Tint the shadow with `on_surface` (#1c1b1b) rather than pure black to keep the lighting natural.
*   **The "Ghost Border":** If accessibility requires a container boundary, use the `outline_variant` (#e1bfbb) at 15% opacity. This "Ghost Border" provides a hint of structure without interrupting the minimalist flow.

## 5. Components

### Buttons
*   **Primary:** High-gloss gradient (Primary to Primary Container). Use `xl` (1.5rem) roundedness for a soft, premium feel. Text is `on_primary` (#ffffff).
*   **Secondary:** Ghost style. No background, use `on_surface` text with a `label-md` weight.
*   **Tertiary:** `surface_container_highest` background with `on_surface_variant` text.

### Cards & Lists
*   **Rule:** Forbid the use of divider lines.
*   **Implementation:** Use vertical whitespace (1.5rem to 2rem) to separate list items. For dashboard cards, use the `surface_container_lowest` fill. 
*   **Interaction:** On hover, a card should shift from `surface_container_lowest` to `surface_bright` with a subtle ambient shadow.

### Input Fields
*   **Visual Style:** Use a "Minimalist Inset" look. A background of `surface_container_high` with a bottom-only "Ghost Border."
*   **Typography:** Labels must use `label-md` in `on_surface_variant` to keep the focus on the user's input.
*   **Error State:** Use `error` (#ba1a1a) for the bottom border and helper text, but keep the input background consistent to avoid "vibrating" color shifts.

### Chips (Tattoo Styles/Tags)
*   **Design:** Use `full` roundedness. A background of `secondary_container` with `on_secondary_container` text. This provides a soft, approachable way to categorize "Black & Grey," "Traditional," or "Fine Line" styles.

### Special Component: The Portfolio Preview
*   An asymmetrical image container using `lg` (1rem) rounded corners. Use a `surface_dim` placeholder to maintain the minimalist aesthetic while images load.

## 6. Do's and Don'ts

### Do:
*   **DO** use whitespace as a functional tool. If an interface feels cluttered, increase the padding between sections rather than adding a border.
*   **DO** align text to a strict baseline, but allow images and cards to sit offset for an "art-book" feel.
*   **DO** use the deep red accent sparingly. It should act as a "call to action" or a "point of interest," not a dominant background color.

### Don't:
*   **DON'T** use 100% black. Use `on_surface` (#1c1b1b) for text to maintain a softer, high-end contrast.
*   **DON'T** use standard "Material Design" shadows. They are too aggressive for this aesthetic. Stick to Tonal Layering.
*   **DON'T** cram information. If a dashboard view has more than five primary data points, move the secondary data to a "recessed" `surface_container` layer.

---

## 7. Raw Tokens Reference

### Typography
- **Headline Font:** Epilogue
- **Body Font:** Manrope
- **Label Font:** Manrope

### Color Palette (Light Theme)
- `background`: #fcf9f8
- `surface`: #fcf9f8
- `surface_bright`: #fcf9f8
- `surface_dim`: #dcd9d9
- `surface_tint`: #b12c28
- `surface_container`: #f0eded
- `surface_container_low`: #f6f3f2
- `surface_container_lowest`: #ffffff
- `surface_container_high`: #eae7e7
- `surface_container_highest`: #e5e2e1
- `surface_variant`: #e5e2e1
- `on_surface`: #1c1b1b
- `on_surface_variant`: #59413e
- `inverse_surface`: #313030
- `inverse_on_surface`: #f3f0ef

#### Primary
- `primary`: #780009
- `primary_container`: #9b1b1b
- `on_primary`: #ffffff
- `on_primary_container`: #ffaca3
- `inverse_primary`: #ffb4ac

#### Secondary
- `secondary`: #944841
- `secondary_container`: #ff9f96
- `on_secondary`: #ffffff
- `on_secondary_container`: #79332e

#### Tertiary
- `tertiary`: #003b5e
- `tertiary_container`: #005381
- `on_tertiary`: #ffffff
- `on_tertiary_container`: #8dc6fb

#### Utility/Error
- `error`: #ba1a1a
- `error_container`: #ffdad6
- `on_error`: #ffffff
- `on_error_container`: #93000a
- `outline`: #8d706d
- `outline_variant`: #e1bfbb

### Structural Tokens
- **Corner Roundness:** ROUND_EIGHT (8px base)
- **Spacing Scale:** 3 (Base unit)
