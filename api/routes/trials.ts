import { Router, type Response } from 'express';
import pool from '../db/pool.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM trials ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: '获取试验列表失败' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const trial = await pool.query('SELECT * FROM trials WHERE id = $1', [id]);
    if (trial.rows.length === 0) {
      res.status(404).json({ success: false, error: '试验不存在' });
      return;
    }
    const groups = await pool.query('SELECT * FROM groups WHERE trial_id = $1', [id]);
    const factors = await pool.query('SELECT * FROM stratification_factors WHERE trial_id = $1', [id]);
    const sites = await pool.query('SELECT * FROM sites WHERE trial_id = $1', [id]);
    res.json({
      success: true,
      data: { ...trial.rows[0], groups: groups.rows, stratification_factors: factors.rows, sites: sites.rows },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: '获取试验详情失败' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, status, randomization_method, block_sizes, minimization_probability, seed } = req.body;
    const result = await pool.query(
      `INSERT INTO trials (name, description, status, randomization_method, block_sizes, minimization_probability, seed)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description || '', status || 'active', randomization_method || 'stratified_block',
       block_sizes || [4, 6], minimization_probability || 0.70, seed || 42]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '创建试验失败' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, status, randomization_method, block_sizes, minimization_probability, seed } = req.body;
    const result = await pool.query(
      `UPDATE trials SET name=COALESCE($1,name), description=COALESCE($2,description), status=COALESCE($3,status),
       randomization_method=COALESCE($4,randomization_method), block_sizes=COALESCE($5,block_sizes),
       minimization_probability=COALESCE($6,minimization_probability), seed=COALESCE($7,seed),
       updated_at=CURRENT_TIMESTAMP WHERE id=$8 RETURNING *`,
      [name, description, status, randomization_method, block_sizes, minimization_probability, seed, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '试验不存在' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '更新试验失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM trials WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '试验不存在' });
      return;
    }
    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: '删除试验失败' });
  }
});

router.post('/:id/groups', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, ratio } = req.body;
    const result = await pool.query(
      'INSERT INTO groups (trial_id, name, code, ratio) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, code, ratio || 1]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '创建组别失败' });
  }
});

router.put('/groups/:groupId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const { name, code, ratio } = req.body;
    const result = await pool.query(
      'UPDATE groups SET name=COALESCE($1,name), code=COALESCE($2,code), ratio=COALESCE($3,ratio) WHERE id=$4 RETURNING *',
      [name, code, ratio, groupId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '组别不存在' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '更新组别失败' });
  }
});

router.delete('/groups/:groupId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM groups WHERE id = $1 RETURNING id', [req.params.groupId]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '组别不存在' });
      return;
    }
    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: '删除组别失败' });
  }
});

router.post('/:id/stratification-factors', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, levels } = req.body;
    const result = await pool.query(
      'INSERT INTO stratification_factors (trial_id, name, levels) VALUES ($1, $2, $3) RETURNING *',
      [id, name, levels]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '创建分层因素失败' });
  }
});

router.delete('/stratification-factors/:factorId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM stratification_factors WHERE id = $1 RETURNING id', [req.params.factorId]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '分层因素不存在' });
      return;
    }
    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: '删除分层因素失败' });
  }
});

export default router;
