import { pointAlong } from "./assembly"
import { type Draft, type EdgeRun, findPanel, type Panel, panelPath, type Seam } from "./draft"
import { flatten } from "./geometry/measure"
import type { Point } from "./geometry/path"

/**
 * An affine placement in SVG's own order, so it can be handed straight to a
 * transform attribute: x' = a·x + c·y + e, y' = b·x + d·y + f.
 */
export interface Matrix {
	readonly a: number
	readonly b: number
	readonly c: number
	readonly d: number
	readonly e: number
	readonly f: number
}

export interface Placement {
	readonly panelId: string
	readonly matrix: Matrix
	/** Whether the piece ends up wrong side out, which is how a pair is made from one outline. */
	readonly flipped: boolean
}

export interface Closure {
	readonly seamId: string
	readonly name: string
	readonly from: Point
	readonly to: Point
	readonly gap: number
}

export interface Assembly {
	readonly placements: readonly Placement[]
	/**
	 * Seams the flat arrangement could not also satisfy.
	 *
	 * A garment is not flat, so laying it out in the plane always leaves some
	 * seams standing apart: those are the ones that close up into a tube when the
	 * cloth leaves the table. They are shown rather than treated as faults.
	 */
	readonly closures: readonly Closure[]
	readonly loose: readonly string[]
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function apply(matrix: Matrix, point: Point): Point {
	return {
		x: matrix.a * point.x + matrix.c * point.y + matrix.e,
		y: matrix.b * point.x + matrix.d * point.y + matrix.f,
	}
}

function centroid(panel: Panel): Point {
	const points = flatten(panelPath(panel)).map((entry) => entry.point)

	if (points.length === 0) return { x: panel.x, y: panel.y }

	return {
		x: panel.x + points.reduce((total, entry) => total + entry.x, 0) / points.length,
		y: panel.y + points.reduce((total, entry) => total + entry.y, 0) / points.length,
	}
}

/** The two points a seam's run starts and ends at, in the order the seam joins them. */
function runEnds(draft: Draft, run: EdgeRun, reversed: boolean): [Point, Point] | undefined {
	const near = pointAlong(draft, run.edge, reversed ? run.to : run.from)
	const far = pointAlong(draft, run.edge, reversed ? run.from : run.to)

	if (near === undefined || far === undefined) return undefined

	return [near, far]
}

/** Builds the rigid placement that carries one pair of points onto another. */
function alignTo(from: [Point, Point], to: [Point, Point], flip: boolean): Matrix {
	const source = Math.atan2(from[1].y - from[0].y, from[1].x - from[0].x)
	const target = Math.atan2(to[1].y - to[0].y, to[1].x - to[0].x)
	const turn = flip ? target + source : target - source

	const cos = Math.cos(turn)
	const sin = Math.sin(turn)

	const linear: Matrix = flip
		? { a: cos, b: sin, c: sin, d: -cos, e: 0, f: 0 }
		: { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }

	const moved = apply(linear, from[0])

	return { ...linear, e: to[0].x - moved.x, f: to[0].y - moved.y }
}

function sideOf(line: [Point, Point], point: Point): number {
	return (
		(line[1].x - line[0].x) * (point.y - line[0].y) -
		(line[1].y - line[0].y) * (point.x - line[0].x)
	)
}

function otherPanel(seam: Seam, panelId: string): string | undefined {
	if (seam.a.edge.panelId === panelId && seam.b.edge.panelId !== panelId) {
		return seam.b.edge.panelId
	}

	if (seam.b.edge.panelId === panelId && seam.a.edge.panelId !== panelId) {
		return seam.a.edge.panelId
	}

	return undefined
}

function area(panel: Panel): number {
	const points = flatten(panelPath(panel)).map((entry) => entry.point)
	const xs = points.map((entry) => entry.x)
	const ys = points.map((entry) => entry.y)

	if (points.length === 0) return 0

	return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
}

/**
 * Opens the garment out flat by following its seams.
 *
 * Each seam that joins a piece not yet placed swings that piece round until the
 * two sewn runs sit on top of each other, and onto the far side of the seam so
 * the pieces lie beside one another rather than on top. For garments cut from
 * flat pieces this is not an approximation: it is the shape the cloth actually
 * takes when it is spread on a table.
 */
export function assemble(draft: Draft): Assembly {
	const placements = new Map<string, Placement>()

	function walk(from: string) {
		const queue = [from]
		const done = new Set<string>()

		while (queue.length > 0) {
			const current = queue.shift()

			if (current === undefined || done.has(current)) continue

			done.add(current)

			for (const seam of draft.seams) {
				const neighbour = otherPanel(seam, current)

				if (neighbour === undefined || placements.has(neighbour)) continue

				const placed = placements.get(current)
				const heldPanel = findPanel(draft, current)
				const panel = findPanel(draft, neighbour)

				if (placed === undefined || heldPanel === undefined || panel === undefined) continue

				const onCurrent = seam.a.edge.panelId === current
				const anchor = runEnds(draft, onCurrent ? seam.a : seam.b, false)
				const target = runEnds(draft, onCurrent ? seam.b : seam.a, seam.reversed === true)

				if (anchor === undefined || target === undefined) continue

				const seamLine: [Point, Point] = [
					apply(placed.matrix, anchor[0]),
					apply(placed.matrix, anchor[1]),
				]

				const keepSide = sideOf(seamLine, apply(placed.matrix, centroid(heldPanel)))
				const straight = alignTo(target, seamLine, false)
				const flip = sideOf(seamLine, apply(straight, centroid(panel))) * keepSide > 0

				placements.set(neighbour, {
					panelId: neighbour,
					matrix: flip ? alignTo(target, seamLine, true) : straight,
					flipped: flip !== placed.flipped,
				})

				queue.push(neighbour)
			}
		}
	}

	// Anything the seams never reach still has to be drawn, so it stays where it
	// was drafted and is called out rather than dropped.
	const ordered = [...draft.panels].sort((left, right) => area(right) - area(left))
	const loose: string[] = []

	for (const panel of ordered) {
		if (placements.has(panel.id)) continue

		if (placements.size > 0) loose.push(panel.id)

		placements.set(panel.id, { panelId: panel.id, matrix: IDENTITY, flipped: false })
		walk(panel.id)
	}

	const closures: Closure[] = []

	for (const seam of draft.seams) {
		const held = placements.get(seam.a.edge.panelId)
		const moving = placements.get(seam.b.edge.panelId)

		if (held === undefined || moving === undefined) continue

		const anchor = runEnds(draft, seam.a, false)
		const target = runEnds(draft, seam.b, seam.reversed === true)

		if (anchor === undefined || target === undefined) continue

		const from = apply(held.matrix, anchor[0])
		const to = apply(moving.matrix, target[0])
		const gap = Math.hypot(to.x - from.x, to.y - from.y)

		if (gap <= 0.05) continue

		closures.push({ seamId: seam.id, name: seam.name, from, to, gap: Number(gap.toFixed(1)) })
	}

	return { placements: [...placements.values()], closures, loose }
}

/** Folds the panel's own offset into its placement, so a local outline can be drawn directly. */
export function placementMatrix(placement: Placement, panel: Panel): Matrix {
	const moved = apply(placement.matrix, { x: panel.x, y: panel.y })

	return { ...placement.matrix, e: moved.x, f: moved.y }
}
