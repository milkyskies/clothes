import { runLength } from "./assemble"
import { boundaryOffsets, pointAlong, pointAtBoundary } from "./assembly"
import {
	type Crease,
	type Draft,
	type EdgeRun,
	findPanel,
	type Panel,
	panelPath,
	type Seam,
} from "./draft"
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
	/**
	 * Which side of the piece's fold this is, 0 before the fold and 1 after.
	 *
	 * A piece with a 折り山 lands in two places at once, so it is drawn twice, each
	 * time showing only the half on its own side of the fold.
	 */
	readonly part: number
	readonly matrix: Matrix
	/** Whether the piece ends up wrong side out, which is how a pair is made from one outline. */
	readonly flipped: boolean
	/** The fold this half is clipped against, absent when the piece has none. */
	readonly crease?: { readonly from: Point; readonly to: Point; readonly keep: number }
}

export interface Closure {
	readonly seamId: string
	readonly name: string
	readonly from: Point
	readonly to: Point
	readonly gap: number
}

export interface AssembleOptions {
	/**
	 * Ignore every fold and spread the whole garment into one plane.
	 *
	 * Useful for checking that the pieces meet, since nothing then hides behind
	 * anything else.
	 */
	readonly opened?: boolean
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

/** The point on the outline where a fold meets it, in draft coordinates. */
function creasePoint(draft: Draft, panelId: string, at: { vertexId: string; at: number }) {
	return pointAlong(draft, { panelId, vertexId: at.vertexId }, at.at)
}

/** Where a fold's ends sit measured around the outline, so an edge can be told which half it is on. */
function creaseSpan(draft: Draft, panel: Panel, crease: Crease): [number, number] | undefined {
	const { offsets } = boundaryOffsets(draft, panel)
	const start = offsets.get(crease.a.vertexId)
	const end = offsets.get(crease.b.vertexId)

	if (start === undefined || end === undefined) return undefined

	const first = start + crease.a.at
	const second = end + crease.b.at

	return first <= second ? [first, second] : [second, first]
}

/** Which half of a folded piece an edge run falls on, judged by its middle. */
function partOfRun(draft: Draft, panel: Panel, run: EdgeRun): number {
	const crease = panel.creases?.[0]

	if (crease === undefined) return 0

	const span = creaseSpan(draft, panel, crease)
	const { offsets } = boundaryOffsets(draft, panel)
	const start = offsets.get(run.edge.vertexId)

	if (span === undefined || start === undefined) return 0

	const middle = start + (run.from + run.to) / 2

	return middle >= span[0] && middle <= span[1] ? 0 : 1
}

/** Mirrors the plane about the line through two points, which is what folding flat does. */
function reflectAcross(from: Point, to: Point): Matrix {
	const spanX = to.x - from.x
	const spanY = to.y - from.y
	const length = Math.hypot(spanX, spanY)

	if (length === 0) return IDENTITY

	const dirX = spanX / length
	const dirY = spanY / length

	const a = dirX * dirX - dirY * dirY
	const b = 2 * dirX * dirY
	const moved = { x: a * from.x + b * from.y, y: b * from.x - a * from.y }

	return { a, b, c: b, d: -a, e: from.x - moved.x, f: from.y - moved.y }
}

function compose(outer: Matrix, inner: Matrix): Matrix {
	return {
		a: outer.a * inner.a + outer.c * inner.b,
		b: outer.b * inner.a + outer.d * inner.b,
		c: outer.a * inner.c + outer.c * inner.d,
		d: outer.b * inner.c + outer.d * inner.d,
		e: outer.a * inner.e + outer.c * inner.f + outer.e,
		f: outer.b * inner.e + outer.d * inner.f + outer.f,
	}
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
export function assemble(draft: Draft, options: AssembleOptions = {}): Assembly {
	const placements = new Map<string, Placement>()
	const folding = options.opened !== true

	/**
	 * Both halves of a piece, once its 折り山 is taken into account.
	 *
	 * The far half is the near half mirrored about the fold, which is what laying
	 * the cloth over on itself does. Without a fold there is only ever one half.
	 */
	function halvesOf(panel: Panel, base: Matrix, flipped: boolean): Placement[] {
		const crease = folding ? panel.creases?.[0] : undefined

		if (crease === undefined) return [{ panelId: panel.id, part: 0, matrix: base, flipped }]

		const from = creasePoint(draft, panel.id, crease.a)
		const to = creasePoint(draft, panel.id, crease.b)

		if (from === undefined || to === undefined) {
			return [{ panelId: panel.id, part: 0, matrix: base, flipped }]
		}

		const span = creaseSpan(draft, panel, crease)
		const inside =
			span === undefined ? undefined : pointAtBoundary(draft, panel, (span[0] + span[1]) / 2)

		if (inside === undefined) {
			return [{ panelId: panel.id, part: 0, matrix: base, flipped }]
		}

		// Both halves are clipped to the same side of the fold, because folding is
		// precisely the far half coming to rest on top of the near one.
		const line: [Point, Point] = [apply(base, from), apply(base, to)]
		const keep = sideOf(line, apply(base, inside)) >= 0 ? 1 : -1
		const shown = { from: line[0], to: line[1], keep }

		return [
			{ panelId: panel.id, part: 0, matrix: base, flipped, crease: shown },
			{
				panelId: panel.id,
				part: 1,
				matrix: compose(base, reflectAcross(from, to)),
				flipped: !flipped,
				crease: shown,
			},
		]
	}

	function place(panel: Panel, base: Matrix, flipped: boolean) {
		for (const half of halvesOf(panel, base, flipped)) {
			placements.set(`${half.panelId}#${half.part}`, half)
		}
	}

	function matrixFor(panelId: string, part: number): Placement | undefined {
		return placements.get(`${panelId}#${part}`) ?? placements.get(`${panelId}#0`)
	}

	/**
	 * Adds pieces one at a time, always by the longest seam available.
	 *
	 * A piece is swung into place by one of the seams holding it, and the longest
	 * is the steadiest: two points 3mm apart cannot say which way a 70cm strip of
	 * collar points. Taking the best seam anywhere on the frontier, rather than
	 * following one piece at a time, is what stops a collar being hung off the
	 * 衿ぐり notch just because the back happened to be reached first.
	 */
	function grow() {
		for (;;) {
			let best:
				| { seam: Seam; heldPanel: Panel; panel: Panel; heldRun: EdgeRun; movingRun: EdgeRun }
				| undefined
			let bestGrip = -1

			for (const seam of draft.seams) {
				const aPlaced = placements.has(`${seam.a.edge.panelId}#0`)
				const bPlaced = placements.has(`${seam.b.edge.panelId}#0`)

				if (aPlaced === bPlaced) continue

				const heldRun = aPlaced ? seam.a : seam.b
				const movingRun = aPlaced ? seam.b : seam.a
				const heldPanel = findPanel(draft, heldRun.edge.panelId)
				const panel = findPanel(draft, movingRun.edge.panelId)
				const grip = Math.max(runLength(seam.a), runLength(seam.b))

				if (heldPanel === undefined || panel === undefined || grip <= bestGrip) continue

				bestGrip = grip
				best = { seam, heldPanel, panel, heldRun, movingRun }
			}

			if (best === undefined) return

			const { seam, heldPanel, panel, heldRun, movingRun } = best
			const placed = matrixFor(heldPanel.id, partOfRun(draft, heldPanel, heldRun))
			const anchor = runEnds(draft, heldRun, false)
			const target = runEnds(draft, movingRun, seam.reversed === true)

			if (placed === undefined || anchor === undefined || target === undefined) {
				place(panel, IDENTITY, false)
				continue
			}

			const seamLine: [Point, Point] = [
				apply(placed.matrix, anchor[0]),
				apply(placed.matrix, anchor[1]),
			]

			const keepSide = sideOf(seamLine, apply(placed.matrix, centroid(heldPanel)))
			const straight = alignTo(target, seamLine, false)

			// A seam that lies open puts the next piece beside this one; a seam that
			// folds brings it back over the top, which is the same alignment taken to
			// the other side of the seam line.
			const folds = seam.lie === "fold" && folding
			const sameSide = sideOf(seamLine, apply(straight, centroid(panel))) * keepSide > 0
			const flip = folds ? !sameSide : sameSide
			const base = flip ? alignTo(target, seamLine, true) : straight

			// The moving piece was aligned by whichever of its halves this seam is on,
			// so when that is the far half the whole piece has to come back across its
			// own fold to sit right.
			const movingPart = partOfRun(draft, panel, movingRun)
			const crease = folding ? panel.creases?.[0] : undefined
			const creaseFrom = crease === undefined ? undefined : creasePoint(draft, panel.id, crease.a)
			const creaseTo = crease === undefined ? undefined : creasePoint(draft, panel.id, crease.b)

			const settled =
				movingPart === 1 && creaseFrom !== undefined && creaseTo !== undefined
					? compose(base, reflectAcross(creaseFrom, creaseTo))
					: base

			const facing = flip !== placed.flipped

			place(panel, settled, movingPart === 1 ? !facing : facing)
		}
	}

	// Anything the seams never reach still has to be drawn, so it stays where it
	// was drafted and is called out rather than dropped.
	const ordered = [...draft.panels].sort((left, right) => area(right) - area(left))
	const loose: string[] = []

	for (const panel of ordered) {
		if (placements.has(`${panel.id}#0`)) continue

		if (placements.size > 0) loose.push(panel.id)

		place(panel, IDENTITY, false)
		grow()
	}

	const closures: Closure[] = []

	for (const seam of draft.seams) {
		const heldPanel = findPanel(draft, seam.a.edge.panelId)
		const movingPanel = findPanel(draft, seam.b.edge.panelId)

		if (heldPanel === undefined || movingPanel === undefined) continue

		const held = matrixFor(heldPanel.id, partOfRun(draft, heldPanel, seam.a))
		const moving = matrixFor(movingPanel.id, partOfRun(draft, movingPanel, seam.b))

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
