import type { ReactNode } from 'react';
import { z } from 'zod';

const proofUrl = z.url({ protocol: /^https?$/ });

export function ProofLink({ url, children, className }: {
  url?: string | null; children: ReactNode; className?: string;
}) {
  const parsed = proofUrl.safeParse(url);
  if (!parsed.success) return null;
  return <a href={parsed.data} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}
