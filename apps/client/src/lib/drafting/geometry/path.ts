export interface Point {
	readonly x: number
	readonly y: number
}

export interface LineSegment {
	readonly kind: "line"
	readonly id: string
	readonly to: Point
}

export interface CurveSegment {
	readonly kind: "curve"
	readonly id: string
	readonly to: Point
	readonly c1: Point
	readonly c2: Point
}

export type Segment = LineSegment | CurveSegment

export interface Path {
	readonly start: Point
	readonly segments: readonly Segment[]
}

export function point(x: number, y: number): Point {
	return { x, y }
}

export function line(id: string, to: Point): LineSegment {
	return { kind: "line", id, to }
}

export function curve(id: string, to: Point, c1: Point, c2: Point): CurveSegment {
	return { kind: "curve", id, to, c1, c2 }
}

export function subtract(a: Point, b: Point): Point {
	return { x: a.x - b.x, y: a.y - b.y }
}

export function add(a: Point, b: Point): Point {
	return { x: a.x + b.x, y: a.y + b.y }
}

export function scale(p: Point, factor: number): Point {
	return { x: p.x * factor, y: p.y * factor }
}

export function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y)
}

export function normalize(p: Point): Point {
	const magnitude = Math.hypot(p.x, p.y)

	if (magnitude === 0) return { x: 0, y: 0 }

	return { x: p.x / magnitude, y: p.y / magnitude }
}

export function segmentStart(path: Path, index: number): Point {
	if (index === 0) return path.start

	const previous = path.segments[index - 1]

	if (previous === undefined) return path.start

	return previous.to
}

export function endPoint(path: Path): Point {
	const last = path.segments[path.segments.length - 1]

	if (last === undefined) return path.start

	return last.to
}

/**
 * Signed area is positive when the path winds counter-clockwise in a y-up
 * coordinate system. Offsetting relies on this to know which side is outward.
 */
export function signedArea(vertices: readonly Point[]): number {
	let total = 0

	for (let index = 0; index < vertices.length; index += 1) {
		const current = vertices[index]
		const next = vertices[(index + 1) % vertices.length]

		if (current === undefined || next === undefined) continue

		total += current.x * next.y - next.x * current.y
	}

	return total / 2
}

/**
 * Cubic control-point offset that approximates a circular arc of the given
 * sweep. The 4/3·tan(θ/4) factor is the standard minimal-error approximation.
 */
function arcHandleLength(radius: number, sweep: number): number {
	return (4 / 3) * Math.tan(sweep / 4) * radius
}

export interface Fillet {
	readonly from: Point
	readonly segment: CurveSegment
}

/**
 * Rounds the junction at `corner` between the edges arriving from `previous`
 * and leaving toward `next`, returning where the straight run must stop and the
 * curve that replaces the corner.
 *
 * A flat collar band cannot turn a sharp corner without bunching, so the 剣先
 * is built this way rather than as a mitred point.
 */
export function fillet(
	id: string,
	previous: Point,
	corner: Point,
	next: Point,
	radius: number,
): Fillet {
	const incoming = normalize(subtract(corner, previous))
	const outgoing = normalize(subtract(next, corner))

	const alignment = incoming.x * outgoing.x + incoming.y * outgoing.y
	const sweep = Math.acos(Math.max(-1, Math.min(1, alignment)))
	const setback = radius * Math.tan(sweep / 2)

	const from = add(corner, scale(incoming, -setback))
	const to = add(corner, scale(outgoing, setback))
	const handle = arcHandleLength(radius, sweep)

	return {
		from,
		segment: curve(id, to, add(from, scale(incoming, handle)), add(to, scale(outgoing, -handle))),
	}
}
