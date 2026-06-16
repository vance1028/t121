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

    if (groups.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: '请先配置组别' });
      return;
    }

    const seed = req.body.seed || trial.seed;
    const extend = req.body.extend !== false;

    const config: RandomizationConfig = {
      method: trial.randomization_method,
      groups: groups.rows.map((g: any) => ({ id: g.id, name: g.name, code: g.code, ratio: g.ratio })),
      stratificationFactors: factors.rows.map((f: any) => ({ name: f.name, levels: f.levels })),
      blockSizes: trial.block_sizes,
      minimizationProbability: parseFloat(trial.minimization_probability),
      seed,
    };

    const existingMaxPos = new Map<string, number>();
    if (extend) {
      const existing = await client.query(
        'SELECT stratification_key, MAX(position) as max_pos FROM allocation_sequences WHERE trial_id = $1 GROUP BY stratification_key',
        [req.params.trialId]
      );
      for (const row of existing.rows) {
        existingMaxPos.set(row.stratification_key, row.max_pos);
      }
    }

    const sequences = generateStratifiedBlockSequence(config);

    let insertedCount = 0;
    let totalCount = 0;

    for (const entry of sequences) {
      const maxPos = existingMaxPos.get(entry.stratificationKey);
      const offset = maxPos !== undefined ? maxPos + 1 : 0;
      const newPosition = entry.position + offset;
      const drugCodeSuffix = entry.drugCode.replace('DC-', '');
      const newDrugCode = `DC-${String(parseInt(drugCodeSuffix) + (offset * 10)).padStart(5, '0')}`;

      try {
        const result = await client.query(
          `INSERT INTO allocation_sequences (trial_id, stratification_key, position, group_id, drug_code, used)
           VALUES ($1, $2, $3, $4, $5, FALSE)
           ON CONFLICT (trial_id, stratification_key, position) DO NOTHING
           RETURNING id`,
          [req.params.trialId, entry.stratificationKey, newPosition, entry.groupId, newDrugCode]
        );
        if (result.rows.length > 0) insertedCount++;
      } catch (e) {
      }
    }

    const totalResult = await client.query(
      'SELECT COUNT(*)::int as total FROM allocation_sequences WHERE trial_id = $1',
      [req.params.trialId]
    );
    totalCount = totalResult.rows[0].total;

    await client.query('COMMIT');
    res.json({
      success: true,
      data: {
        inserted_count: insertedCount,
        total_count: totalCount,
        seed,
        is_extend: extend && existingMaxPos.size > 0,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Generate sequences error:', err);
    res.status(500).json({ success: false, error: '生成分配序列失败' });
  } finally {
    client.release();
  }
});

export default router;
