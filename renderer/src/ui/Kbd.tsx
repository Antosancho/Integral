/**
 * Chip de tecla del design system (`ig-kbd`). Es decorativo: el atajo se anuncia
 * en el texto o `aria-label` del control al que acompaña, por eso va `aria-hidden`.
 */
export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ig-kbd" aria-hidden="true">
      {children}
    </kbd>
  )
}
