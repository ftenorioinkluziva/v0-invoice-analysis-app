import type { PoolClient } from '@neondatabase/serverless'
import { ComparableBaseUnitSchema, ProductGroupSuggestionResponseSchema } from '@/lib/validations'

export const PRODUCT_GROUP_SUGGESTION_THRESHOLD = 0.75
const REJECTED_SCORE_DELTA_THRESHOLD = 0.15
const UNIT_TOKENS = new Set(['kg', 'g', 'l', 'lt', 'ml'])

type ComparableBaseUnit = 'kg' | 'L'
type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'superseded'

type SourceProductRow = {
  id: number
  normalized_name: string
  category: string | null
  brand: string | null
  comparable_group_id: number | null
  comparable_base_unit: ComparableBaseUnit | null
}

type GroupMemberRow = {
  group_id: number
  display_name: string
  base_unit: ComparableBaseUnit
  member_product_id: number
  normalized_name: string
  category: string | null
  brand: string | null
}

type SuggestionSignalsSnapshot = {
  normalized_name: string
  category: string | null
  comparable_base_unit: ComparableBaseUnit
  comparable_group_id: number | null
  target_group_id: number
}

type RejectedSuggestionRow = {
  source_product_id: number
  target_group_id: number
  confidence: number
  signals_snapshot: SuggestionSignalsSnapshot
}

type SuggestionRow = {
  id: number
  source_product_id: number
  target_group_id: number
  confidence: number
  reasons: string[]
  status: SuggestionStatus
}

type PersistedSuggestionRow = SuggestionRow & {
  signals_snapshot: SuggestionSignalsSnapshot
}

type ProductRow = {
  id: number
  normalized_name: string
  category: string | null
  brand: string | null
  comparable_group_id: number | null
}

type GroupRow = {
  id: number
  display_name: string
  base_unit: ComparableBaseUnit
}

export async function recomputeProductGroupSuggestions(client: PoolClient, userId: string) {
  const [sources, groupMembers, rejectedSuggestions] = await Promise.all([
    getSourceProducts(client, userId),
    getGroupMembers(client, userId),
    getLatestRejectedSuggestions(client, userId),
  ])

  const groupMembersById = new Map<number, GroupMemberRow[]>()
  for (const member of groupMembers) {
    const group = groupMembersById.get(member.group_id)
    if (group) {
      group.push(member)
      continue
    }

    groupMembersById.set(member.group_id, [member])
  }

  const rejectedByPair = new Map<string, RejectedSuggestionRow>()
  for (const rejected of rejectedSuggestions) {
    rejectedByPair.set(buildPairKey(rejected.source_product_id, rejected.target_group_id), rejected)
  }

  const pendingSuggestions: PersistedSuggestionRow[] = []

  for (const source of sources) {
    if (source.comparable_group_id !== null || source.comparable_base_unit === null) {
      continue
    }

    let bestSuggestion: PersistedSuggestionRow | null = null

    for (const [groupId, members] of groupMembersById) {
      const groupBaseUnit = members[0]?.base_unit
      if (!groupBaseUnit || groupBaseUnit !== source.comparable_base_unit) {
        continue
      }

      const candidate = buildSuggestionCandidate(source, members)
      if (!candidate || candidate.confidence < PRODUCT_GROUP_SUGGESTION_THRESHOLD) {
        continue
      }

      const rejected = rejectedByPair.get(buildPairKey(source.id, groupId))
      if (!shouldSurfaceSuggestionAfterRejection(rejected, source, candidate.target_group_id, candidate.confidence)) {
        continue
      }

      if (!bestSuggestion || candidate.confidence > bestSuggestion.confidence) {
        bestSuggestion = candidate
      }
    }

    if (bestSuggestion) {
      pendingSuggestions.push(bestSuggestion)
    }
  }

  await client.query(
    `
      UPDATE product_group_suggestions
      SET status = 'superseded',
          changed_by = 'system',
          change_origin = 'recompute',
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND status = 'pending'
    `,
    [userId]
  )

  for (const suggestion of pendingSuggestions) {
    await client.query(
      `
        INSERT INTO product_group_suggestions (
          user_id,
          source_product_id,
          target_group_id,
          confidence,
          reasons,
          status,
          signals_snapshot,
          changed_by,
          change_origin
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', $6::jsonb, 'system', 'heuristic')
      `,
      [
        userId,
        suggestion.source_product_id,
        suggestion.target_group_id,
        suggestion.confidence,
        JSON.stringify(suggestion.reasons),
        JSON.stringify(suggestion.signals_snapshot),
      ]
    )
  }
}

