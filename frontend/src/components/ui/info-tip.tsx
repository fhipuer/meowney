import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { HelpCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type InfoTipProps = { label: string; children: ReactNode; className?: string };

function useTouchHelp() {
  const [touchHelp, setTouchHelp] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setTouchHelp(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return touchHelp;
}

export function InfoTip({ label, children, className }: InfoTipProps) {
  const touchHelp = useTouchHelp();
  if (touchHelp) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              className,
              "-m-2.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100%-2rem)] rounded-xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-7 text-left text-base leading-6">{label}</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="text-left text-sm leading-6 text-muted-foreground">{children}</div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <TooltipPrimitive.Provider delayDuration={180}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-lg"
          >
            {children}
            <TooltipPrimitive.Arrow className="fill-popover" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
