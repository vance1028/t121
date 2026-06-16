import { Router, type Response } from 'express';
import pool from '../db/pool.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { SeededRNG, minimizationAllocate, type RandomizationConfig, type MinimizationInput } from '../engine/index.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trialId = req.query.trial_id;
    const status = req.query.status;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const offset = (page - 1) * pageSize;

    let countQuery = 'SELECT COUNT(*)::int as total FROM subjects s';
    let dataQuery = `SELECT s.*, si.name as site_name, g.name as group_name
                     FROM subjects s
                     LEFT JOIN sites si ON s.site_id = si.id
                     LEFT JOIN groups g ON s.group_id = g.id`;
    const params: any[] = [];
    const conditions: string[] = [];
    if (trialId) {
      params.push(trialId);
      conditions.push(`s.trial_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`s.allocation_status = $${params.length}`);
    }
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      countQuery += whereClause;
      dataQuery += whereClause;
    }
    dataQuery += ' ORDER BY s.enrolled_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

    const countResult = await pool.query(countQuery, params);
    const dataResult = await pool.query(dataQuery, [...params, pageSize, offset]);

    res.json({
      success: true,
      data: {
        items: dataResult.rows,
        total: countResult.rows[0].total,
        page,
        page_size: pageSize,
        total_pages: Math.ceil(countResult.rows[0].total / pageSize),
      },
    });
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ success: false, error: '获取受试者列表失败' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT s.*, si.name as site_name, g.name as group_name
       FROM subjects s
       LEFT JOIN sites si ON s.site_id = si.id
       LEFT JOIN groups g ON s.group_id = g.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '受试者不存在' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '获取受试者详情失败' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { trial_id, site_id, subject_code, initials, age_group, gender, disease_stage, stratification_data } = req.body;

    const stratData = stratification_data || {};
    const finalAgeGroup = age_group || stratData['年龄段'] || null;
    const finalGender = gender || stratData['性别'] || null;
    const finalStage = disease_stage || stratData['疾病分期'] || null;

    const allStratData = { ...stratData };
    if (finalAgeGroup) allStratData['年龄段'] = finalAgeGroup;
    if (finalGender) allStratData['性别'] = finalGender;
    if (finalStage) allStratData['疾病分期'] = finalStage;

    const result = await pool.query(
      `INSERT INTO subjects (trial_id, site_id, subject_code, initials, age_group, gender, disease_stage, stratification_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [trial_id, site_id, subject_code, initials, finalAgeGroup, finalGender, finalStage, JSON.stringify(allStratData)]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(400).json({ success: false, error: '受试者编号已存在' });
      return;
    }
    console.error('Create subject error:', err);
    res.status(500).json({ success: false, error: '创建受试者失败' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { initials, age_group, gender, disease_stage, site_id } = req.body;
    const result = await pool.query(
      `UPDATE subjects SET initials=COALESCE($1,initials), age_group=COALESCE($2,age_group),
       gender=COALESCE($3,gender), disease_stage=COALESCE($4,disease_stage), site_id=COALESCE($5,site_id)
       WHERE id=$6 RETURNING *`,
      [initials, age_group, gender, disease_stage, site_id, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '受试者不存在' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: '更新受试者失败' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '受试者不存在' });
      return;
    }
    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: '删除受试者失败' });
  }
});