export async function listPendingProductGroupSuggestions(client: PoolClient, userId: string) {
  const result = await client.query<SuggestionRow>(
    `
      SELECT id, source_product_id, target_group_id, confidence, reasons, status
      FROM product_group_suggestions
      WHERE user_id = $1
        AND status = 'pending'
      ORDER BY confidence DESC, created_at DESC
    `,
    [userId]
  )

  return result.rows.map(row => ProductGroupSuggestionResponseSchema.parse(row))
}

export async function acceptProductGroupSuggestion(client: PoolClient, suggestionId: number, userId: string) {
  const suggestion = await getPendingSuggestion(client, suggestionId, userId)
  if (!suggestion) {
    return { kind: 'not_found' as const }
  }

  const invalidReason = await getSuggestionInvalidReason(client, suggestion, userId)
  if (invalidReason) {
    return { kind: 'invalid' as const, message: invalidReason }
  }

  await client.query(
    `
      UPDATE products
      SET comparable_group_id = $1
      WHERE id = $2 AND user_id = $3
    `,
    [suggestion.target_group_id, suggestion.source_product_id, userId]
  )

  await client.query(
    `
      INSERT INTO product_group_membership_events (
        product_id,
        group_id,
        user_id,
        event_type,
        changed_by
      )
      VALUES ($1, $2, $3, 'associate', $4)
    `,
    [suggestion.source_product_id, suggestion.target_group_id, userId, userId]
  )

  const result = await client.query<SuggestionRow>(
    `
      UPDATE product_group_suggestions
      SET status = 'accepted',
          decision_at = CURRENT_TIMESTAMP,
          changed_by = $3,
          change_origin = 'accept',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, source_product_id, target_group_id, confidence, reasons, status
    `,
    [suggestionId, userId, userId]
  )

  return { kind: 'ok' as const, suggestion: ProductGroupSuggestionResponseSchema.parse(result.rows[0]) }
}

export async function rejectProductGroupSuggestion(client: PoolClient, suggestionId: number, userId: string) {
  const suggestion = await getPendingSuggestion(client, suggestionId, userId)
  if (!suggestion) {
    return { kind: 'not_found' as const }
  }

  const invalidReason = await getSuggestionInvalidReason(client, suggestion, userId)
  if (invalidReason) {
    return { kind: 'invalid' as const, message: invalidReason }
  }

  const result = await client.query<SuggestionRow>(
    `
      UPDATE product_group_suggestions
      SET status = 'rejected',
          decision_at = CURRENT_TIMESTAMP,
          changed_by = $3,
          change_origin = 'reject',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, source_product_id, target_group_id, confidence, reasons, status
    `,
    [suggestionId, userId, userId]
  )

  return { kind: 'ok' as const, suggestion: ProductGroupSuggestionResponseSchema.parse(result.rows[0]) }
}

