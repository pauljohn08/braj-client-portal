import { Download, FileText, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadOrderFile } from "@/lib/download";
import {
  fileRoleLabel,
  formatDate,
  isFileLocked,
  type Order,
  type OrderFile,
} from "@/lib/orders";

/**
 * A single document. Output files stay locked until the client's payment has
 * been confirmed, which is the only place in the portal that withholds
 * something the client can already see exists.
 */
export function FileRow({
  file,
  order,
  uploaderName,
  className,
}: {
  file: OrderFile;
  order?: Order;
  uploaderName?: string;
  className?: string;
}) {
  const isOutput = file.file_type === "output";
  const locked = isFileLocked(file, order);

  const meta = [
    fileRoleLabel(file.file_type),
    formatDate(file.created_at),
    uploaderName ? `uploaded by ${uploaderName}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className={cn("flex items-center gap-3 px-2 py-3", className)}>
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          isOutput
            ? "bg-success-muted text-success"
            : "bg-muted text-muted-foreground",
        )}
      >
        <FileText className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {file.file_name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>

      {locked ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Locked until payment
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void downloadOrderFile(file)}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      )}
    </div>
  );
}
