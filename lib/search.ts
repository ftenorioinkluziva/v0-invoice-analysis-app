export function buildSearchPatterns(search: string) {
  return search
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map(term => `%${term}%`)
}