router.post('/:id/allocate', async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subjectResult = await client.query('SELECT * FROM subjects WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (subjectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: '受试者不存在' });
      return;
    }
    const subject = subjectResult.rows[0];
    if (subject.allocation_status !== 'pending') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: '该受试者已分配' });
      return;
    }

    const trialResult = await client.query('SELECT * FROM trials WHERE id = $1', [subject.trial_id]);
    const trial = trialResult.rows[0];

    const groupsResult = await client.query('SELECT * FROM groups WHERE trial_id = $1', [subject.trial_id]);
    const groups = groupsResult.rows;

    const factorsResult = await client.query('SELECT * FROM stratification_factors WHERE trial_id = $1', [subject.trial_id]);
    const factors = factorsResult.rows;

    let allocatedGroupId: number;
    let drugCode: string;

    if (trial.randomization_method === 'stratified_block') {
      const stratData = subject.stratification_data || {};
      const stratKey = factors.length === 0 ? '__ALL__'
        : factors.map((f: any) => `${f.name}=${stratData[f.name] || ''}`).join('|');

      const seqResult = await client.query(
        `SELECT * FROM allocation_sequences
         WHERE trial_id = $1 AND stratification_key = $2 AND used = FALSE
         ORDER BY position LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [subject.trial_id, stratKey]
      );

      if (seqResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, error: '该分层下分配序列已耗尽，请生成更多序列' });
        return;
      }

      const seq = seqResult.rows[0];
      allocatedGroupId = seq.group_id;
      drugCode = seq.drug_code;

      await client.query(
        'UPDATE allocation_sequences SET used = TRUE, subject_id = $1, used_at = CURRENT_TIMESTAMP WHERE id = $2',
        [subject.id, seq.id]
      );
    } else {
      const rng = new SeededRNG(trial.seed + subject.id * 7919 + Date.now() % 10000);

      const allocResult = await client.query(
        `SELECT s.group_id, sf.name as factor_name,
                COALESCE(s.stratification_data->>sf.name, '') as factor_level,
                COUNT(*)::int as count
         FROM subjects s
         CROSS JOIN stratification_factors sf
         WHERE s.trial_id = $1 AND s.allocation_status IN ('allocated', 'unblinded')
         GROUP BY s.group_id, sf.name, factor_level`,
        [subject.trial_id]
      );

      const stratData = subject.stratification_data || {};
      const subjectFactors: Record<string, string> = {};
      for (const f of factors) {
        subjectFactors[f.name] = stratData[f.name] || '';
      }

      const config: RandomizationConfig = {
        method: 'minimization',
        groups: groups.map((g: any) => ({ id: g.id, name: g.name, code: g.code, ratio: g.ratio })),
        stratificationFactors: factors.map((f: any) => ({ name: f.name, levels: f.levels })),
        blockSizes: trial.block_sizes,
        minimizationProbability: parseFloat(trial.minimization_probability),
        seed: trial.seed,
      };

      const input: MinimizationInput = {
        subjectFactors,
        currentAllocations: allocResult.rows.map((r: any) => ({
          groupId: r.group_id,
          factorName: r.factor_name,
          factorLevel: r.factor_level,
          count: r.count,
        })),
      };

      allocatedGroupId = minimizationAllocate(config, input, rng);

      const dcResult = await client.query(
        `SELECT drug_code FROM allocation_sequences
         WHERE trial_id = $1 AND group_id = $2 AND used = FALSE
         ORDER BY position LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [subject.trial_id, allocatedGroupId]
      );

      if (dcResult.rows.length > 0) {
        drugCode = dcResult.rows[0].drug_code;
        await client.query(
          'UPDATE allocation_sequences SET used = TRUE, subject_id = $1, used_at = CURRENT_TIMESTAMP WHERE drug_code = $2',
          [subject.id, drugCode]
        );
      } else {
        const dc = `DC-${String(Date.now()).slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
        drugCode = dc;
        const groupObj = groups.find((g: any) => g.id === allocatedGroupId);
        const stratKey = factors.length === 0 ? '__ALL__'
          : factors.map((f: any) => `${f.name}=${subjectFactors[f.name]}`).join('|');
        const maxPos = await client.query(
          'SELECT COALESCE(MAX(position), -1) as max_pos FROM allocation_sequences WHERE trial_id = $1 AND stratification_key = $2',
          [subject.trial_id, stratKey]
        );
        await client.query(
          'INSERT INTO allocation_sequences (trial_id, stratification_key, position, group_id, drug_code, used, subject_id, used_at) VALUES ($1, $2, $3, $4, $5, TRUE, $6, CURRENT_TIMESTAMP)',
          [subject.trial_id, stratKey, maxPos.rows[0].max_pos + 1, allocatedGroupId, drugCode, subject.id]
        );
      }
    }

    await client.query(
      `UPDATE subjects SET allocation_status = 'allocated', drug_code = $1, group_id = $2, allocated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [drugCode, allocatedGroupId, subject.id]
    );

    await client.query('COMMIT');

    const groupObj = groups.find((g: any) => g.id === allocatedGroupId);
    res.json({
      success: true,
      data: { drug_code: drugCode, group_id: allocatedGroupId, group_name: groupObj?.name },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Allocation error:', err);
    res.status(500).json({ success: false, error: '分配失败' });
  } finally {
    client.release();
  }
});

export default router;
