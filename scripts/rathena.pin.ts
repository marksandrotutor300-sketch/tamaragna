/**
 * Pinned rAthena revision used to generate the bestiary.
 * Bump this deliberately, then run `npm run data:build`.
 *
 * Data is GPL-3.0. See NOTICE.md.
 */
export const RATHENA_SHA = "d4b8e7b8f16061cc2496d377ac8f777ce72a4f39";
export const RATHENA_REPO = "rathena/rathena";

export const RATHENA_DATA_FILES = [
  "db/re/mob_db.yml",
  "db/re/mob_skill_db.txt",
  "db/pre-re/mob_skill_db.txt",
  "db/re/skill_db.yml",
  "db/re/attr_fix.yml",
  "db/re/size_fix.yml",
] as const;
