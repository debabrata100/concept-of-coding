/**
 const buildStats = <T extends string[]>(stats: T) => {
    return stats;
}
const stats = buildStats(["PENDING", "FAILED", "SUCCESS"]);
 */

const buildStats = <T extends string>(stats: T[]) => {
  return stats;
};

const stats = buildStats(["PENDING", "FAILED", "SUCCESS"]);
