/**
 * Helpers for the sellable rehab catalog.
 *
 * A catalog program's `slug` is the join between the landing site's program
 * list (cmpd-landing/app/programs.ts) and the real template in this database.
 * A purchase carries the slug; the app resolves it to a program and assigns
 * it. Keep the two lists in step or a purchase has nothing to hand over.
 */

export type ProgramKind = 'custom' | 'catalog'

export function normalizeProgramKind(value: unknown): ProgramKind {
  return value === 'catalog' ? 'catalog' : 'custom'
}

/**
 * Lowercase, hyphenated, url-safe. Returns null for anything empty so the
 * column stays NULL rather than '' — the unique index ignores NULLs, which
 * is what lets many un-slugged programs coexist.
 */
export function normalizeCatalogSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : null
}

/**
 * Only catalog programs carry a slug. Forcing custom programs to NULL keeps
 * the per-org unique index free for the programs that actually need it.
 */
export function resolveCatalogFields(kindInput: unknown, slugInput: unknown) {
  const program_kind = normalizeProgramKind(kindInput)
  return {
    program_kind,
    slug: program_kind === 'catalog' ? normalizeCatalogSlug(slugInput) : null,
  }
}
