import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { Plus, Trash2, X, Save, FlaskConical, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toastSuccess, toastError } from '@/stores/toastStore';
import ConfirmDialog from '@/components/ConfirmDialog';

const PAGE_SIZE = 10;

export default function Subjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [factors, setFactors] = useState<any[]>([]);
  const [trialId, setTrialId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [allocateConfirm, setAllocateConfirm] = useState<number | null>(null);
  const [allocateResult, setAllocateResult] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ subject_code: '', initials: '', site_id: 0, stratification_data: {} });

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
      api.subjects.list(trialId, undefined, page, PAGE_SIZE),
      api.sites.list(trialId),
      api.trials.get(trialId),
    ]).then(([subsData, sts, trialDetail]) => {
      setSubjects(subsData.items || subsData);
      setTotal(subsData.total || subsData.length);
      setTotalPages(subsData.total_pages || 1);
      setSites(sts);
      setFactors(trialDetail.stratification_factors || []);
      if (sts.length > 0) {
        setForm(f => {
          const stratData: Record<string, string> = {};
          (trialDetail.stratification_factors || []).forEach((f: any) => {
            stratData[f.name] = f.levels?.[0] || '';
          });
          return { ...f, site_id: sts[0].id, stratification_data: stratData };
        });
      }
    }).finally(() => setLoading(false));
  }, [trialId, page]);

  const resetForm = () => {
    const stratData: Record<string, string> = {};
    factors.forEach((f: any) => {
      stratData[f.name] = f.levels?.[0] || '';
    });
    setForm({ subject_code: '', initials: '', site_id: sites[0]?.id || 0, stratification_data: stratData });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        trial_id: trialId,
        subject_code: form.subject_code,
        initials: form.initials,
        site_id: form.site_id,
        stratification_data: form.stratification_data,
        age_group: form.stratification_data['年龄段'],
        gender: form.stratification_data['性别'],
        disease_stage: form.stratification_data['疾病分期'],
      };
      await api.subjects.create(payload);
      setShowForm(false);
      resetForm();
      toastSuccess('受试者登记成功');
      if (subjects.length >= PAGE_SIZE) {
        setPage(1);
      } else {
        api.subjects.list(trialId!, undefined, page, PAGE_SIZE).then(d => {
          setSubjects(d.items || d);
          setTotal(d.total || d.length);
          setTotalPages(d.total_pages || 1);
        });
      }
    } catch (err: any) { toastError(err.message); }
  };

  const handleAllocate = (subjectId: number) => {
    setAllocateConfirm(subjectId);
  };

  const confirmAllocate = async () => {
    if (allocateConfirm === null) return;
    try {
      const result = await api.subjects.allocate(allocateConfirm);
      setAllocateResult(result);
      toastSuccess('分配成功');
      api.subjects.list(trialId!, undefined, page, PAGE_SIZE).then(d => {
        setSubjects(d.items || d);
        setTotal(d.total || d.length);
        setTotalPages(d.total_pages || 1);
      });
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setAllocateConfirm(null);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    try {
      await api.subjects.delete(deleteId);
      toastSuccess('受试者已删除');
      const data = await api.subjects.list(trialId!, undefined, page, PAGE_SIZE);
      setSubjects(data.items || data);
      setTotal(data.total || data.length);
      setTotalPages(data.total_pages || 1);
      if ((data.items || data).length === 0 && page > 1) {
        setPage(p => p - 1);
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setDeleteId(null);
    }
  };

  const statusConfig: Record<string, { icon: any; cls: string; label: string }> = {
    pending: { icon: Clock, cls: 'bg-amber-100 text-amber-700', label: '待分配' },
    allocated: { icon: CheckCircle2, cls: 'bg-sky-100 text-sky-700', label: '已分配' },
    unblinded: { icon: AlertCircle, cls: 'bg-rose-100 text-rose-700', label: '已揭盲' },
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
        <div className="text-sm text-slate-500">
          共 <span className="font-medium text-slate-700">{total}</span> 条，第 <span className="font-medium text-slate-700">{page}</span> / {totalPages} 页
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const displayFactors = factors.length > 0 ? factors : [
    { name: '年龄段', levels: ['18-39', '40-59', '60+'] },
    { name: '性别', levels: ['男', '女'] },
    { name: '疾病分期', levels: ['IIIA', 'IIIB', 'IV'] },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">受试者管理</h1>
          <p className="text-sm text-slate-500 mt-1">登记受试者并申请随机化分配</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={trialId || ''} onChange={(e) => { setTrialId(Number(e.target.value)); setPage(1); }} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
            {trials.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> 登记受试者
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-4">
              {displayFactors.map((f: any) => (
                <div key={f.name}>
                  <label className="block text-sm text-slate-600 mb-1">{f.name}</label>
                  <select
                    value={form.stratification_data?.[f.name] || ''}
                    onChange={(e) => setForm({
                      ...form,
                      stratification_data: { ...form.stratification_data, [f.name]: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
                  >
                    {f.levels?.map((lvl: string) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">研究中心</label>
              <select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">取消</button>
              <button type="submit" className="flex items-center gap-1 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"><Save className="w-4 h-4" /> 登记</button>
            </div>
          </form>
        </div>
      )}

      {allocateResult && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-sky-100 flex items-center justify-center">
              <FlaskConical className="w-7 h-7 text-sky-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">分配成功</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="text-sm text-slate-600">用药代码：<span className="font-bold text-sky-600 text-lg">{allocateResult.drug_code}</span></div>
              <div className="text-xs text-slate-400">双盲状态下组别信息已隐藏</div>
            </div>
            <button onClick={() => setAllocateResult(null)} className="px-6 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors">确认</button>
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
                {displayFactors.slice(0, 3).map((f: any) => (
                  <th key={f.name} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{f.name}</th>
                ))}
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
                const stratData = s.stratification_data || {};
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{s.subject_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.initials}</td>
                    {displayFactors.slice(0, 3).map((f: any) => (
                      <td key={f.name} className="px-4 py-3 text-sm text-slate-600">
                        {stratData[f.name] || s[f.name.toLowerCase().replace(/\s+/g, '_')] || '—'}
                      </td>
                    ))}
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
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {subjects.length === 0 && !loading && <div className="text-center py-12 text-slate-400 text-sm">暂无受试者</div>}
        {renderPagination()}
      </div>

      <ConfirmDialog
        open={allocateConfirm !== null}
        title="确认分配"
        message="确定要为此受试者申请随机化分配吗？分配结果一旦生成不可撤销。"
        confirmText="确认分配"
        cancelText="取消"
        confirmVariant="primary"
        onConfirm={confirmAllocate}
        onCancel={() => setAllocateConfirm(null)}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="删除受试者"
        message="确定删除此受试者吗？此操作不可恢复。"
        confirmText="删除"
        cancelText="取消"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
