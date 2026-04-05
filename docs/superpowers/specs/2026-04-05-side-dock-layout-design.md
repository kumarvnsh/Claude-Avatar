# Side Dock Layout Design

## Goal

Adjust the renderer so avatars behave correctly when the macOS Dock is on the left or right edge:
- avatars remain stacked one above the other
- idle wandering moves up and down instead of left and right
- project labels also follow the vertical stack layout
- avatar plus label footprints do not overlap

## Current Issue

The renderer already switches left and right dock modes to a vertical base layout, but it still treats spacing and hitboxes as if the sprite is the only important footprint. Labels are rendered to the side for left and right modes, which creates visual overlap and makes the combined avatar area wider than the reserved slot.

## Approved Behavior

### Bottom Dock
- Keep the existing horizontal arrangement.
- Keep horizontal wandering.
- Keep labels below the avatar.

### Left And Right Docks
- Keep avatars in a single vertical stack.
- Keep wandering on the vertical axis only.
- Move each label into the same vertical lane as its avatar, centered above or below the sprite rather than beside it.
- Reserve layout space for the full combined footprint of sprite, label pill, and gap.
- Limit wander range so each avatar stays inside its own slot without colliding with neighbors.

## Renderer Changes

### Slot Sizing
- Introduce a side-dock slot height that is larger than the sprite height.
- Base this slot on:
  - sprite display height
  - label pill height
  - label gap
  - extra breathing room for wander and bob
- Use that slot height instead of the generic avatar spacing when the dock is on the left or right.

### Position Calculation
- Keep `bottom` dock logic unchanged.
- For `left` and `right`, compute `baseY` from the side-dock slot height so the full avatar and label pair is centered vertically within the overlay.
- Keep `baseX` fixed near the inner edge of the overlay window.

### Motion
- Keep wander along the main layout axis:
  - `bottom`: X axis
  - `left` and `right`: Y axis
- Reduce the maximum side-dock wander amplitude so it cannot push one avatar into the next reserved slot.
- Keep perpendicular bobbing as ambient secondary motion.

### Label Placement
- Replace side labels in left and right modes with vertically aligned labels.
- Center the label on the avatar's X position so the sprite and pill read as one unit.
- Prefer rendering labels below the sprite for side docks to match the existing bottom-dock mental model and avoid pushing text toward the screen edge.

### Hit Testing
- Expand side-dock hitboxes to cover the full sprite-plus-label area, not just the sprite height.
- Preserve click and hover behavior for the full visible footprint.

## Non-Goals
- No change to tooltip behavior.
- No change to bottom-dock composition.
- No change to overlay window sizing in this pass unless the current side overlay width proves too small for centered labels.

## Verification

1. Run the app with the Dock on the left and verify avatars appear in a clean vertical stack with labels centered in the same lane.
2. Repeat with the Dock on the right.
3. Verify avatars wander up and down only in side-dock mode.
4. Verify no label overlaps another avatar or label with 3 or more sessions active.
5. Verify hover and click still work when pointing at either the sprite or the visible label region.
