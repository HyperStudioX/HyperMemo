# HyperMemo Frontend Design Style Guide

This guide defines the visual language, design tokens, and UI patterns for the HyperMemo frontend to ensure consistency and a premium user experience.

## Design Principles

- **Clean & Focused**: Minimalist layouts that prioritize user content and memory recall.
- **Memory-centric**: Visual metaphors (like the brain constellation) that reinforce the tool's core purpose.
- **Premium Aesthetics**: High-quality typography, smooth transitions, and a curated color palette.
- **High Contrast**: Ensuring readability and accessible interaction states across themes.

---

## Design Tokens

### Colors

HyperMemo uses a specialized Teal-based primary palette with Amber accents for highlights.

#### Light Mode
- **Primary**: `#0d9488` (Teal) - Core actions and branding.
- **Primary Hover**: `#0f766e`
- **Accent**: `#f59e0b` (Amber) - Special highlights, AI processing, and success indicators.
- **Background Main**: `#fefdfb` - Warm off-white for reduced eye strain.
- **Background Subtle**: `#f8f7f4`
- **Text Primary**: `#1c1917` (Deep Charcoal)
- **Text Secondary**: `#78716c` (Muted Brown-Gray)

#### Dark Mode
- **Primary**: `#2dd4bf` (Bright Teal)
- **Accent**: `#fbbf24` (Bright Amber)
- **Background Main**: `#1a1918`
- **Background Subtle**: `#262524`
- **Text Primary**: `#fafaf9`
- **Text Secondary**: `#a8a29e`

### Typography

- **Display/Serif**: `Fraunces` - Used for headings (`h1`, `h2`, `font-display`) to give a distinctive, editorial feel.
- **Sans/Body**: `DM Sans` - Used for paragraphs, UI labels, and general content for maximum legibility.
- **Mono**: System monospace - Used for code snippets and technical data.

### Shadows & Depth
- **Shadow SM**: `0 1px 2px 0 rgb(28 25 23 / 0.04)`
- **Shadow MD**: `0 4px 6px -1px rgb(28 25 23 / 0.08)`
- **Shadow LG**: `0 10px 15px -3px rgb(28 25 23 / 0.1)`

---

## Core Components

### 1. Logo & Icons
- **BrainIcon**: The primary brand symbol. A stylized brain with four constellation nodes. Use standard version for main branding and `BrainIconSimple` for smaller contexts (like avatars or compact headers).
- **Lucide React**: For all utility icons (Search, Plus, Trash, etc.).

### 2. Layout Elements
- **Header**: Fixed height (`h-14` to `h-16`). Contains tab navigation and profile management.
- **Drawer**: Used for secondary workflows like Subscription Management. Slide-in from right on desktop, from bottom on mobile.

### 3. Feedback & Status
- **SubscriptionBadge**: Visual indicator for user tier (Basic/Pro).
- **Status Overlay**: Full-screen or container-level masks with `animate-scale-pop` for success confirmations.
- **AI Processing**: Use `Sparkles` icon with Amber coloring and `animate-pulse-glow`.

---

## Animation Patterns

HyperMemo uses micro-interactions to feel dynamic and alive:

- **Fade In**: `animate-fade-in` (0.3s) - Applied to new messages and modals.
- **Staggered Entry**: `stagger-item` - Used for lists (e.g., bookmark results) to create a smooth loading perception.
- **Scale Pop**: `animate-scale-pop` - High-visibility success states.
- **Pulse Glow**: `animate-pulse-glow` - Constant subtle feedback for active AI tasks.

---

## Dark Mode Implementation

Theme switching is handled via the `.dark` class on the `html` element.
> [!IMPORTANT]
> Always use theme-aware Tailwind classes (e.g., `text-text-primary` instead of `text-[#1c1917]`) to ensure seamless transition between modes.
