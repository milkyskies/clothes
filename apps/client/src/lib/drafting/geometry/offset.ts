import { flatten, type Vertex } from "./measure"
import { add, normalize, type Path, type Point, scale, signedArea, subtract } from "./path"

const PARALLEL_EPSILON = 1e-9

export interface SeamAllowance {
	readonly perEdge: Readonly<Record<string, number>>
	readonly fallback: number
}

interface OffsetEdge {
	readonly origin: Point
	readonly direction: Point
	readonly segmentId: string
}

function allowanceFor(allowance: SeamAllowance, segmentId: string): number {
	const specific = allowance.perEdge[segmentId]

	return specific ?? allowance.fallback
}

function intersect(first: OffsetEdge, second: OffsetEdge): Point | undefined {
	const cross = first.direction.x * second.direction.y - first.direction.y * second.direction.x

	if (Math.abs(cross) < PARALLEL_EPSILON) return undefined

	const between = subtract(second.origin, first.origin)
	const travel = (between.x * second.direction.y - between.y * second.direction.x) / cross

	return add(first.origin, scale(first.direction, travel))
}

function buildOffsetEdges(
	vertices: readonly Vertex[],
	allowance: SeamAllowance,
	outwardSign: number,
): OffsetEdge[] {
	const edges: OffsetEdge[] = []

	for (let index = 0; index < vertices.length; index += 1) {
		const current = vertices[index]
		const next = vertices[(index + 1) % vertices.length]

		if (current === undefined || next === undefined) continue

		const span = subtract(next.point, current.point)

		if (Math.hypot(span.x, span.y) < PARALLEL_EPSILON) continue

		const direction = normalize(span)
		const outward = scale({ x: direction.y, y: -direction.x }, outwardSign)
		const width = allowanceFor(allowance, current.segmentId)

		edges.push({
			origin: add(current.point, scale(outward, width)),
			direction,
			segmentId: current.segmentId,
		})
	}

	return edges
}

/**
 * Offsets a closed path outward by a per-edge seam allowance, returning the cut
 * line as a vertex ring.
 *
 * Joins are mitred by intersecting adjacent offset lines. This is exact for the
 * shallow curvature and 1.5–3 cm allowances 和服 drafting uses; it does not
 * remove self-intersections, which only appear when the offset exceeds the local
 * radius of curvature.
 */
export function offsetPath(path: Path, allowance: SeamAllowance): Vertex[] {
	const vertices = flatten(path)

	if (vertices.length < 3) return []

	const outwardSign = signedArea(vertices.map((vertex) => vertex.point)) > 0 ? 1 : -1
	const edges = buildOffsetEdges(vertices, allowance, outwardSign)

	if (edges.length < 2) return []

	const offsetVertices: Vertex[] = []

	for (let index = 0; index < edges.length; index += 1) {
		const previous = edges[(index - 1 + edges.length) % edges.length]
		const current = edges[index]

		if (previous === undefined || current === undefined) continue

		const corner = intersect(previous, current)

		offsetVertices.push({
			point: corner ?? current.origin,
			segmentId: current.segmentId,
		})
	}

	return offsetVertices
}

export function boundingBox(vertices: readonly Vertex[]): {
	readonly minX: number
	readonly minY: number
	readonly maxX: number
	readonly maxY: number
	readonly width: number
	readonly height: number
} {
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY

	for (const vertex of vertices) {
		minX = Math.min(minX, vertex.point.x)
		minY = Math.min(minY, vertex.point.y)
		maxX = Math.max(maxX, vertex.point.x)
		maxY = Math.max(maxY, vertex.point.y)
	}

	return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
