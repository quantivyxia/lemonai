type CulturaStatCardProps = {
  label: string
  valor: string
  sub?: string
  cor?: string
}

// The supplied viewer references StatCard but does not define it.
// This adapter only displays its already-calculated values.
export const CulturaStatCard = ({ label, valor, sub, cor }: CulturaStatCardProps) => (
  <div style={{ flex: '1 1 180px', minWidth: 160, padding: 20, borderRadius: 16, border: '1px solid #d8e0e9', background: '#fff', boxShadow: '0 10px 34px rgba(15,23,42,0.04)' }}>
    <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: '#64748b' }}>{label}</div>
    <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 26, fontWeight: 600, color: cor || '#0f172a', marginTop: 8 }}>{valor}</div>
    {sub && <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#64748b', marginTop: 6 }}>{sub}</div>}
  </div>
)