export function scoreProductGroupSuggestion(source: Pick<SourceProductRow, 'normalized_name' | 'category' | 'brand' | 'comparable_base_unit'>, target: Pick<GroupMemberRow, 'normalized_name' | 'category' | 'brand' | 'base_unit'>) {
  if (source.comparable_base_unit === null || source.comparable_base_unit !== target.base_unit) {
    return null
  }

  const sourceTokens = tokenizeComparableName(source.normalized_name)
  const targetTokens = tokenizeComparableName(target.normalized_name)

  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return null
  }

  const sharedTokens = sourceTokens.filter(token => targetTokens.includes(token))
  const firstTokenMatches = sourceTokens[0] === targetTokens[0]
  const sameCategory = Boolean(source.category && target.category && source.category === target.category)
  const sameBrand = Boolean(source.brand && target.brand && normalizeText(source.brand) === normalizeText(target.brand))
  const overlapRatio = sharedTokens.length / Math.max(sourceTokens.length, targetTokens.length)

  let confidence = 0.2 + overlapRatio * 0.35
  if (firstTokenMatches) confidence += 0.2
  if (sharedTokens.length > 0) confidence += 0.1
  if (sameCategory) confidence += 0.15
  if (sameBrand) confidence += 0.1
  if (normalizeText(source.normalized_name) === normalizeText(target.normalized_name)) confidence = Math.max(confidence, 0.98)

  const reasons = ['Unidade base compativel']
  if (normalizeText(source.normalized_name) === normalizeText(target.normalized_name)) {
    reasons.push('Nome normalizado igual')
  } else {
    if (firstTokenMatches) reasons.push('Nucleo textual principal coincide')
    if (sharedTokens.length > 1) reasons.push('Multiplos termos relevantes em comum')
    else if (sharedTokens.length === 1) reasons.push('Termo relevante em comum')
  }

  if (sameCategory) reasons.push('Categoria igual')
  if (sameBrand) reasons.push('Marca coincide')

  return {
    confidence: Math.min(0.99, roundConfidence(confidence)),
    reasons,
  }
}

export function shouldSurfaceSuggestionAfterRejection(
  rejected: RejectedSuggestionRow | undefined,
  source: Pick<SourceProductRow, 'normalized_name' | 'category' | 'comparable_base_unit' | 'comparable_group_id'>,
  targetGroupId: number,
  confidence: number
) {
  if (!rejected) {
    return true
  }

  const previous = rejected.signals_snapshot
  const materialChange = previous.normalized_name !== source.normalized_name
    || previous.category !== source.category
    || previous.comparable_base_unit !== source.comparable_base_unit
    || previous.target_group_id !== targetGroupId

  if (materialChange) {
    return true
  }

  return roundConfidence(confidence - rejected.confidence) >= REJECTED_SCORE_DELTA_THRESHOLD
}

function buildSuggestionCandidate(source: SourceProductRow, members: GroupMemberRow[]): PersistedSuggestionRow | null {
  let bestMember: GroupMemberRow | null = null
  let bestScore: ReturnType<typeof scoreProductGroupSuggestion> = null

  for (const member of members) {
    const score = scoreProductGroupSuggestion(source, member)
    if (!score) {
      continue
    }

    if (!bestScore || score.confidence > bestScore.confidence) {
      bestScore = score
      bestMember = member
    }
  }

  if (!bestMember || !bestScore) {
    return null
  }

  return {
    id: 0,
    source_product_id: source.id,
    target_group_id: bestMember.group_id,
    confidence: bestScore.confidence,
    reasons: bestScore.reasons,
    status: 'pending',
    signals_snapshot: {
      normalized_name: source.normalized_name,
      category: source.category,
      comparable_base_unit: ComparableBaseUnitSchema.parse(source.comparable_base_unit),
      comparable_group_id: source.comparable_group_id,
      target_group_id: bestMember.group_id,
    },
  }
}

async function getSourceProducts(client: PoolClient, userId: string) {
  const result = await client.query<SourceProductRow>(
    `
      WITH latest_comparable_evidence AS (
        SELECT DISTINCT ON (ii.product_id)
          ii.product_id,
          ii.comparable_base_unit
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = $1
        WHERE ii.user_id = $1
          AND ii.comparable_base_unit IS NOT NULL
        ORDER BY ii.product_id, i.purchase_date DESC, ii.id DESC
      )
      SELECT p.id, p.normalized_name, p.category, p.brand, p.comparable_group_id, lce.comparable_base_unit
      FROM products p
      LEFT JOIN latest_comparable_evidence lce ON lce.product_id = p.id
      WHERE p.user_id = $1
    `,
    [userId]
  )

  return result.rows
}

