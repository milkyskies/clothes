import { runLength } from "./assemble"
import { boundaryOffsets, edgeGaps, type Span, sameEdge } from "./assembly"
import { cuttingLayout } from "./cutting"
import type { Draft, EdgeRef, Panel } from "./draft"
import { findPanel } from "./draft"

/**
 * What a difference in centimetres means at the machine.
 *
 * Cloth eases over a small disagreement between two edges, so a few millimetres
 * is not worth reporting and a couple of centimetres is a drafting mistake.
 */
const EASE_LIMIT = 0.5
const UNSEWABLE_LIMIT = 2

export type Severity = "error" | "warn" | "info"

/** Shaped like the editor's selection so a row can point straight at what it is about. */
export interface CheckTarget {
	readonly panelId?: string
	readonly edgeVertexId?: string
	readonly seamId?: string
}

export interface CheckResult {
	readonly id: string
	readonly severity: Severity
	readonly title: string
	readonly detail: string
	readonly target: CheckTarget
	/** Which view the thing at fault is worked on in. */
	readonly fix: "draw" | "assemble" | "cutting"
}

interface BoundaryRun {
	readonly edge: EdgeRef
	readonly span: Span
	readonly startKey: string
	readonly endKey: string
	readonly length: number
}

function panelName(draft: Draft, panelId: string): string {
	return findPanel(draft, panelId)?.name ?? "?"
}

function round(value: number): string {
	return value.toFixed(1)
}

function makeGroups() {
	const parent = new Map<string, string>()

	function find(key: string): string {
		const seen = parent.get(key)

		if (seen === undefined || seen === key) {
			parent.set(key, key)

			return key
		}

		const root = find(seen)

		parent.set(key, root)

		return root
	}

	function union(left: string, right: string) {
		parent.set(find(left), find(right))
	}

	return { find, union }
}

function seamChecks(draft: Draft): CheckResult[] {
	const results: CheckResult[] = []

	for (const seam of draft.seams) {
		const a = runLength(seam.a)
		const b = runLength(seam.b)
		const difference = Math.abs(a - b)

		if (difference <= EASE_LIMIT) continue

		results.push({
			id: `length-${seam.id}`,
			severity: difference > UNSEWABLE_LIMIT ? "error" : "warn",
			title: `${seam.name}の長さが合いません`,
			detail: `${panelName(draft, seam.a.edge.panelId)} ${round(a)}cm と ${panelName(draft, seam.b.edge.panelId)} ${round(b)}cm で、${round(difference)}cm ちがいます。`,
			target: { seamId: seam.id },
			fix: "assemble",
		})
	}

	return results
}

function overlapChecks(draft: Draft): CheckResult[] {
	const results: CheckResult[] = []

	const runs = draft.seams.flatMap((seam) => [
		{ seam, run: seam.a },
		{ seam, run: seam.b },
	])

	for (let left = 0; left < runs.length; left += 1) {
		for (let right = left + 1; right < runs.length; right += 1) {
			const first = runs[left]
			const second = runs[right]

			if (first === undefined || second === undefined) continue
			if (first.seam.id === second.seam.id) continue
			if (!sameEdge(first.run.edge, second.run.edge)) continue

			const shared =
				Math.min(first.run.to, second.run.to) - Math.max(first.run.from, second.run.from)

			if (shared <= 0.01) continue

			results.push({
				id: `overlap-${first.seam.id}-${second.seam.id}`,
				severity: "error",
				title: "同じところを2回縫っています",
				detail: `${panelName(draft, first.run.edge.panelId)}の同じ辺を、${first.seam.name}と${second.seam.name}が ${round(shared)}cm 重ねて縫っています。`,
				target: { seamId: first.seam.id },
				fix: "assemble",
			})
		}
	}

	return results
}

