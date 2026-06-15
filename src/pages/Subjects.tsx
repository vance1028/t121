import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { Plus, Trash2, X, Save, FlaskConical, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function Subjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [trialId, setTrialId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAllocate, setShowAllocate] = useState<number | null>(null);
  const [allocateResult, setAllocateResult] = useState<any>(null);
  const [form, setForm] = useState({ subject_code: '', initials: '', age_group: '40-59', gender: '男', disease_stage: 'IV', site_id: 0 });

  useEffect(() => {
    api.trials.list().then((data) => {
      setTrials(data);
      if (data.length > 0) setTrialId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!trialId) return;
    setLoading(true);
    Promise.all([
      api.subjects.list(trialId),
      api.sites.list(trialId),
    ]).then(([subs, sts]) => {
      setSubjects(subs);
      setSites(sts);
      if (sts.length > 0) setForm(f => ({ ...f, site_id: sts[0].id }));
    }).finally(() => setLoading(false));
  }, [trialId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.subjects.create({ ...form, trial_id: trialId });
      setShowForm(false);
      setForm({ subject_code: '', initials: '', age_group: '40-59', gender: '男', disease_stage: 'IV', site_id: sites[0]?.id || 0 });
      api.subjects.list(trialId!).then(setSubjects);
    } catch (err: any) { alert(err.message); }
  };

  const handleAllocate = async (subjectId: number) => {
    try {
      const result = await api.subjects.allocate(subjectId);
      setAllocateResult(result);
      api.subjects.list(trialId!).then(setSubjects);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此受试者？')) return;
    try { await api.subjects.delete(id); api.subjects.list(trialId!).then(setSubjects); } catch (err: any) { alert(err.message); }
  };

  const statusConfig: Record<string, { icon: any; cls: string; label: string }> = {
    pending: { icon: Clock, cls: 'bg-amber-100 text-amber-700', label: '待分配' },
    allocated: { icon: CheckCircle2, cls: 'bg-sky-100 text-sky-700', label: '已分配' },
    unblinded: { icon: AlertCircle, cls: 'bg-rose-100 text-rose-700', label: '已揭盲' },
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">受试者管理</h1>
          <p className="text-sm text-slate-500 mt-1">登记受试者并申请随机化分配</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={trialId || ''} onChange={(e) => setTrialId(Number(e.target.value))} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
            {trials.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> 登记受试者
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">登记受试者</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">受试者编号</label>
                <input required value={form.subject_code} onChange={(e) => setForm({ ...form, subject_code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">姓名缩写</label>
                <input value={form.initials} onChange={(e) => setForm({ ...form, initials: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">年龄段</label>
                <select value={form.age_group} onChange={(e) => setForm({ ...form, age_group: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
                  <option>18-39</option><option>40-59</option><option>60+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">性别</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
                  <option>男</option><option>女</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">疾病分期</label>
                <select value={form.disease_stage} onChange={(e) => setForm({ ...form, disease_stage: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
                  <option>IIIA</option><option>IIIB</option><option>IV</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">研究中心</label>
              <select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">取消</button>
              <button type="submit" className="flex items-center gap-1 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"><Save className="w-4 h-4" /> 登记</button>
            </div>
          </form>
        </div>
      )}

      {allocateResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-sky-100 flex items-center justify-center">
              <FlaskConical className="w-7 h-7 text-sky-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">分配成功</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="text-sm text-slate-600">用药代码：<span className="font-bold text-sky-600 text-lg">{allocateResult.drug_code}</span></div>
              <div className="text-xs text-slate-400">双盲状态下组别信息已隐藏</div>
            </div>
            <button onClick={() => { setAllocateResult(null); setShowAllocate(null); }} className="px-6 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium">确认</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">编号</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">缩写</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">年龄段</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">性别</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">分期</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">中心</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">状态</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">用药代码</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((s) => {
                const st = statusConfig[s.allocation_status] || statusConfig.pending;
                const Icon = st.icon;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{s.subject_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.initials}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.age_group}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.gender}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.disease_stage}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.site_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        <Icon className="w-3 h-3" /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{s.drug_code || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {s.allocation_status === 'pending' && (
                          <button
                            onClick={() => handleAllocate(s.id)}
                            className="px-3 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
                          >
                            申请分配
                          </button>
                        )}
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {subjects.length === 0 && !loading && <div className="text-center py-12 text-slate-400 text-sm">暂无受试者</div>}
      </div>
    </div>
  );
}
