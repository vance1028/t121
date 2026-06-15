import { Router, type Response } from 'express';
import pool from '../db/pool.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { generateStratifiedBlockSequence, type RandomizationConfig } from '../engine/index.js';

const router = Router();
router.use(authMiddleware);

router.get('/sequences/:trialId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { trialId } = req.params;
    const stratKey = req.query.stratification_key;
    let query = `SELECT als.*, g.name as group_name
                 FROM allocation_sequences als
                 JOIN groups g ON als.group_id = g.id
                 WHERE als.trial_id = $1`;
    const params: any[] = [trialId];
    if (stratKey) {
      params.push(stratKey);
      query += ` AND als.stratification_key = $${params.length}`;
    }
    query += ' ORDER BY als.stratification_key, als.position';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: '获取分配序列失败' });
  }
});

router.post('/generate/:trialId', async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const trialResult = await client.query('SELECT * FROM trials WHERE id = $1', [req.params.trialId]);
    if (trialResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: '试验不存在' });
      return;
    }
    const trial = trialResult.rows[0];

    const groups = await client.query('SELECT * FROM groups WHERE trial_id = $1', [req.params.trialId]);
    const factors = await client.query('SELECT * FROM stratification_factors WHERE trial_id = $1', [req.params.trialId]);

    const seed = req.body.seed || trial.seed;

    const config: RandomizationConfig = {
      method: trial.randomization_method,
      groups: groups.rows.map((g: any) => ({ id: g.id, name: g.name, code: g.code, ratio: g.ratio })),
      stratificationFactors: factors.rows.map((f: any) => ({ name: f.name, levels: f.levels })),
      blockSizes: trial.block_sizes,
      minimizationProbability: parseFloat(trial.minimization_probability),
      seed,
    };

    const sequences = generateStratifiedBlockSequence(config);

    for (const entry of sequences) {
      await client.query(
        `INSERT INTO allocation_sequences (trial_id, stratification_key, position, group_id, drug_code, used)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         ON CONFLICT DO NOTHING`,
        [req.params.trialId, entry.stratificationKey, entry.position, entry.groupId, entry.drugCode]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, data: { count: sequences.length, seed } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Generate sequences error:', err);
    res.status(500).json({ success: false, error: '生成分配序列失败' });
  } finally {
    client.release();
  }
});

export default router;
