import {
	type Document,
	type EdgeRef,
	type EdgeRun,
	findPanel,
	panelPath,
	vertexIndex,
} from "./document"
import { segmentLength } from "./geometry/measure"
import { segmentStart } from "./geometry/path"

export interface Span {
	readonly from: number
	readonly to: number
}

export function sameEdge(a: EdgeRef, b: EdgeRef): boolean {
	return a.panelId === b.panelId && a.vertexId === b.vertexId
}

export function edgeLength(document: Document, edge: EdgeRef): number {
	const panel = findPanel(document, edge.panelId)

	if (panel === undefined) return 0

	const index = vertexIndex(panel, edge.vertexId)

	if (index < 0) return 0

	const path = panelPath(panel)
	const segment = path.segments[index]

	if (segment === undefined) return 0

	return segmentLength(segmentStart(path, index), segment)
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

export function seamRunsOn(document: Document, edge: EdgeRef): EdgeRun[] {
	const runs: EdgeRun[] = []

	for (const seam of document.seams) {
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
export function edgeGaps(document: Document, edge: EdgeRef): Span[] {
	const total = edgeLength(document, edge)

	if (total <= 0) return []

	const sewn = merge(seamRunsOn(document, edge).map((run) => ({ from: run.from, to: run.to })))
	const gaps: Span[] = []

	let cursor = 0

	for (const span of sewn) {
		if (span.from > cursor) gaps.push({ from: cursor, to: Math.min(span.from, total) })

		cursor = Math.max(cursor, span.to)
	}

	if (cursor < total) gaps.push({ from: cursor, to: total })

	return gaps.filter((gap) => gap.to - gap.from > 0.01)
}

export function annotationsFor(document: Document, edge: EdgeRef): string[] {
	return document.annotations
		.filter((annotation) => sameEdge(annotation.run.edge, edge))
		.map((annotation) => annotation.name)
}

/** Every unsewn run in the document, with whatever name a template gave it. */
export function openings(document: Document): { edge: EdgeRef; span: Span; name: string }[] {
	const found: { edge: EdgeRef; span: Span; name: string }[] = []

	for (const panel of document.panels) {
		for (const vertex of panel.vertices) {
			const edge: EdgeRef = { panelId: panel.id, vertexId: vertex.id }

			for (const span of edgeGaps(document, edge)) {
				const named = document.annotations.find(
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
