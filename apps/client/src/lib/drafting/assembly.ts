import {
	type Draft,
	type EdgeRef,
	type EdgeRun,
	findPanel,
	type Panel,
	panelPath,
	vertexIndex,
} from "./draft"
import { flatten, segmentLength } from "./geometry/measure"
import { type Point, segmentStart } from "./geometry/path"

export interface Span {
	readonly from: number
	readonly to: number
}

export function sameEdge(a: EdgeRef, b: EdgeRef): boolean {
	return a.panelId === b.panelId && a.vertexId === b.vertexId
}

/** The polyline of an internal line, in panel-local coordinates. */
function guidePoints(panel: Panel, guideId: string): Point[] | undefined {
	const guide = panel.guides?.find((entry) => entry.id === guideId)

	if (guide === undefined || guide.points.length < 2) return undefined

	return guide.points.map((point) => ({ x: point.x, y: point.y }))
}

export function edgeLength(draft: Draft, edge: EdgeRef): number {
	const panel = findPanel(draft, edge.panelId)

	if (panel === undefined) return 0

	const index = vertexIndex(panel, edge.vertexId)

	if (index < 0) {
		const points = guidePoints(panel, edge.vertexId)

		if (points === undefined) return 0

		let total = 0

		for (let step = 1; step < points.length; step += 1) {
			const previous = points[step - 1]
			const current = points[step]

			if (previous === undefined || current === undefined) continue

			total += Math.hypot(current.x - previous.x, current.y - previous.y)
		}

		return total
	}

	const path = panelPath(panel)
	const segment = path.segments[index]

	if (segment === undefined) return 0

	return segmentLength(segmentStart(path, index), segment)
}

/**
 * Walks an edge to the point a given number of centimetres along it, in draft
 * coordinates. The id may name a boundary edge or an internal line; a seam
 * cannot tell the difference, which is what lets cloth be sewn onto a face.
 */
export function pointAlong(draft: Draft, edge: EdgeRef, distance: number): Point | undefined {
	const panel = findPanel(draft, edge.panelId)

	if (panel === undefined) return undefined

	const index = vertexIndex(panel, edge.vertexId)
	const guided = index < 0 ? guidePoints(panel, edge.vertexId) : undefined
	const path = panelPath(panel)
	const segment = path.segments[index]

	if (segment === undefined && guided === undefined) return undefined

	const start = segment === undefined ? { x: 0, y: 0 } : segmentStart(path, index)
	const samples =
		guided ??
		(segment === undefined
			? []
			: [...flatten({ start, segments: [segment] }).map((entry) => entry.point), segment.to])

	let travelled = 0

	for (let step = 1; step < samples.length; step += 1) {
		const previous = samples[step - 1]
		const current = samples[step]

		if (previous === undefined || current === undefined) continue

		const length = Math.hypot(current.x - previous.x, current.y - previous.y)

		if (travelled + length >= distance) {
			const along = length === 0 ? 0 : (distance - travelled) / length

			return {
				x: panel.x + previous.x + (current.x - previous.x) * along,
				y: panel.y + previous.y + (current.y - previous.y) * along,
			}
		}

		travelled += length
	}

	const last = samples[samples.length - 1]

	return last === undefined ? undefined : { x: panel.x + last.x, y: panel.y + last.y }
}

/**
 * Where each edge starts, measured around the outline from the first vertex.
 *
 * Positions on this one scale are what let a run on one edge and a run on the
 * next be recognised as meeting at the corner between them.
 */
export function boundaryOffsets(
	draft: Draft,
	panel: Panel,
): { offsets: Map<string, number>; total: number } {
	const offsets = new Map<string, number>()

	let cursor = 0

	for (const vertex of panel.vertices) {
		offsets.set(vertex.id, cursor)
		cursor += edgeLength(draft, { panelId: panel.id, vertexId: vertex.id })
	}

	return { offsets, total: cursor }
}

/** The point a given distance around the outline, measured from the first vertex. */
export function pointAtBoundary(draft: Draft, panel: Panel, at: number): Point | undefined {
	const { offsets, total } = boundaryOffsets(draft, panel)

	if (total <= 0) return undefined

	const wrapped = ((at % total) + total) % total

	for (const vertex of panel.vertices) {
		const start = offsets.get(vertex.id)

		if (start === undefined) continue

		const edge = { panelId: panel.id, vertexId: vertex.id }
		const length = edgeLength(draft, edge)

		if (wrapped <= start + length) return pointAlong(draft, edge, wrapped - start)
	}

	return undefined
}

function merge(spans: readonly Span[]): Span[] {
	const sorted = [...spans]
		.map((span) => ({ from: Math.min(span.from, span.to), to: Math.max(span.from, span.to) }))
		.sort((left, right) => left.from - right.from)

	const merged: Span[] = []

	for (const span of sorted) {
		const last = merged[merged.length - 1]

		if (last === undefined || span.from > last.to) {
			merged.push(span)
			continue
		}

		merged[merged.length - 1] = { from: last.from, to: Math.max(last.to, span.to) }
	}

	return merged
}

export function seamRunsOn(draft: Draft, edge: EdgeRef): EdgeRun[] {
	const runs: EdgeRun[] = []

	for (const seam of draft.seams) {
		if (sameEdge(seam.a.edge, edge)) runs.push(seam.a)
		if (sameEdge(seam.b.edge, edge)) runs.push(seam.b)
	}

	return runs
}

/**
 * The parts of an edge no seam covers.
 *
 * This is the only source of openings in the model: 脇あき, 袖付けあき and
 * 身八つ口 are all just a seam that stops before the end of its edge.
 */
export function edgeGaps(draft: Draft, edge: EdgeRef): Span[] {
	const total = edgeLength(draft, edge)

	if (total <= 0) return []

	const sewn = merge(seamRunsOn(draft, edge).map((run) => ({ from: run.from, to: run.to })))
	const gaps: Span[] = []

	let cursor = 0

	for (const span of sewn) {
		if (span.from > cursor) gaps.push({ from: cursor, to: Math.min(span.from, total) })

		cursor = Math.max(cursor, span.to)
	}

	if (cursor < total) gaps.push({ from: cursor, to: total })

	return gaps.filter((gap) => gap.to - gap.from > 0.01)
}

/** Every unsewn run in the draft, with whatever name a template gave it. */
export function openings(draft: Draft): { edge: EdgeRef; span: Span; name: string }[] {
	const found: { edge: EdgeRef; span: Span; name: string }[] = []

	for (const panel of draft.panels) {
		for (const vertex of panel.vertices) {
			const edge: EdgeRef = { panelId: panel.id, vertexId: vertex.id }

			for (const span of edgeGaps(draft, edge)) {
				const named = draft.annotations.find(
					(annotation) =>
						sameEdge(annotation.run.edge, edge) &&
						annotation.run.from <= span.to &&
						annotation.run.to >= span.from,
				)

				found.push({ edge, span, name: named?.name ?? "" })
			}
		}
	}

	return found
}
