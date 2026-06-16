import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { toastSuccess, toastError } from '@/stores/toastStore';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function Sites() {
  const [sites, setSites] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [trialId, setTrialId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ trial_id: 0, name: '', code: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.trials.list().then((data) => {
      setTrials(data);
      if (data.length > 0 && !trialId) setTrialId(data[0].id);
    });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!trialId) return;
    setLoading(true);
    api.sites.list(trialId).then(setSites).finally(() => setLoading(false));
  }, [trialId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.sites.update(editId, { name: form.name, code: form.code });
        toastSuccess('中心信息已更新');
      } else {
        await api.sites.create({ ...form, trial_id: trialId });
        toastSuccess('中心创建成功');
      }
      setShowForm(false);
      setEditId(null);
      setForm({ trial_id: 0, name: '', code: '' });
      api.sites.list(trialId!).then(setSites);
    } catch (err: any) { toastError(err.message); }
  };

  const handleEdit = (site: any) => {
    setEditId(site.id);
    setForm({ trial_id: site.trial_id, name: site.name, code: site.code });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    try {
      await api.sites.delete(deleteId);
      toastSuccess('中心已删除');
      api.sites.list(trialId!).then(setSites);
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">研究中心</h1>
          <p className="text-sm text-slate-500 mt-1">管理参与试验的研究中心</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={trialId || ''}
            onChange={(e) => setTrialId(Number(e.target.value))}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-sky-500/50 focus:outline-none"
          >
            {trials.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            onClick={() => { setEditId(null); setForm({ trial_id: 0, name: '', code: '' }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> 新建中心
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">{editId ? '编辑中心' : '新建中心'}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">中心名称</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">中心编码</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">取消</button>
              <button type="submit" className="flex items-center gap-1 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"><Save className="w-4 h-4" /> 保存</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">中心名称</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">编码</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sites.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 text-sm text-slate-800">{s.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{s.code}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sites.length === 0 && !loading && <div className="text-center py-12 text-slate-400 text-sm">暂无研究中心</div>}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除研究中心"
        message="确定删除此研究中心吗？关联的受试者数据也会受到影响。"
        confirmText="删除"
        cancelText="取消"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
