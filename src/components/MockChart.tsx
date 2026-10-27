import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PASS_MARK } from '../lib/defaults'

/** Evolución del % de aciertos en simulacros y tests acumulados. */
export default function MockChart({ data }: { data: { label: string; pct: number }[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
          <XAxis dataKey="label" fontSize={11} />
          <YAxis domain={[0, 100]} fontSize={11} />
          <Tooltip formatter={(v) => `${v} %`} />
          <ReferenceLine y={PASS_MARK} stroke="#e11d48" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="pct" stroke="#4f46e5" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
