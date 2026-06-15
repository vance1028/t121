import pool from './pool.js';
import { generateStratifiedBlockSequence, type RandomizationConfig } from '../engine/index.js';

let seeded = false;

export async function seedData() {
  const check = await pool.query("SELECT COUNT(*)::int as cnt FROM trials");
  if (check.rows[0].cnt > 0) {
    return;
  }
  if (seeded) return;
  seeded = true;

  console.log('Seeding initial data...');

  const trialResult = await pool.query(
    `INSERT INTO trials (name, description, status, randomization_method, block_sizes, minimization_probability, seed)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ['XIN-2024-001 非小细胞肺癌III期试验', '评估新药XIN-101对比标准化疗在晚期非小细胞肺癌患者中的疗效与安全性', 'active', 'stratified_block', [4, 6, 8], 0.70, 12345]
  );
  const trialId = trialResult.rows[0].id;

  const groupExp = await pool.query(
    `INSERT INTO groups (trial_id, name, code, ratio) VALUES ($1, $2, $3, $4) RETURNING id`,
    [trialId, '试验组', 'EXP', 2]
  );
  const groupCtrl = await pool.query(
    `INSERT INTO groups (trial_id, name, code, ratio) VALUES ($1, $2, $3, $4) RETURNING id`,
    [trialId, '对照组', 'CTR', 1]
  );
  const expGroupId = groupExp.rows[0].id;
  const ctrlGroupId = groupCtrl.rows[0].id;

  await pool.query(
    `INSERT INTO stratification_factors (trial_id, name, levels) VALUES ($1, $2, $3)`,
    [trialId, '年龄段', ['18-39', '40-59', '60+']]
  );
  await pool.query(
    `INSERT INTO stratification_factors (trial_id, name, levels) VALUES ($1, $2, $3)`,
    [trialId, '性别', ['男', '女']]
  );
  await pool.query(
    `INSERT INTO stratification_factors (trial_id, name, levels) VALUES ($1, $2, $3)`,
    [trialId, '疾病分期', ['IIIA', 'IIIB', 'IV']]
  );

  const sites = [
    ['北京协和医院', 'BJ-XH'],
    ['上海中山医院', 'SH-ZS'],
    ['广州中山医院', 'GZ-ZS'],
    ['成都华西医院', 'CD-HX'],
    ['南京鼓楼医院', 'NJ-GL'],
  ];
  const siteIds: number[] = [];
  for (const [name, code] of sites) {
    const r = await pool.query(
      `INSERT INTO sites (trial_id, name, code) VALUES ($1, $2, $3) RETURNING id`,
      [trialId, name, code]
    );
    siteIds.push(r.rows[0].id);
  }

  const config: RandomizationConfig = {
    method: 'stratified_block',
    groups: [
      { id: expGroupId, name: '试验组', code: 'EXP', ratio: 2 },
      { id: ctrlGroupId, name: '对照组', code: 'CTR', ratio: 1 },
    ],
    stratificationFactors: [
      { name: '年龄段', levels: ['18-39', '40-59', '60+'] },
      { name: '性别', levels: ['男', '女'] },
      { name: '疾病分期', levels: ['IIIA', 'IIIB', 'IV'] },
    ],
    blockSizes: [4, 6, 8],
    minimizationProbability: 0.70,
    seed: 12345,
  };

  const sequences = generateStratifiedBlockSequence(config);
  for (const entry of sequences) {
    await pool.query(
      `INSERT INTO allocation_sequences (trial_id, stratification_key, position, group_id, drug_code, used)
       VALUES ($1, $2, $3, $4, $5, FALSE)`,
      [trialId, entry.stratificationKey, entry.position, entry.groupId, entry.drugCode]
    );
  }

  const ageGroups = ['18-39', '40-59', '60+'];
  const genders = ['男', '女'];
  const stages = ['IIIA', 'IIIB', 'IV'];
  const initialsPool = [
    'ZS', 'LW', 'WH', 'XM', 'CL', 'YJ', 'HZ', 'PF', 'RG', 'TN',
    'MK', 'QB', 'SD', 'UE', 'VF', 'WA', 'XB', 'YC', 'ZD', 'AE',
    'BF', 'CG', 'DH', 'EI', 'FJ', 'GK', 'HL', 'IM', 'JN', 'KO',
    'LP', 'MQ', 'NR', 'OS', 'PT', 'QU', 'RV', 'SW', 'TX', 'UY',
    'VA', 'WB', 'XC', 'YD', 'ZE', 'AF', 'BG', 'CH', 'DI', 'EJ',
  ];

  const subjectCount = 48;
  const allocatedSubjectIds: number[] = [];

  const seqMap = new Map<string, any[]>();
  const allSeqs = await pool.query(
    `SELECT * FROM allocation_sequences WHERE trial_id = $1 ORDER BY stratification_key, position`,
    [trialId]
  );
  for (const row of allSeqs.rows) {
    if (!seqMap.has(row.stratification_key)) seqMap.set(row.stratification_key, []);
    seqMap.get(row.stratification_key)!.push(row);
  }

  for (let i = 0; i < subjectCount; i++) {
    const ageGroup = ageGroups[i % 3];
    const gender = genders[i % 2];
    const stage = stages[i % 3];
    const siteId = siteIds[i % siteIds.length];
    const subjectCode = `XIN-${String(i + 1).padStart(3, '0')}`;
    const initial = initialsPool[i % initialsPool.length];

    const stratKey = `年龄段=${ageGroup}|性别=${gender}|疾病分期=${stage}`;
    const seqList = seqMap.get(stratKey);

    if (!seqList || seqList.length === 0) continue;

    const nextUnused = seqList.find((s: any) => !s.used);
    if (!nextUnused) continue;

    const enrolledDate = new Date(2024, 0, 10 + i);
    const allocatedDate = new Date(2024, 0, 11 + i);

    const subjectResult = await pool.query(
      `INSERT INTO subjects (trial_id, site_id, subject_code, initials, age_group, gender, disease_stage, allocation_status, drug_code, group_id, enrolled_at, allocated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'allocated', $8, $9, $10, $11) RETURNING id`,
      [trialId, siteId, subjectCode, initial, ageGroup, gender, stage, nextUnused.drug_code, nextUnused.group_id, enrolledDate, allocatedDate]
    );

    allocatedSubjectIds.push(subjectResult.rows[0].id);
    nextUnused.used = true;

    await pool.query(
      'UPDATE allocation_sequences SET used = TRUE, subject_id = $1, used_at = $2 WHERE id = $3',
      [subjectResult.rows[0].id, allocatedDate, nextUnused.id]
    );
  }

  const userResult = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  const adminId = userResult.rows[0].id;

  const unblindSubjects = [0, 7, 23, 35];
  for (const idx of unblindSubjects) {
    if (idx >= allocatedSubjectIds.length) continue;
    const subjectId = allocatedSubjectIds[idx];
    const subjectData = await pool.query('SELECT group_id, subject_code, drug_code FROM subjects WHERE id = $1', [subjectId]);
    const groupData = await pool.query('SELECT name FROM groups WHERE id = $1', [subjectData.rows[0].group_id]);

    await pool.query(
      `INSERT INTO unblind_records (subject_id, unblinded_by, reason, revealed_group, unblinded_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        subjectId,
        adminId,
        ['严重不良事件需紧急处理', '药物相互作用需确认组别', '受试者严重过敏反应', '紧急手术需确认用药'][unblindSubjects.indexOf(idx)],
        groupData.rows[0].name,
        new Date(2024, 1, 5 + idx),
      ]
    );

    await pool.query(
      "UPDATE subjects SET allocation_status = 'unblinded' WHERE id = $1",
      [subjectId]
    );
  }

  const pendingCount = 5;
  for (let i = 0; i < pendingCount; i++) {
    const ageGroup = ageGroups[(subjectCount + i) % 3];
    const gender = genders[(subjectCount + i) % 2];
    const stage = stages[(subjectCount + i) % 3];
    const siteId = siteIds[(subjectCount + i) % siteIds.length];
    const subjectCode = `XIN-${String(subjectCount + i + 1).padStart(3, '0')}`;
    const initial = initialsPool[(subjectCount + i) % initialsPool.length];

    await pool.query(
      `INSERT INTO subjects (trial_id, site_id, subject_code, initials, age_group, gender, disease_stage, allocation_status, enrolled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
      [trialId, siteId, subjectCode, initial, ageGroup, gender, stage, new Date(2024, 2, 1 + i)]
    );
  }

  console.log('Seed data created successfully');
}
