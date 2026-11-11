import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  PenLine,
  ScanSearch,
  SpellCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Each service gets a fixed glyph so a client learns to recognise their own
 * project type at a glance. Keyed by the service name stored on the order.
 */
const glyphs: Record<string, LucideIcon> = {
  "Statistical Analysis": BarChart3,
  "Validation of Instrument": ClipboardCheck,
  Research: BookOpen,
  "Similarities/Plagiarism Report": ScanSearch,
  Paraphrasing: PenLine,
  Editing: SpellCheck,
};

export function serviceIcon(serviceName: string): LucideIcon {
  return glyphs[serviceName] ?? BookOpen;
}

export function ServiceGlyph({
  serviceName,
  className,
}: {
  serviceName: string;
  className?: string;
}) {
  const Icon = serviceIcon(serviceName);
  return <Icon className={className} aria-hidden />;
}
