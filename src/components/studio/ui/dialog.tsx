"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "@/lib/utils";

export const StudioUiDialog = DialogPrimitive.Root;
export const StudioUiDialogTrigger = DialogPrimitive.Trigger;
export const StudioUiDialogClose = DialogPrimitive.Close;
export const StudioUiDialogPortal = DialogPrimitive.Portal;

export const StudioUiDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("stu-dialog-overlay", className)}
    {...props}
  />
));
StudioUiDialogOverlay.displayName = "StudioUiDialogOverlay";

export type StudioUiDialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  /** Mobile: unten als Sheet statt zentriertem Modal */
  sheetOnMobile?: boolean;
  showClose?: boolean;
};

export const StudioUiDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  StudioUiDialogContentProps
>(({ className, children, sheetOnMobile = true, showClose = true, ...props }, ref) => (
  <StudioUiDialogPortal>
    <StudioUiDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "stu-dialog evg-studio",
        sheetOnMobile && "stu-dialog--sheet-mobile",
        className,
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close className="stu-dialog__close" aria-label="Schließen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6 L18 18 M18 6 L6 18"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </StudioUiDialogPortal>
));
StudioUiDialogContent.displayName = "StudioUiDialogContent";

export function StudioUiDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("stu-dialog__header", className)} {...props} />;
}

export function StudioUiDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("stu-dialog__footer", className)} {...props} />;
}

export const StudioUiDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("stu-dialog__title", className)} {...props} />
));
StudioUiDialogTitle.displayName = "StudioUiDialogTitle";

export const StudioUiDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("stu-dialog__desc", className)}
    {...props}
  />
));
StudioUiDialogDescription.displayName = "StudioUiDialogDescription";
