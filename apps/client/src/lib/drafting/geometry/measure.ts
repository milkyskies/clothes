import { Bezier } from "bezier-js"
import {
	type CurveSegment,
	distance,
	type Path,
	type Point,
	type Segment,
	segmentStart,
} from "./path"

const FLATTEN_TOLERANCE_CM = 0.03

function toBezier(from: Point, segment: CurveSegment): Bezier {
	return new Bezier(
		from.x,
		from.y,
		segment.c1.x,
		segment.c1.y,
		segment.c2.x,
		segment.c2.y,
		segment.to.x,
		segment.to.y,
	)
}

export function segmentLength(from: Point, segment: Segment): number {
	if (segment.kind === "line") return distance(from, segment.to)

	return toBezier(from, segment).length()
}

export function pathLength(path: Path): number {
	let total = 0

	for (const [index, segment] of path.segments.entries()) {
		total += segmentLength(segmentStart(path, index), segment)
	}

	return total
}

/**
 * Summed length of the named edges, in the order they appear on the path.
 *
 * The 掛襟 is a straight strip whose cut length is the arc length of the front
 * edge it is sewn to, so it is derived through here rather than measured.
 */
export function edgesLength(path: Path, ids: readonly string[]): number {
	const wanted = new Set(ids)
	let total = 0

	for (const [index, segment] of path.segments.entries()) {
		if (!wanted.has(segment.id)) continue

		total += segmentLength(segmentStart(path, index), segment)
	}

	return total
}

export interface Vertex {
	readonly point: Point
	readonly segmentId: string
}

function curveSteps(from: Point, segment: CurveSegment): number {
	const length = toBezier(from, segment).length()

	return Math.max(2, Math.ceil(length / FLATTEN_TOLERANCE_CM))
}

/**
 * Flattens the path to a vertex ring. Each vertex remembers which edge produced
 * it, because seam allowance varies per edge and the offset step needs to know.
 */
export function flatten(path: Path): Vertex[] {
	const vertices: Vertex[] = []

	for (const [index, segment] of path.segments.entries()) {
		const from = segmentStart(path, index)

		if (segment.kind === "line") {
			vertices.push({ point: from, segmentId: segment.id })
			continue
		}

		const bezier = toBezier(from, segment)
		const steps = curveSteps(from, segment)

		for (const sample of bezier.getLUT(steps).slice(0, -1)) {
			vertices.push({ point: { x: sample.x, y: sample.y }, segmentId: segment.id })
		}
	}

	return vertices
}
