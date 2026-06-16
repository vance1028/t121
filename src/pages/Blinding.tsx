import { useState, useEffect } from 'react';
import { api } from '@/utils/api';
import { EyeOff, AlertTriangle, FileWarning, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toastSuccess, toastError } from '@/stores/toastStore';
import ConfirmDialog from '@/components/ConfirmDialog';

const PAGE_SIZE = 10;

export default function Blinding() {
  const [trials, setTrials] = useState<any[]>([]);
  const [trialId, setTrialId] = useState<number | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnblind, setShowUnblind] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [unblindResult, setUnblindResult] = useState<any>(null);
  const [unblindConfirm, setUnblindConfirm] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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
      api.unblind.records(trialId, page, PAGE_SIZE),
      api.subjects.list(trialId, undefined, 1, 100),
    ]).then(([recsData, subsData]) => {
      const items = recsData.items || recsData;
      setRecords(items);
      setTotal(recsData.total || items.length);
      setTotalPages(recsData.total_pages || 1);
      const subItems = subsData.items || subsData;
      setSubjects(subItems.filter((s: any) => s.allocation_status === 'allocated'));
    }).finally(() => setLoading(false));
  }, [trialId, page]);

  const handleUnblindSubmit = () => {
    if (!selectedSubject || !reason.trim()) return;
    setUnblindConfirm(true);
  };

  const confirmUnblind = async () => {
    if (!selectedSubject || !reason.trim()) return;
    try {
      const result = await api.unblind.create(selectedSubject, reason);
      setUnblindResult(result);
      setUnblindConfirm(false);
      toastSuccess('揭盲操作已完成');
      const recsData = await api.unblind.records(trialId!, page, PAGE_SIZE);
      setRecords(recsData.items || recsData);
      setTotal(recsData.total || (recsData.items || recsData).length);
      setTotalPages(recsData.total_pages || 1);
      const subsData = await api.subjects.list(trialId!, undefined, 1, 100);
      const subItems = subsData.items || subsData;
      setSubjects(subItems.filter((s: any) => s.allocation_status === 'allocated'));
    } catch (err: any) {
      toastError(err.message);
      setUnblindConfirm(false);
    }
  };

  const closeUnblind = () => {
    setShowUnblind(false);
    setUnblindResult(null);
    setReason('');
    setSelectedSubject(null);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
        <div className="text-sm text-slate-500">
          共 <span className="font-medium text-slate-700">{total}</span> 条记录，第 <span className="font-medium text-slate-700">{page}</span> / {totalPages} 页
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">盲态管理</h1>
          <p className="text-sm text-slate-500 mt-1">紧急揭盲操作与揭盲记录查询</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={trialId || ''} onChange={(e) => { setTrialId(Number(e.target.value)); setPage(1); }} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
            {trials.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            onClick={() => { setUnblindResult(null); setReason(''); setSelectedSubject(null); setShowUnblind(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition-colors"
          >
            <FileWarning className="w-4 h-4" /> 紧急揭盲
          </button>
        </div>
      </div>

      {showUnblind && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h3 className="text-lg font-semibold text-slate-800">紧急揭盲</h3>
              </div>
              <button onClick={closeUnblind} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {!unblindResult ? (
              <>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
                  <strong>警告：</strong>揭盲操作不可逆，将永久揭示受试者所属组别，请确保符合紧急揭盲条件。
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">选择受试者</label>
                  <select value={selectedSubject || ''} onChange={(e) => setSelectedSubject(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none">
                    <option value="">请选择</option>
                    {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.subject_code} - {s.initials} ({s.drug_code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">揭盲原因 <span className="text-rose-500">*</span></label>
                  <textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请详细说明揭盲原因..." rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500/50 focus:outline-none" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={closeUnblind} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">取消</button>
                  <button
                    onClick={handleUnblindSubmit}
                    disabled={!selectedSubject || !reason.trim()}
                    className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-medium transition-colors"
                  >
                    确认揭盲
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
                  <EyeOff className="w-7 h-7 text-rose-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">揭盲结果</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div className="text-sm text-slate-600">受试者编号：<span className="font-semibold text-slate-800">{unblindResult.subject_code}</span></div>
                  <div className="text-sm text-slate-600">用药代码：<span className="font-semibold text-slate-800">{unblindResult.drug_code}</span></div>
                  <div className="text-sm text-slate-600">所属组别：<span className="font-bold text-rose-600 text-lg">{unblindResult.revealed_group}</span></div>
                </div>
                <button onClick={closeUnblind} className="px-6 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium transition-colors">关闭</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">揭盲记录</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">时间</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">受试者</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">揭示组别</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">操作人</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">原因</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(r.unblinded_at).toLocaleString('zh-CN')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.subject_code}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">{r.revealed_group}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{r.operator_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length === 0 && !loading && <div className="text-center py-12 text-slate-400 text-sm">暂无揭盲记录</div>}
        {renderPagination()}
      </div>

      <ConfirmDialog
        open={unblindConfirm}
        title="确认紧急揭盲"
        message="此操作将永久揭示受试者的真实组别，破盲后不可恢复。确认要继续吗？"
        confirmText="确认揭盲"
        cancelText="取消"
        confirmVariant="danger"
        onConfirm={confirmUnblind}
        onCancel={() => setUnblindConfirm(false)}
      />
    </div>
  );
}
