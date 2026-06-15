export interface RandomizationConfig {
  method: 'stratified_block' | 'minimization';
  groups: { id: number; name: string; code: string; ratio: number }[];
  stratificationFactors: { name: string; levels: string[] }[];
  blockSizes: number[];
  minimizationProbability: number;
  seed: number;
}

export interface AllocationEntry {
  stratificationKey: string;
  position: number;
  groupId: number;
  drugCode: string;
}

export interface MinimizationInput {
  subjectFactors: Record<string, string>;
  currentAllocations: {
    groupId: number;
    factorName: string;
    factorLevel: string;
    count: number;
  }[];
}

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

function getStratificationKeys(factors: { name: string; levels: string[] }[]): string[] {
  if (factors.length === 0) return ['__ALL__'];
  const keys: string[] = [''];
  for (const factor of factors) {
    const newKeys: string[] = [];
    for (const key of keys) {
      for (const level of factor.levels) {
        newKeys.push(key ? `${key}|${factor.name}=${level}` : `${factor.name}=${level}`);
      }
    }
    keys.length = 0;
    keys.push(...newKeys);
  }
  return keys;
}

export function generateStratifiedBlockSequence(config: RandomizationConfig): AllocationEntry[] {
  const rng = new SeededRNG(config.seed);
  const entries: AllocationEntry[] = [];
  const totalRatio = config.groups.reduce((sum, g) => sum + g.ratio, 0);

  const stratKeys = getStratificationKeys(config.stratificationFactors);
  const sequencesPerStrat = 50;

  let drugCounter = 1000;

  for (const stratKey of stratKeys) {
    let position = 0;

    for (let seq = 0; seq < sequencesPerStrat; seq++) {
      const blockSize = config.blockSizes[rng.nextInt(0, config.blockSizes.length - 1)];
      const scaledBlockSize = Math.round(blockSize * totalRatio / Math.min(...config.groups.map(g => g.ratio)));
      const actualBlockSize = Math.max(scaledBlockSize, totalRatio);

      const block: { groupId: number; drugCode: string }[] = [];
      for (const group of config.groups) {
        const countInBlock = Math.round(actualBlockSize * group.ratio / totalRatio);
        for (let i = 0; i < countInBlock; i++) {
          block.push({
            groupId: group.id,
            drugCode: `DC-${String(drugCounter++).padStart(5, '0')}`,
          });
        }
      }

      const shuffled = rng.shuffle(block);

      for (const item of shuffled) {
        entries.push({
          stratificationKey: stratKey,
          position: position++,
          groupId: item.groupId,
          drugCode: item.drugCode,
        });
      }
    }
  }

  return entries;
}

export function minimizationAllocate(
  config: RandomizationConfig,
  input: MinimizationInput,
  rng: SeededRNG
): number {
  const { subjectFactors, currentAllocations } = input;
  const groupScores: Map<number, number> = new Map();
  for (const group of config.groups) {
    groupScores.set(group.id, 0);
  }

  for (const group of config.groups) {
    let totalImbalance = 0;
    for (const [factorName, factorLevel] of Object.entries(subjectFactors)) {
      const countsInGroup = currentAllocations.filter(
        a => a.groupId === group.id && a.factorName === factorName && a.factorLevel === factorLevel
      );
      const currentCount = countsInGroup.reduce((sum, a) => sum + a.count, 0);

      for (const otherGroup of config.groups) {
        if (otherGroup.id === group.id) continue;
        const otherCounts = currentAllocations.filter(
          a => a.groupId === otherGroup.id && a.factorName === factorName && a.factorLevel === factorLevel
        );
        const otherCount = otherCounts.reduce((sum, a) => sum + a.count, 0);
        totalImbalance += Math.abs((currentCount + 1) - otherCount) - Math.abs(currentCount - otherCount);
      }
    }
    groupScores.set(group.id, totalImbalance);
  }

  const minScore = Math.min(...Array.from(groupScores.values()));
  const candidates = config.groups.filter(g => groupScores.get(g.id) === minScore);

  if (candidates.length === 1) {
    if (rng.next() < config.minimizationProbability) {
      return candidates[0].id;
    }
  }

  if (rng.next() < config.minimizationProbability && candidates.length > 0) {
    const idx = rng.nextInt(0, candidates.length - 1);
    return candidates[idx].id;
  }

  const idx = rng.nextInt(0, config.groups.length - 1);
  return config.groups[idx].id;
}

export { SeededRNG };
