---
name: ux-design-principles
description: >-
  Apply UX Pilot's 19 Web Design Principles and Jon Yablonski's Laws of UX when
  designing, auditing, building, or reviewing web user interfaces, components,
  page layouts, and interaction flows. Covers usability heuristics, Gestalt visual
  perception, cognitive psychology, accessibility, and high-converting UI patterns.
---

# UX Design Principles & Laws of UX

A practical, actionable engineering guide synthesizing **UX Pilot's Web Design Principles** and Jon Yablonski's **Laws of UX**. Use this skill whenever designing, reviewing, refactoring, or evaluating web user interfaces, responsive layouts, forms, and product flows.

---

## 1. Usability & Interaction Heuristics (Laws of UX)

### Jakob's Law
* **Principle**: Users spend most of their time on other sites. They expect your product to work like the products they already know.
* **Implementation**:
  * Adopt standard web conventions (e.g., logo top-left returns home, shopping cart or profile top-right, standard search bar placement).
  * Avoid reinventing fundamental UI controls (e.g., custom dropdowns or non-standard scrolling).

### Fitts's Law
* **Principle**: The time to acquire a target is a function of the distance to and size of the target.
* **Implementation**:
  * Interactive targets must be at least **44x44px** (touch devices) or **32x32px** (desktop).
  * Place primary actions within easy reach (bottom navigation on mobile, sticky action bars).
  * Expand clickable touch areas beyond visual borders when necessary (padding on icon buttons).

### Hick's Law
* **Principle**: The time it takes to make a decision increases logarithmically with the number and complexity of choices.
* **Implementation**:
  * Limit primary navigation links to 5–7 top-level items.
  * Restrict each viewport to **one primary Call to Action (CTA)**.
  * Break complex multi-step processes (forms, onboarding) into bite-sized sequential steps (progressive disclosure).

### Miller's Law
* **Principle**: The average person can hold only $7 \pm 2$ items in their working memory.
* **Implementation**:
  * Chunk related information into structured groups (e.g., phone numbers, segmented data tables, distinct cards).
  * Do not force users to remember information across different screens or modal dialogues.

### Doherty Threshold
* **Principle**: Productivity peaks when human-computer interaction occurs at a pace under **400ms**, ensuring neither waits on the other.
* **Implementation**:
  * Provide visual feedback within 100ms of any user interaction (button press states, hover feedback).
  * For tasks taking $>400\text{ms}$, display skeleton loaders or instant optimistic UI updates rather than blocking screens.

### Postel's Law (Robustness Principle)
* **Principle**: Be liberal in what you accept, and strict in what you produce.
* **Implementation**:
  * Accept flexible user input formats (e.g., phone numbers with or without dashes, dates in various common formats).
  * Sanitize and format data predictably on the backend and in the UI.

### Tesler's Law (Conservation of Complexity)
* **Principle**: Every system has an inherent amount of complexity that cannot be eliminated, only transferred—either to the user or into the software.
* **Implementation**:
  * Relieve users from cognitive burden by using smart defaults, location inference, autofill, and calculated values.

### Parkinson's Law
* **Principle**: Any task expands to fill the time allotted to it.
* **Implementation**:
  * Eliminate unnecessary input fields and steps to help users complete goals faster than expected.

---

## 2. Gestalt Principles for Visual Structure

### Law of Proximity
* Elements placed close together are perceived as belonging together.
* Use tighter spacing ($4\text{px}$–$8\text{px}$) between labels and their input fields, and larger spacing ($16\text{px}$–$32\text{px}$) between distinct form sections.

### Law of Common Region
* Elements enclosed within a visible boundary (cards, panels, modals) are perceived as grouped.
* Group related metrics, form fields, or cards inside a single container with a clear border or distinct surface fill.

### Law of Similarity
* Elements that look alike are perceived to perform the same function.
* Keep styles identical for identical roles: all primary action buttons must share one style; secondary actions another; status badges must maintain identical shapes and typography.

### Law of Uniform Connectedness
* Elements visually connected by lines, arrows, or frames are perceived as more strongly related than non-connected elements.
* Use breadcrumbs, timeline connectors, stepper progress lines, and connected tree views to indicate sequence or hierarchy.

### Law of Prägnanz & Closure
* Humans perceive complex visuals in their simplest, most stable form, and will mentally fill in missing information.
* Use familiar iconography and simple geometries; avoid cluttered decorations that introduce ambiguity.

### Law of Common Fate
* Elements moving in the same direction or synchronizing transitions are perceived as related.
* Synchronize slide-in animations, drawer transitions, and accordion collapses.

---

## 3. Cognitive Biases & User Behavior

### Aesthetic-Usability Effect
* Users perceive visually polished designs as more usable and are more forgiving of minor usability hiccups.
* Maintain clean typography, consistent spacing tokens, and subtle micro-interactions.

