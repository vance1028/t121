import { Router, type Response } from 'express';
import pool from '../db/pool.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trialId = req.query.trial_id;
    let query = 'SELECT * FROM sites';
    const params: any[] = [];
    if (trialId) {
      query += ' WHERE trial_id = $1';
      params.push(trialId);
    }
    query += ' ORDER BY code';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: '获取中心列表失败' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { trial_id, name, code } = req.body;
    const result = await pool.query(
      'INSERT INTO sites (trial_id, name, code) VALUES ($1, $2, $3) RETURNING *',
      [trial_id, name, code]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '创建中心失败' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code } = req.body;
    const result = await pool.query(
      'UPDATE sites SET name=COALESCE($1,name), code=COALESCE($2,code) WHERE id=$3 RETURNING *',
      [name, code, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '中心不存在' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '更新中心失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM sites WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '中心不存在' });
      return;
    }
    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: '删除中心失败' });
  }
});

export default router;
