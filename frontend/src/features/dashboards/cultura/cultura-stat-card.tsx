type CulturaStatCardProps = {
  label: string
  valor: string
  sub?: string
  cor?: string
}

// The supplied viewer references StatCard but does not define it.
// This adapter only displays its already-calculated values.
export const CulturaStatCard = ({ label, valor, sub, cor }: CulturaStatCardProps) => (
  <div className="cultura-stat-card">
    <div className="cultura-stat-label">{label}</div>
    <div className="cultura-stat-value" style={{ color: cor || 'hsl(var(--foreground))' }}>{valor}</div>
    {sub && <div className="cultura-stat-description">{sub}</div>}
  </div>
)
