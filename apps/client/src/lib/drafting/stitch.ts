import { edgeLength, pointAlong, sameEdge } from "./assembly"
import {
	type Draft,
	type EdgeRef,
	findPanel,
	panelPath,
	type Stitch,
	type StitchKind,
} from "./draft"
import { nextId } from "./edit"
import { flatten } from "./geometry/measure"
import type { Point } from "./geometry/path"

export const STITCH_KINDS: readonly { value: StitchKind; label: string }[] = [
	{ value: "finish", label: "しまつ" },
	{ value: "topstitch", label: "ステッチ" },
	{ value: "bartack", label: "かんぬき止め" },
	{ value: "hand", label: "手縫い" },
]

const DEFAULT_OFFSET = 0.7

export function addStitch(draft: Draft, edge: EdgeRef, kind: StitchKind): Draft {
	const label = STITCH_KINDS.find((entry) => entry.value === kind)?.label ?? "ステッチ"

	const stitch: Stitch = {
		id: nextId("stitch"),
		name: label,
		kind,
		run: { edge, from: 0, to: edgeLength(draft, edge) },
		offset: DEFAULT_OFFSET,
		rows: 1,
		thread: "",
	}

	return { ...draft, stitches: [...draft.stitches, stitch] }
}

export function removeStitch(draft: Draft, stitchId: string): Draft {
	return { ...draft, stitches: draft.stitches.filter((stitch) => stitch.id !== stitchId) }
}

export function updateStitch(draft: Draft, stitchId: string, patch: Partial<Stitch>): Draft {
	return {
		...draft,
		stitches: draft.stitches.map((stitch) =>
			stitch.id === stitchId ? { ...stitch, ...patch, id: stitch.id } : stitch,
		),
	}
}

export function stitchesOnEdge(draft: Draft, edge: EdgeRef): Stitch[] {
	return draft.stitches.filter((stitch) => sameEdge(stitch.run.edge, edge))
}

function centreOf(draft: Draft, panelId: string): Point | undefined {
	const panel = findPanel(draft, panelId)

	if (panel === undefined) return undefined

	const points = flatten(panelPath(panel)).map((entry) => entry.point)

	if (points.length === 0) return undefined

	return {
		x: panel.x + points.reduce((total, entry) => total + entry.x, 0) / points.length,
		y: panel.y + points.reduce((total, entry) => total + entry.y, 0) / points.length,
	}
}

/**
 * The line a stitch is actually sewn on, set in from the cut edge.
 *
 * Which way is "in" is decided per sample against the middle of the piece rather
 * than from the outline's winding, so a piece drawn either way round still gets
 * its stitching inside the cloth.
 */
export function stitchLine(draft: Draft, stitch: Stitch, row: number): Point[] {
	const centre = centreOf(draft, stitch.run.edge.panelId)
	const span = Math.abs(stitch.run.to - stitch.run.from)
	const steps = Math.max(2, Math.round(span / 1.5))
	const inset = stitch.offset + row * 0.35

	if (centre === undefined || span <= 0) return []

	const points: Point[] = []

	for (let step = 0; step <= steps; step += 1) {
		const at = stitch.run.from + (span * step) / steps
		const here = pointAlong(draft, stitch.run.edge, at)
		const ahead = pointAlong(draft, stitch.run.edge, Math.min(at + 0.5, stitch.run.to))
		const behind = pointAlong(draft, stitch.run.edge, Math.max(at - 0.5, stitch.run.from))

		if (here === undefined || ahead === undefined || behind === undefined) continue

		const tangentX = ahead.x - behind.x
		const tangentY = ahead.y - behind.y
		const length = Math.hypot(tangentX, tangentY)

		if (length === 0) continue

		const normalX = -tangentY / length
		const normalY = tangentX / length
		const inward = (centre.x - here.x) * normalX + (centre.y - here.y) * normalY >= 0 ? 1 : -1

		points.push({ x: here.x + normalX * inset * inward, y: here.y + normalY * inset * inward })
	}

	return points
}