### Von Restorff Effect (Isolation Effect)
* When multiple similar items are present, the one that visually differs is remembered best.
* Make your primary CTA distinctly stand out (e.g., vibrant brand fill) while secondary actions use outline or ghost styles. Highlight recommended pricing tiers or preferred options.

### Serial Position Effect
* Users remember the first and last items in a series best (Primacy & Recency effects).
* Place the most critical features or navigation links at the start and end of navigation bars, lists, and landing page sequences.

### Goal-Gradient Effect
* Motivation accelerates as people approach a goal.
* Show clear progress indicators (e.g., "Step 3 of 4", percentage completion bars, reward trackers).

### Zeigarnik Effect & Peak-End Rule
* Incomplete tasks are remembered better than finished ones; user impressions are dominated by the emotional peak and the final interaction.
* Highlight incomplete profiles or drafts with polite reminders. Craft celebratory, polished final confirmation states (success modals, receipts, completion banners).

---

## 4. UX Pilot 19 Web Design Principles

1. **Clarity and Simplicity**: Remove non-essential UI clutter. Keep views focused on the user's primary goal.
2. **Visual Hierarchy**: Guide the eye naturally using scale, contrast, weight, and position (H1 $\rightarrow$ H2 $\rightarrow$ Body $\rightarrow$ CTA).
3. **Intentional Navigation**: Keep menus concise, search accessible, and paths obvious to minimize time-to-task.
4. **Grid-Based Layouts**: Align content to an 8pt spatial system and responsive column grids (e.g., 4 columns on mobile, 12 on desktop).
5. **Generous White Space**: Use negative space intentionally around headers, text blocks, and containers to improve scanning and reduce fatigue.
6. **Frictionless Interaction**: Eliminate extra clicks, unnecessary confirmations, and redundant form inputs.
7. **Accessibility & Inclusivity**: Ensure WCAG AA/AAA compliance: minimum $4.5:1$ contrast ratio for normal text, semantic HTML tags, keyboard navigability (`:focus-visible`), and ARIA attributes.
8. **Mobile-First Design**: Design and verify for mobile viewports first ($360\text{px}$–$390\text{px}$) before expanding to desktop breakpoints.
9. **Visual Balance**: Balance layout weight symmetrically or dynamically across central axes without lopsided whitespace.
10. **Purpose-Driven Design**: Every visual asset, icon, card, or micro-interaction must serve a concrete functional or informational purpose.
11. **Consistent Branding & Tokens**: Maintain uniform spacing scales, typography scales (e.g., 12, 14, 16, 20, 24, 32, 48px), and corner radii.
12. **Content Structure & Scannability**: Use descriptive headings, short bulleted lists, and highlighted takeaways.
13. **Readability**: Limit body line length to 50–75 characters; set line-height to $1.4$–$1.6$; avoid walls of text.
14. **Responsive Media**: Serve responsive, optimized assets with proper aspect-ratio boxes to prevent layout shifts (CLS).
15. **Color Strategy ("Color by Role")**: Map colors strictly to UI roles:
    * *Brand/Primary*: Key interactions & main CTAs.
    * *Secondary/Neutral*: Surfaces, borders, text, and muted icons.
    * *Semantic*: Success (green), Alert (amber), Error (red), Info (blue). Never use color as the sole indicator of state.
16. **Contrast and Legibility**: Ensure sharp distinction between foreground and background elements under various lighting conditions.
17. **Load Time & Performance**: Target sub-second initial loads, sub-400ms interactions, zero layout shifts, and optimized bundle sizes.
18. **Scanning Patterns (F & Z Patterns)**:
    * Use the **Z-Pattern** for landing pages with clear hero headings, visual anchors, and a bottom-right CTA.
    * Use the **F-Pattern** for content-heavy pages, dashboards, and search results by front-loading meaning on the left.
19. **Predictable States & Feedback**: Define explicit states for every interactive component: Default, Hover, Active, Focus, Loading, Disabled, and Error.

---

## 5. UI/UX Verification Checklist

When building or reviewing any screen or component in RoomSync, verify against this checklist:

- [ ] **Single Focus**: Is there exactly one obvious primary action per view?
- [ ] **Touch & Click Targets**: Are all interactive elements at least 44x44px (mobile) or 32x32px (desktop)?
- [ ] **Contrast**: Do all text and vital UI elements meet WCAG AA ($4.5:1$ for text, $3:1$ for UI components)?
- [ ] **Grouping**: Are related fields enclosed or spaced closely together (Proximity & Common Region)?
- [ ] **Speed & Feedback**: Does clicking an action provide immediate visual confirmation within 100ms?
- [ ] **Scanning**: Can a user understand the value and primary action in a 5-second scan?
- [ ] **Graceful Input**: Are input fields forgiving and accompanied by inline, helpful validation?
- [ ] **Predictable Navigation**: Can the user easily retreat, cancel, or navigate back without losing data?
