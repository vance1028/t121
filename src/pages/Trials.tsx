import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { Plus, Edit2, Trash2, ChevronRight, Settings, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Trials() {
  const [trials, setTrials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', randomization_method: 'stratified_block', block_sizes: '4,6', minimization_probability: '0.70', seed: '42' });
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.trials.list().then(setTrials).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.trials.create({
        ...form,
        block_sizes: form.block_sizes.split(',').map(Number),
        minimization_probability: parseFloat(form.minimization_probability),
        seed: parseInt(form.seed),
      });
      setShowForm(false);
      setForm({ name: '', description: '', randomization_method: 'stratified_block', block_sizes: '4,6', minimization_probability: '0.70', seed: '42' });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此试验项目吗？关联数据将一并删除。')) return;
    try {
      await api.trials.delete(id);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: '进行中', cls: 'bg-emerald-100 text-emerald-700' },
    completed: { label: '已完成', cls: 'bg-slate-100 text-slate-600' },
    suspended: { label: '已暂停', cls: 'bg-amber-100 text-amber-700' },
  };

  const methodMap: Record<string, string> = {
    stratified_block: '分层区组随机化',
    minimization: '最小化法',
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">试验管理</h1>
          <p className="text-sm text-slate-500 mt-1">管理临床试验项目及随机化配置</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建试验
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">新建试验项目</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">试验名称</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">描述</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">随机化方法</label>
                <select value={form.randomization_method} onChange={(e) => setForm({ ...form, randomization_method: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
                  <option value="stratified_block">分层区组随机化</option>
                  <option value="minimization">最小化法</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">区组大小（逗号分隔）</label>
                <input value={form.block_sizes} onChange={(e) => setForm({ ...form, block_sizes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">最小化概率</label>
                <input type="number" step="0.01" value={form.minimization_probability} onChange={(e) => setForm({ ...form, minimization_probability: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">随机种子</label>
                <input type="number" value={form.seed} onChange={(e) => setForm({ ...form, seed: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium">
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">试验名称</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">状态</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">随机化方法</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">区组大小</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">创建时间</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trials.map((t) => {
              const st = statusMap[t.status] || statusMap.active;
              return (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-800">{t.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{t.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{methodMap[t.randomization_method] || t.randomization_method}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">[{t.block_sizes?.join(', ')}]</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(t.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/trials/${t.id}`)} className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-colors" title="详情配置">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {trials.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400 text-sm">暂无试验项目</div>
        )}
      </div>
    </div>
  );
}
