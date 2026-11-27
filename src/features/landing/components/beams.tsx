/** Feixes de luz verticais (decorativos). Posições em % da largura do pai; animam só com .lv2-on. */
export function Beams({ at = [12, 27, 44, 61, 78, 90], className = "" }: { at?: number[]; className?: string }) {
  return (
    <div aria-hidden="true" className={`lv2-beams ${className}`}>
      {at.map((x, i) => (
        <i key={x} style={{ left: `${x}%`, ["--d" as string]: i }} />
      ))}
    </div>
  );
}
