import { edgeLength, sameEdge } from "./assembly"
import type { Draft, EdgeRef, EdgeRun, Seam } from "./draft"
import { nextId } from "./edit"

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