function detachedChecks(draft: Draft): CheckResult[] {
	if (draft.panels.length < 2) return []

	const attached = new Set(
		draft.seams.flatMap((seam) => [seam.a.edge.panelId, seam.b.edge.panelId]),
	)

	return draft.panels
		.filter((panel) => !attached.has(panel.id))
		.map((panel) => ({
			id: `detached-${panel.id}`,
			severity: "warn" as const,
			title: `${panel.name}がどこにも付いていません`,
			detail: "組み立てモードで、この部品の辺を相手の辺と縫い合わせてください。",
			target: { panelId: panel.id },
			fix: "assemble" as const,
		}))
}

/** Every run of cloth that no seam covers, placed on its panel's outline. */
function boundaryRuns(draft: Draft): BoundaryRun[] {
	const runs: BoundaryRun[] = []

	for (const panel of draft.panels) {
		const { offsets, total } = boundaryOffsets(draft, panel)

		if (total <= 0) continue

		for (const vertex of panel.vertices) {
			const edge: EdgeRef = { panelId: panel.id, vertexId: vertex.id }
			const start = offsets.get(vertex.id) ?? 0

			for (const span of edgeGaps(draft, edge)) {
				runs.push({
					edge,
					span,
					startKey: pointKey(panel.id, start + span.from, total),
					endKey: pointKey(panel.id, start + span.to, total),
					length: span.to - span.from,
				})
			}
		}
	}

	return runs
}

function pointKey(panelId: string, at: number, total: number): string {
	const wrapped = total <= 0 ? 0 : ((at % total) + total) % total

	return `${panelId}#${wrapped.toFixed(2)}`
}

/**
 * Ties the two panels a seam holds together, at the seam's ends.
 *
 * Which end meets which is the seam's own business: joining the far end of one
 * run to the near end of the other is how a piece is sewn on turned around, and
 * the openings either side of it come out different sizes.
 */
function joinSeamEnds(draft: Draft, groups: ReturnType<typeof makeGroups>) {
	const perimeters = new Map(
		draft.panels.map((panel) => {
			const measured = boundaryOffsets(draft, panel)

			return [panel.id, measured]
		}),
	)

	for (const seam of draft.seams) {
		const a = perimeters.get(seam.a.edge.panelId)
		const b = perimeters.get(seam.b.edge.panelId)

		if (a === undefined || b === undefined) continue

		const aStart = a.offsets.get(seam.a.edge.vertexId)
		const bStart = b.offsets.get(seam.b.edge.vertexId)

		if (aStart === undefined || bStart === undefined) continue

		const aNear = pointKey(seam.a.edge.panelId, aStart + seam.a.from, a.total)
		const aFar = pointKey(seam.a.edge.panelId, aStart + seam.a.to, a.total)
		const bNear = pointKey(seam.b.edge.panelId, bStart + seam.b.from, b.total)
		const bFar = pointKey(seam.b.edge.panelId, bStart + seam.b.to, b.total)

		groups.union(aNear, seam.reversed === true ? bFar : bNear)
		groups.union(aFar, seam.reversed === true ? bNear : bFar)
	}
}

function runName(draft: Draft, run: BoundaryRun): string {
	const named = draft.annotations.find(
		(annotation) =>
			sameEdge(annotation.run.edge, run.edge) &&
			annotation.run.from <= run.span.to &&
			annotation.run.to >= run.span.from,
	)

	return named?.name ?? ""
}

/**
 * Groups the unsewn runs into the holes they form.
 *
 * A finished garment is a surface with holes in it, and every hole is a ring of
 * unsewn cloth: the neck, the hem, each cuff. Measuring the ring is what answers
 * whether a head or a hand actually gets through.
 */
