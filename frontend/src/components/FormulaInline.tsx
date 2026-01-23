import { Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

type FormulaInlineProps = {
  latex: string;
  ariaLabel: string;
  className?: string;
};

export function FormulaInline({ latex, ariaLabel, className }: FormulaInlineProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }, [latex]);

  return (
    <span className={className}>
      <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-white/10 bg-background/40">
        <span className="font-mono text-white" aria-label={ariaLabel}>
          {latex}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/10 bg-background/30 text-text-secondary hover:text-white hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label={copied ? 'Fórmula copiada' : 'Copiar fórmula'}
          title={copied ? 'Copiado' : 'Copiar'}
        >
          <Copy size={14} />
        </button>
      </span>
    </span>
  );
}