async function getGroupMembers(client: PoolClient, userId: string) {
  const result = await client.query<GroupMemberRow>(
    `
      SELECT
        pg.id AS group_id,
        pg.display_name,
        pg.base_unit,
        p.id AS member_product_id,
        p.normalized_name,
        p.category,
        p.brand
      FROM product_groups pg
      JOIN products p ON p.comparable_group_id = pg.id AND p.user_id = pg.user_id
      WHERE pg.user_id = $1
      ORDER BY pg.id, p.id
    `,
    [userId]
  )

  return result.rows
}

async function getLatestRejectedSuggestions(client: PoolClient, userId: string) {
  const result = await client.query<RejectedSuggestionRow>(
    `
      SELECT DISTINCT ON (source_product_id, target_group_id)
        source_product_id,
        target_group_id,
        confidence,
        signals_snapshot
      FROM product_group_suggestions
      WHERE user_id = $1
        AND status = 'rejected'
      ORDER BY source_product_id, target_group_id, decision_at DESC NULLS LAST, created_at DESC
    `,
    [userId]
  )

  return result.rows
}

async function getPendingSuggestion(client: PoolClient, suggestionId: number, userId: string) {
  const result = await client.query<PersistedSuggestionRow>(
    `
      SELECT id, source_product_id, target_group_id, confidence, reasons, status, signals_snapshot
      FROM product_group_suggestions
      WHERE id = $1
        AND user_id = $2
        AND status = 'pending'
      LIMIT 1
    `,
    [suggestionId, userId]
  )

  return result.rows[0] ?? null
}

async function getSuggestionInvalidReason(client: PoolClient, suggestion: PersistedSuggestionRow, userId: string) {
  const [product, group, comparableBaseUnit] = await Promise.all([
    getProduct(client, suggestion.source_product_id, userId),
    getGroup(client, suggestion.target_group_id, userId),
    getLatestComparableBaseUnit(client, suggestion.source_product_id, userId),
  ])

  if (!product || !group) {
    return 'Suggestion is obsolete'
  }

  if (product.comparable_group_id !== suggestion.signals_snapshot.comparable_group_id) {
    return 'Suggestion is obsolete'
  }

  if (comparableBaseUnit !== suggestion.signals_snapshot.comparable_base_unit) {
    return 'Suggestion is obsolete'
  }

  if (group.id !== suggestion.signals_snapshot.target_group_id || group.base_unit !== suggestion.signals_snapshot.comparable_base_unit) {
    return 'Suggestion is obsolete'
  }

  return null
}

async function getProduct(client: PoolClient, productId: number, userId: string) {
  const result = await client.query<ProductRow>(
    `
      SELECT id, normalized_name, category, brand, comparable_group_id
      FROM products
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [productId, userId]
  )

  return result.rows[0] ?? null
}

async function getGroup(client: PoolClient, groupId: number, userId: string) {
  const result = await client.query<GroupRow>(
    `
      SELECT id, display_name, base_unit
      FROM product_groups
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [groupId, userId]
  )

  return result.rows[0] ?? null
}

async function getLatestComparableBaseUnit(client: PoolClient, productId: number, userId: string) {
  const result = await client.query<{ comparable_base_unit: ComparableBaseUnit }>(
    `
      SELECT ii.comparable_base_unit
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = $2
      WHERE ii.product_id = $1
        AND ii.user_id = $2
        AND ii.comparable_base_unit IS NOT NULL
      ORDER BY i.purchase_date DESC, ii.id DESC
      LIMIT 1
    `,
    [productId, userId]
  )

  return result.rows[0]?.comparable_base_unit ?? null
}

function tokenizeComparableName(value: string) {
  return normalizeText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length > 1 && !UNIT_TOKENS.has(token) && !/\d/.test(token))
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPairKey(sourceProductId: number, targetGroupId: number) {
  return `${sourceProductId}:${targetGroupId}`
}

function roundConfidence(value: number) {
  return Math.round(value * 1000) / 1000
}
