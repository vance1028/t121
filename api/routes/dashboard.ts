import { Router, type Response } from 'express';
import pool from '../db/pool.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/overview/:trialId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { trialId } = req.params;

    const totalResult = await pool.query(
      "SELECT COUNT(*)::int as total FROM subjects WHERE trial_id = $1 AND allocation_status IN ('allocated','unblinded')",
      [trialId]
    );
    const total = totalResult.rows[0].total;

    const byGroupResult = await pool.query(
      `SELECT g.id as group_id, g.name as group_name, g.ratio, COUNT(s.id)::int as count
       FROM groups g
       LEFT JOIN subjects s ON s.group_id = g.id AND s.allocation_status IN ('allocated','unblinded')
       WHERE g.trial_id = $1
       GROUP BY g.id, g.name, g.ratio
       ORDER BY g.id`,
      [trialId]
    );

    const bySiteResult = await pool.query(
      `SELECT si.id as site_id, si.name as site_name, COUNT(s.id)::int as count
       FROM sites si
       LEFT JOIN subjects s ON s.site_id = si.id AND s.allocation_status IN ('allocated','unblinded')
       WHERE si.trial_id = $1
       GROUP BY si.id, si.name
       ORDER BY si.id`,
      [trialId]
    );

    const totalRatio = byGroupResult.rows.reduce((sum: number, r: any) => sum + r.ratio, 0);
    const byGroup = byGroupResult.rows.map((r: any) => ({
      ...r,
      percentage: total > 0 ? Math.round(r.count / total * 100) : 0,
      expected_percentage: Math.round(r.ratio / totalRatio * 100),
    }));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentResult = await pool.query(
      `SELECT COUNT(*)::int as count FROM subjects
       WHERE trial_id = $1 AND allocated_at >= $2`,
      [trialId, sevenDaysAgo.toISOString()]
    );
    const enrollmentRate = Math.round(recentResult.rows[0].count / 7 * 10) / 10;

    res.json({
      success: true,
      data: { total, byGroup, bySite: bySiteResult.rows, enrollmentRate },
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ success: false, error: '获取看板概览失败' });
  }
});

router.get('/trend/:trialId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT DATE(allocated_at) as date, COUNT(*)::int as count
       FROM subjects
       WHERE trial_id = $1 AND allocated_at IS NOT NULL
       GROUP BY DATE(allocated_at)
       ORDER BY date DESC
       LIMIT 30`,
      [req.params.trialId]
    );
    const cumulative: { date: string; count: number; cumulative: number }[] = [];
    let running = 0;
    const reversed = [...result.rows].reverse();
    for (const row of reversed) {
      running += row.count;
      cumulative.push({ date: row.date, count: row.count, cumulative: running });
    }
    res.json({ success: true, data: cumulative });
  } catch (err) {
    res.status(500).json({ success: false, error: '获取入组趋势失败' });
  }
});

router.get('/balance/:trialId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const factorsResult = await pool.query(
      'SELECT name, levels FROM stratification_factors WHERE trial_id = $1',
      [req.params.trialId]
    );
    const groupsResult = await pool.query(
      'SELECT id, name FROM groups WHERE trial_id = $1',
      [req.params.trialId]
    );
    const groups = groupsResult.rows;

    const balance: { factor: string; levels: { level: string; groups: { group_name: string; count: number }[] }[] }[] = [];

    for (const factor of factorsResult.rows) {
      const levelData: { level: string; groups: { group_name: string; count: number }[] }[] = [];
      const colMap: Record<string, string> = { '年龄段': 'age_group', '性别': 'gender', '疾病分期': 'disease_stage' };
      const col = colMap[factor.name] || factor.name.toLowerCase().replace(/\s+/g, '_');
      const allowedCols = ['age_group', 'gender', 'disease_stage'];
      const safeCol = allowedCols.includes(col) ? col : 'age_group';

      for (const level of factor.levels) {
        const groupCounts: { group_name: string; count: number }[] = [];
        for (const group of groups) {
          const cntResult = await pool.query(
            `SELECT COUNT(*)::int as count FROM subjects
             WHERE trial_id = $1 AND group_id = $2 AND allocation_status IN ('allocated','unblinded') AND ${safeCol} = $3`,
            [req.params.trialId, group.id, level]
          );
          groupCounts.push({ group_name: group.name, count: cntResult.rows[0].count });
        }
        levelData.push({ level, groups: groupCounts });
      }
      balance.push({ factor: factor.name, levels: levelData });
    }

    res.json({ success: true, data: balance });
  } catch (err) {
    console.error('Balance error:', err);
    res.status(500).json({ success: false, error: '获取平衡度数据失败' });
  }
});

export default router;