export function openingRings(draft: Draft): {
	name: string
	length: number
	runs: BoundaryRun[]
	closed: boolean
}[] {
	const groups = makeGroups()
	const runs = boundaryRuns(draft)

	joinSeamEnds(draft, groups)

	const byNode = new Map<string, BoundaryRun[]>()

	for (const run of runs) {
		for (const key of [run.startKey, run.endKey]) {
			const node = groups.find(key)
			const held = byNode.get(node) ?? []

			held.push(run)
			byNode.set(node, held)
		}
	}

	const visited = new Set<BoundaryRun>()
	const rings: { name: string; length: number; runs: BoundaryRun[]; closed: boolean }[] = []

	for (const run of runs) {
		if (visited.has(run)) continue

		const queue = [run]
		const found: BoundaryRun[] = []
		const nodes = new Set<string>()

		visited.add(run)

		while (queue.length > 0) {
			const current = queue.pop()

			if (current === undefined) continue

			found.push(current)

			for (const key of [current.startKey, current.endKey]) {
				const node = groups.find(key)

				nodes.add(node)

				for (const neighbour of byNode.get(node) ?? []) {
					if (visited.has(neighbour)) continue

					visited.add(neighbour)
					queue.push(neighbour)
				}
			}
		}

		const closed = [...nodes].every((node) => (byNode.get(node) ?? []).length === 2)
		const named = found.map((entry) => runName(draft, entry)).find((entry) => entry !== "")
		const panels = [...new Set(found.map((entry) => panelName(draft, entry.edge.panelId)))]

		rings.push({
			name: named ?? panels.join("・"),
			length: found.reduce((total, entry) => total + entry.length, 0),
			runs: found,
			closed,
		})
	}

	return rings.sort((left, right) => right.length - left.length)
}

function ringChecks(draft: Draft): CheckResult[] {
	return openingRings(draft).map((ring, index) => {
		const first = ring.runs[0]

		return {
			id: `ring-${index}`,
			severity: ring.closed ? ("info" as const) : ("warn" as const),
			title: ring.closed
				? `${ring.name} まわり ${round(ring.length)}cm`
				: `${ring.name} のふちが閉じていません`,
			detail: ring.closed
				? `${ring.runs.length}本のあき辺でできた穴です。`
				: "縫い合わせの端どうしが合っていないか、縫い合わせが足りません。",
			target:
				first === undefined
					? {}
					: { panelId: first.edge.panelId, edgeVertexId: first.edge.vertexId },
			fix: "draw" as const,
		}
	})
}

/**
 * What the cloth itself says, which the drawing alone cannot.
 *
 * A piece wider than the bolt is not a mistake you can see by looking at the
 * pieces, so it belongs here rather than only on the 裁ち方 screen.
 */
function clothChecks(draft: Draft): CheckResult[] {
	const layout = cuttingLayout(draft)

	const tooWide: CheckResult[] = layout.tooWide.map((piece) => ({
		id: `too-wide-${piece.panelId}`,
		severity: "error" as const,
		title: `${piece.name}が生地より広いです`,
		detail: `${piece.name}は ${piece.across}cm ありますが、生地の幅は ${layout.width}cm です。`,
		target: { panelId: piece.panelId },
		fix: "cutting" as const,
	}))

	if (layout.placements.length === 0) return tooWide

	return [
		...tooWide,
		{
			id: "cloth",
			severity: "info" as const,
			title: `生地 ${(layout.length / 100).toFixed(2)}m（幅 ${layout.width}cm）`,
			detail: `${layout.placements.length}枚を並べて ${layout.length}cm、うち ${Math.round(layout.efficiency * 100)}% が部品になります。`,
			target: {},
			fix: "cutting" as const,
		},
	]
}

const ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 }

/**
 * Everything worth telling the maker before they cut, in one list.
 *
 * The point of the tool is that the pieces line up, so the checks are always on
 * rather than a step someone remembers to run.
 */
export function checkDraft(draft: Draft): CheckResult[] {
	return [
		...seamChecks(draft),
		...overlapChecks(draft),
		...detachedChecks(draft),
		...clothChecks(draft),
		...ringChecks(draft),
	].sort((left, right) => ORDER[left.severity] - ORDER[right.severity])
}
