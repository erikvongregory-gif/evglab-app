/** Bestehende Shell-/Layout-Helfer (vor T2a) — API unverändert. */
export {
  StudioBadge,
  StudioButton,
  StudioCard,
  StudioChip,
  StudioEyebrow,
  StudioFieldLabel,
  StudioIconButton,
  StudioPageHeader,
  StudioSparkline,
  StudioStatCard,
  StudioStatGrid,
  type StudioButtonSize,
  type StudioButtonVariant,
  type StudioStatIconTone,
} from "./legacy";

/** T2a FINAL Primitives — neue Studio-UI-Schicht (`stu-*`). */
export { StudioUiButton, type StudioUiButtonProps, type StudioUiButtonSize, type StudioUiButtonVariant } from "./button";
export {
  StudioUiIconButton,
  type StudioUiIconButtonProps,
  type StudioUiIconButtonSize,
  type StudioUiIconButtonVariant,
} from "./icon-button";
export { StudioUiInput, type StudioUiInputProps } from "./input";
export { StudioUiTextarea, type StudioUiTextareaProps } from "./textarea";
export { StudioUiSelect, type StudioUiSelectProps } from "./select";
export { StudioUiBadge, type StudioUiBadgeProps, type StudioUiBadgeTone } from "./badge";
export { StudioUiCard, type StudioUiCardPadding, type StudioUiCardProps } from "./card";
export { StudioUiSkeleton, type StudioUiSkeletonProps } from "./skeleton";
export { StudioUiProgress, type StudioUiProgressProps, type StudioUiProgressTone } from "./progress";
export {
  StudioUiField,
  StudioUiHint,
  StudioUiLabel,
  type StudioUiHintProps,
  type StudioUiHintTone,
  type StudioUiLabelProps,
} from "./field";
