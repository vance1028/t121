import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { Users, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';

export default function Dashboard() {
  const [trialId, setTrialId] = useState<number | null>(null);
  const [trials, setTrials] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [balance, setBalance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.trials.list().then((data) => {
      setTrials(data);
      if (data.length > 0) setTrialId(data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!trialId) return;
    setLoading(true);
    Promise.all([
      api.dashboard.overview(trialId),
      api.dashboard.trend(trialId),
      api.dashboard.balance(trialId),
    ])
      .then(([ov, tr, bl]) => {
        setOverview(ov);
        setTrend(tr);
        setBalance(bl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trialId]);

  if (loading && !overview) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-slate-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">入组进度看板</h1>
          <p className="text-sm text-slate-500 mt-1">实时监控试验随机化与入组情况</p>
        </div>
        <select
          value={trialId || ''}
          onChange={(e) => setTrialId(Number(e.target.value))}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
        >
          {trials.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {overview && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="已入组总数"
              value={overview.total}
              color="sky"
            />
            <StatCard
              icon={Activity}
              label="入组速率"
              value={`${overview.enrollmentRate} 人/天`}
              color="emerald"
            />
            <StatCard
              icon={TrendingUp}
              label="组间最大偏差"
              value={overview.max_deviation !== undefined && overview.max_deviation !== null
                ? `${Math.round(overview.max_deviation)}%`
                : '0%'}
              color="amber"
            />
            <StatCard
              icon={AlertTriangle}
              label="已揭盲"
              value={overview.unblinded !== undefined && overview.unblinded !== null ? overview.unblinded : 0}
              color="rose"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4">各组入组人数</h3>
              <div className="space-y-4">
                {overview.byGroup.map((g: any) => (
                  <div key={g.group_id}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium text-slate-700">{g.group_name}</span>
                      <span className="text-sm text-slate-500">
                        {g.count} 人 (期望 {g.expected_percentage}%，实际 {g.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${g.percentage}%`,
                          backgroundColor: g.group_name === '试验组' ? '#0ea5e9' : '#6366f1',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4">各中心入组情况</h3>
              <div className="space-y-3">
                {overview.bySite.map((s: any) => (
                  <div key={s.site_id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-700">{s.site_name}</span>
                    <span className="text-sm font-semibold text-slate-800">{s.count} 人</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {trend.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4">入组趋势</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="当日入组" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cumulative" name="累计入组" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {balance.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4">分层因素组间平衡度</h3>
              <div className="space-y-8">
                {balance.map((factor: any) => {
                  const groupNames = factor.levels[0]?.groups?.map((g: any) => g.group_name) || [];
                  const flatData = factor.levels.map((lvl: any) => {
                    const row: Record<string, any> = { level: lvl.level };
                    lvl.groups.forEach((g: any) => { row[g.group_name] = g.count; });
                    return row;
                  });
                  const colors = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b'];
                  return (
                    <div key={factor.factor}>
                      <h4 className="text-sm font-medium text-slate-600 mb-3">{factor.factor}</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={flatData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="level" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                          <Legend />
                          {groupNames.map((name: string, idx: number) => (
                            <Bar key={name} dataKey={name} name={name} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  const iconColors: Record<string, string> = {
    sky: 'bg-sky-100 text-sky-500',
    emerald: 'bg-emerald-100 text-emerald-500',
    amber: 'bg-amber-100 text-amber-500',
    rose: 'bg-rose-100 text-rose-500',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}
