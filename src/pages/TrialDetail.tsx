import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/utils/api';
import { Plus, Trash2, X, Save } from 'lucide-react';

export default function TrialDetail() {
  const { id } = useParams();
  const [trial, setTrial] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showFactorForm, setShowFactorForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', code: '', ratio: 1 });
  const [factorForm, setFactorForm] = useState({ name: '', levels: '' });

  const load = () => {
    if (!id) return;
    setLoading(true);
    api.trials.get(Number(id)).then(setTrial).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.trials.addGroup(Number(id), groupForm);
      setShowGroupForm(false);
      setGroupForm({ name: '', code: '', ratio: 1 });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleAddFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.trials.addFactor(Number(id), { name: factorForm.name, levels: factorForm.levels.split(',').map(s => s.trim()) });
      setShowFactorForm(false);
      setFactorForm({ name: '', levels: '' });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteGroup = async (gid: number) => {
    if (!confirm('确定删除此组别？')) return;
    try { await api.trials.deleteGroup(gid); load(); } catch (err: any) { alert(err.message); }
  };

  const handleDeleteFactor = async (fid: number) => {
    if (!confirm('确定删除此分层因素？')) return;
    try { await api.trials.deleteFactor(fid); load(); } catch (err: any) { alert(err.message); }
  };

  const handleGenerateSequences = async () => {
    if (!confirm('确定生成分配序列？已有序列不会被覆盖。')) return;
    try {
      const result = await api.randomization.generate(Number(id));
      alert(`已生成 ${result.count} 条分配序列（种子: ${result.seed}）`);
      load();
    } catch (err: any) { alert(err.message); }
  };

  if (loading || !trial) {
    return <div className="p-8"><div className="animate-pulse h-8 bg-slate-200 rounded w-64" /></div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{trial.name}</h1>
        <p className="text-sm text-slate-500 mt-1">{trial.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">组别配置</h3>
            <button onClick={() => setShowGroupForm(true)} className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-600 font-medium">
              <Plus className="w-3.5 h-3.5" /> 添加组别
            </button>
          </div>
          <div className="space-y-2">
            {trial.groups?.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                <div>
                  <span className="text-sm font-medium text-slate-700">{g.name}</span>
                  <span className="text-xs text-slate-400 ml-2">({g.code})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">比例 {g.ratio}</span>
                  <button onClick={() => handleDeleteGroup(g.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">分层因素</h3>
            <button onClick={() => setShowFactorForm(true)} className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-600 font-medium">
              <Plus className="w-3.5 h-3.5" /> 添加因素
            </button>
          </div>
          <div className="space-y-2">
            {trial.stratification_factors?.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                <div>
                  <span className="text-sm font-medium text-slate-700">{f.name}</span>
                  <span className="text-xs text-slate-400 ml-2">({f.levels?.join(', ')})</span>
                </div>
                <button onClick={() => handleDeleteFactor(f.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">随机化配置</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-500">方法：</span>
            <span className="text-slate-800 font-medium">{trial.randomization_method === 'stratified_block' ? '分层区组随机化' : '最小化法'}</span>
          </div>
          <div>
            <span className="text-slate-500">区组大小：</span>
            <span className="text-slate-800 font-medium">[{trial.block_sizes?.join(', ')}]</span>
          </div>
          <div>
            <span className="text-slate-500">种子：</span>
            <span className="text-slate-800 font-medium">{trial.seed}</span>
          </div>
        </div>
        <button
          onClick={handleGenerateSequences}
          className="mt-4 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
        >
          生成分配序列
        </button>
      </div>

      {showGroupForm && (
        <Modal title="添加组别" onClose={() => setShowGroupForm(false)}>
          <form onSubmit={handleAddGroup} className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">组别名称</label>
              <input required value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">编码</label>
                <input required value={groupForm.code} onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">分配比例</label>
                <input type="number" min={1} value={groupForm.ratio} onChange={(e) => setGroupForm({ ...groupForm, ratio: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowGroupForm(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">取消</button>
              <button type="submit" className="flex items-center gap-1 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"><Save className="w-4 h-4" /> 保存</button>
            </div>
          </form>
        </Modal>
      )}

      {showFactorForm && (
        <Modal title="添加分层因素" onClose={() => setShowFactorForm(false)}>
          <form onSubmit={handleAddFactor} className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">因素名称</label>
              <input required value={factorForm.name} onChange={(e) => setFactorForm({ ...factorForm, name: e.target.value })} placeholder="如：年龄段" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">水平（逗号分隔）</label>
              <input required value={factorForm.levels} onChange={(e) => setFactorForm({ ...factorForm, levels: e.target.value })} placeholder="如：18-39,40-59,60+" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowFactorForm(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">取消</button>
              <button type="submit" className="flex items-center gap-1 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"><Save className="w-4 h-4" /> 保存</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
