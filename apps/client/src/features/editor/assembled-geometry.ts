import { edgeGaps, pointAlong, seamRunsOn } from "@/lib/drafting/assembly"
import { type Draft, type EdgeRef, findPanel, panelBounds } from "@/lib/drafting/draft"
import type { Point } from "@/lib/drafting/geometry/path"
import type { Assembly, Matrix, Placement } from "@/lib/drafting/layout"

const PARK_GAP = 12

export function applyMatrix(matrix: Matrix, point: Point): Point {
	return {
		x: matrix.a * point.x + matrix.c * point.y + matrix.e,
		y: matrix.b * point.x + matrix.d * point.y + matrix.f,
	}
}

/** Samples a stretch of an edge and puts it where the assembly does. */
export function runPolyline(
	draft: Draft,
	matrix: Matrix,
	edge: EdgeRef,
	from: number,
	to: number,
): Point[] {
	const span = Math.abs(to - from)
	const steps = Math.max(2, Math.round(span / 1.5))

	return Array.from({ length: steps + 1 }, (_, step) =>
		pointAlong(draft, edge, from + ((to - from) * step) / steps),
	)
		.filter((entry): entry is Point => entry !== undefined)
		.map((entry) => applyMatrix(matrix, entry))
}

export function midOf(points: readonly Point[]): Point | undefined {
	return points[Math.floor(points.length / 2)]
}

/** What has happened to an edge: the stretches that are sewn, and the ones still open. */
export function edgeState(draft: Draft, edge: EdgeRef) {
	return {
		sewn: seamRunsOn(draft, edge).map((run) => ({ from: run.from, to: run.to })),
		gaps: edgeGaps(draft, edge),
	}
}

/**
 * Somewhere tidy to put the pieces no seam has reached.
 *
 * They would otherwise sit wherever they were drafted, which is exactly the
 * scatter that assembling is meant to get away from, so they are lined up
 * underneath the garment instead — a shelf of parts waiting to go on.
 */
export function parkLoose(draft: Draft, assembly: Assembly): Map<string, Matrix> {
	const loose = new Set(assembly.loose)
	const attached = assembly.placements.filter((entry) => !loose.has(entry.panelId))

	const corners = attached.flatMap((placement) => {
		const panel = findPanel(draft, placement.panelId)

		if (panel === undefined) return []

		const bounds = panelBounds(panel)

		return [
			applyMatrix(placement.matrix, { x: panel.x + bounds.minX, y: panel.y + bounds.minY }),
			applyMatrix(placement.matrix, { x: panel.x + bounds.maxX, y: panel.y + bounds.maxY }),
		]
	})

	const left = corners.length === 0 ? 0 : Math.min(...corners.map((entry) => entry.x))
	const bottom = corners.length === 0 ? 0 : Math.max(...corners.map((entry) => entry.y))

	const parked = new Map<string, Matrix>()

	let cursor = left

	for (const panelId of assembly.loose) {
		const panel = findPanel(draft, panelId)

		if (panel === undefined) continue

		const bounds = panelBounds(panel)

		parked.set(panelId, {
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: cursor - panel.x - bounds.minX,
			f: bottom + PARK_GAP - panel.y - bounds.minY,
		})

		cursor += bounds.width + PARK_GAP
	}

	return parked
}

/** The assembly with loose pieces moved onto the shelf underneath it. */
export function tidied(draft: Draft, assembly: Assembly): Placement[] {
	const parked = parkLoose(draft, assembly)

	return assembly.placements.map((placement) => {
		const moved = parked.get(placement.panelId)

		return moved === undefined ? placement : { ...placement, matrix: moved }
	})
}
