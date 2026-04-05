interface TooltipTopInput {
  anchorY: number;
  tooltipHeight: number;
  viewportHeight: number;
}

const TOOLTIP_MARGIN = 8;
const TOOLTIP_GAP = 8;

export function getTooltipTop(input: TooltipTopInput): number {
  const { anchorY, tooltipHeight, viewportHeight } = input;
  const preferredTop = anchorY - tooltipHeight - TOOLTIP_GAP;
  const maxTop = Math.max(TOOLTIP_MARGIN, viewportHeight - tooltipHeight - TOOLTIP_MARGIN);

  return Math.max(TOOLTIP_MARGIN, Math.min(preferredTop, maxTop));
}
