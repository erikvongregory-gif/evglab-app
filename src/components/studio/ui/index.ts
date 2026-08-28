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

/** T2a FINAL Primitives */
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

/** T2b FINAL interactive / overlay */
export { StudioUiCheckbox, type StudioUiCheckboxProps } from "./checkbox";
export { StudioUiRadio, StudioUiRadioGroup, type StudioUiRadioGroupProps, type StudioUiRadioProps } from "./radio";
export { StudioUiSwitch, type StudioUiSwitchProps } from "./switch";
export {
  StudioUiTabs,
  StudioUiTabsContent,
  StudioUiTabsList,
  StudioUiTabsTrigger,
  type StudioUiTabsContentProps,
  type StudioUiTabsProps,
  type StudioUiTabsTriggerProps,
} from "./tabs";
export {
  StudioUiTooltip,
  StudioUiTooltipContent,
  StudioUiTooltipProvider,
  StudioUiTooltipTrigger,
  type StudioUiTooltipContentProps,
} from "./tooltip";
export {
  StudioUiDropdownMenu,
  StudioUiDropdownMenuAnchor,
  StudioUiDropdownMenuContent,
  StudioUiDropdownMenuItem,
  StudioUiDropdownMenuSeparator,
  StudioUiDropdownMenuTrigger,
  type StudioUiDropdownMenuContentProps,
  type StudioUiDropdownMenuItemProps,
} from "./dropdown-menu";
export {
  StudioUiDialog,
  StudioUiDialogClose,
  StudioUiDialogContent,
  StudioUiDialogDescription,
  StudioUiDialogFooter,
  StudioUiDialogHeader,
  StudioUiDialogOverlay,
  StudioUiDialogPortal,
  StudioUiDialogTitle,
  StudioUiDialogTrigger,
  type StudioUiDialogContentProps,
} from "./dialog";
export { StudioUiConfirmDialog, type StudioUiConfirmDialogProps } from "./confirm-dialog";
export {
  StudioUiToaster,
  dismissStudioToast,
  showStudioToast,
  type StudioUiToastInput,
  type StudioUiToastItem,
} from "./toast";
