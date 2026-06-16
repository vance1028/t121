import { Router, type Response } from 'express';
import pool from '../db/pool.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { subject_id, reason } = req.body;
    if (!subject_id || !reason) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: '受试者ID和揭盲原因不能为空' });
      return;
    }

    const subjectResult = await client.query('SELECT * FROM subjects WHERE id = $1 FOR UPDATE', [subject_id]);
    if (subjectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: '受试者不存在' });
      return;
    }
    const subject = subjectResult.rows[0];

    if (subject.allocation_status === 'pending') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: '该受试者尚未分配，无法揭盲' });
      return;
    }

    if (subject.allocation_status === 'unblinded') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: '该受试者已揭盲，不可重复操作' });
      return;
    }

    const groupResult = await client.query('SELECT name FROM groups WHERE id = $1', [subject.group_id]);
    const groupName = groupResult.rows[0]?.name || '未知';

    await client.query(
      `INSERT INTO unblind_records (subject_id, unblinded_by, reason, revealed_group)
       VALUES ($1, $2, $3, $4)`,
      [subject_id, req.userId, reason, groupName]
    );

    await client.query(
      "UPDATE subjects SET allocation_status = 'unblinded' WHERE id = $1",
      [subject_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        subject_id,
        subject_code: subject.subject_code,
        drug_code: subject.drug_code,
        revealed_group: groupName,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Unblind error:', err);
    res.status(500).json({ success: false, error: '揭盲操作失败' });
  } finally {
    client.release();
  }
});

router.get('/records', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trialId = req.query.trial_id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const offset = (page - 1) * pageSize;

    let countQuery = 'SELECT COUNT(*)::int as total FROM unblind_records ur JOIN subjects s ON ur.subject_id = s.id';
    let dataQuery = `SELECT ur.*, s.subject_code, u.username as operator_name
                     FROM unblind_records ur
                     JOIN subjects s ON ur.subject_id = s.id
                     JOIN users u ON ur.unblinded_by = u.id`;
    const params: any[] = [];
    if (trialId) {
      params.push(trialId);
      const whereClause = ` WHERE s.trial_id = $${params.length}`;
      countQuery += whereClause;
      dataQuery += whereClause;
    }
    dataQuery += ' ORDER BY ur.unblinded_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);

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
    res.status(500).json({ success: false, error: '获取揭盲记录失败' });
  }
});

export default router;
