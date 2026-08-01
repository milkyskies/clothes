import { edgeLength, pointAlong, sameEdge } from "./assembly"
import type { Draft, EdgeRef, EdgeRun, Seam } from "./draft"
import { nextId } from "./edit"

function gap(draft: Draft, a: EdgeRef, aAt: number, b: EdgeRef, bAt: number): number {
	const from = pointAlong(draft, a, aAt)
	const to = pointAlong(draft, b, bAt)

	if (from === undefined || to === undefined) return 0

	return Math.hypot(to.x - from.x, to.y - from.y)
}

/**
 * Guesses which end of one edge meets which end of the other from where the
 * pieces currently lie, because someone laying out a draft puts the parts that
 * belong together next to each other.
 */
function looksReversed(draft: Draft, a: EdgeRef, b: EdgeRef): boolean {
	const aEnd = edgeLength(draft, a)
	const bEnd = edgeLength(draft, b)

	const straight = gap(draft, a, 0, b, 0) + gap(draft, a, aEnd, b, bEnd)
	const turned = gap(draft, a, 0, b, bEnd) + gap(draft, a, aEnd, b, 0)

	return turned < straight
}

/**
 * Joining two edges sews them from end to end by default. Shortening either run
 * is what leaves an opening, so a new seam starts closed and is opened
 * deliberately.
 */
export function addSeam(document: Draft, a: EdgeRef, b: EdgeRef): Draft {
	if (sameEdge(a, b)) return document

	const seam: Seam = {
		id: nextId("seam"),
		name: "縫い",
		a: { edge: a, from: 0, to: edgeLength(document, a) },
		b: { edge: b, from: 0, to: edgeLength(document, b) },
		reversed: looksReversed(document, a, b),
	}

	return { ...document, seams: [...document.seams, seam] }
}

export function removeSeam(document: Draft, seamId: string): Draft {
	return { ...document, seams: document.seams.filter((seam) => seam.id !== seamId) }
}

export function renameSeam(document: Draft, seamId: string, name: string): Draft {
	return {
		...document,
		seams: document.seams.map((seam) => (seam.id === seamId ? { ...seam, name } : seam)),
	}
}

/**
 * Turns the second piece around so the far end of one run meets the near end of
 * the other. Two edges of the same length still join two ways, and picking the
 * wrong one is how a sleeve ends up sewn on inside out.
 */
export function flipSeam(document: Draft, seamId: string): Draft {
	return {
		...document,
		seams: document.seams.map((seam) =>
			seam.id === seamId ? { ...seam, reversed: seam.reversed !== true } : seam,
		),
	}
}

function clampRun(document: Draft, run: EdgeRun, from: number, to: number): EdgeRun {
	const total = edgeLength(document, run.edge)
	const low = Math.max(0, Math.min(from, to))
	const high = Math.min(total, Math.max(from, to))

	return { ...run, from: Number(low.toFixed(2)), to: Number(high.toFixed(2)) }
}

export function setSeamRun(
	document: Draft,
	seamId: string,
	side: "a" | "b",
	from: number,
	to: number,
): Draft {
	return {
		...document,
		seams: document.seams.map((seam) =>
			seam.id === seamId ? { ...seam, [side]: clampRun(document, seam[side], from, to) } : seam,
		),
	}
}

export function findSeam(document: Draft, seamId: string): Seam | undefined {
	return document.seams.find((seam) => seam.id === seamId)
}

export function seamsOnEdge(document: Draft, edge: EdgeRef): Seam[] {
	return document.seams.filter((seam) => sameEdge(seam.a.edge, edge) || sameEdge(seam.b.edge, edge))
}

export function runLength(run: EdgeRun): number {
	return Math.abs(run.to - run.from)
}

/**
 * How far apart the two sides of a seam are in length.
 *
 * Cloth can be eased over a small difference but not a large one, so a seam
 * whose halves disagree is a drafting error worth surfacing rather than a
 * choice.
 */
export function seamMismatch(seam: Seam): number {
	return Number(Math.abs(runLength(seam.a) - runLength(seam.b)).toFixed(2))
}
