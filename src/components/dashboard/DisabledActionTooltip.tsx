import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DisabledActionTooltipProps {
  disabled: boolean;
  content?: string | null;
  children: ReactNode;
}

export default function DisabledActionTooltip({ disabled, content, children }: DisabledActionTooltipProps) {
  if (!disabled || !content) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex w-fit cursor-not-allowed">{children}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-64 text-balance">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
