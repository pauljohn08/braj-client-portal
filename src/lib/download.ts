import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { fileBucket, type OrderFile } from "@/lib/orders";

/**
 * Storage downloads, in one place. Four screens used to carry their own copy of
 * this, which is how they drifted apart; anything that hands a file to the user
 * should go through here so the failure message is the same everywhere.
 */
export async function downloadFromBucket(
  bucket: string,
  filePath: string,
  fileName: string,
): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);

  if (error) {
    toast({
      title: "Download failed",
      description: error.message,
      variant: "destructive",
    });
    return false;
  }

  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Bucket is derived from the file's own type rather than passed in. */
export function downloadOrderFile(
  file: Pick<OrderFile, "file_path" | "file_name" | "file_type">,
): Promise<boolean> {
  return downloadFromBucket(
    fileBucket(file.file_type),
    file.file_path,
    file.file_name,
  );
}

/** A payment receipt lives in its own bucket. */
export function downloadReceipt(
  filePath: string,
  fileName: string,
): Promise<boolean> {
  return downloadFromBucket("payment-receipts", filePath, fileName);
}
