import { runLength, seamMismatch } from "@/lib/drafting/assemble"
import { pointAlong } from "@/lib/drafting/assembly"
import type { Draft, EdgeRun, Seam } from "@/lib/drafting/draft"
import type { Point } from "@/lib/drafting/geometry/path"

function runPoints(draft: Draft, run: EdgeRun): Point[] {
	const steps = Math.max(1, Math.round(runLength(run) / 2))

	return Array.from({ length: steps + 1 }, (_, step) =>
		pointAlong(draft, run.edge, run.from + ((run.to - run.from) * step) / steps),
	).filter((entry): entry is Point => entry !== undefined)
}

/** The pairs of points a seam actually brings together, near end first. */
function ties(draft: Draft, seam: Seam): [Point, Point][] {
	const aNear = pointAlong(draft, seam.a.edge, seam.a.from)
	const aFar = pointAlong(draft, seam.a.edge, seam.a.to)
	const bNear = pointAlong(draft, seam.b.edge, seam.reversed === true ? seam.b.to : seam.b.from)
	const bFar = pointAlong(draft, seam.b.edge, seam.reversed === true ? seam.b.from : seam.b.to)

	const pairs: [Point, Point][] = []

	if (aNear !== undefined && bNear !== undefined) pairs.push([aNear, bNear])
	if (aFar !== undefined && bFar !== undefined) pairs.push([aFar, bFar])

	return pairs
}

interface SeamLayerProps {
	draft: Draft
	screen: (pixels: number) => number
	selectedSeamId: string | undefined
	onSelectSeam: (seamId: string) => void
}

/**
 * Draws each seam as the two runs it covers plus a tie at each end, so which
 * edge is sewn to which is visible without reading a list, and a piece sewn on
 * turned around shows up as crossed ties.
 */
export function SeamLayer(props: SeamLayerProps) {
	return (
		<g pointerEvents="none">
			{props.draft.seams.map((seam) => {
				const aPoints = runPoints(props.draft, seam.a)
				const bPoints = runPoints(props.draft, seam.b)
				const pairs = ties(props.draft, seam)

				const chosen = props.selectedSeamId === seam.id
				const mismatch = seamMismatch(seam)
				const colour = mismatch > 0.5 ? "var(--color-destructive)" : "var(--color-seam)"

				const label = pairs[0] === undefined ? undefined : middle(pairs)

				return (
					<g key={seam.id} opacity={chosen ? 1 : 0.75}>
						{[aPoints, bPoints].map((points, side) => (
							<polyline
								key={`${seam.id}-${side === 0 ? "a" : "b"}`}
								points={points.map((entry) => `${entry.x},${entry.y}`).join(" ")}
								fill="none"
								stroke={colour}
								strokeWidth={props.screen(chosen ? 5 : 3.5)}
								strokeLinecap="round"
								opacity={0.55}
							/>
						))}

						{pairs.map(([from, to], index) => (
							<line
								key={`${seam.id}-tie-${index === 0 ? "near" : "far"}`}
								x1={from.x}
								y1={from.y}
								x2={to.x}
								y2={to.y}
								stroke={colour}
								strokeWidth={props.screen(chosen ? 1.6 : 1)}
								strokeDasharray={`${props.screen(5)} ${props.screen(4)}`}
							/>
						))}

						{label === undefined ? null : (
							/* biome-ignore lint/a11y/noStaticElementInteractions: the seam list in the inspector is the keyboard path. */
							<text
								x={label.x}
								y={label.y}
								textAnchor="middle"
								dominantBaseline="central"
								fontSize={props.screen(12)}
								fill={colour}
								paintOrder="stroke"
								stroke="var(--color-background)"
								strokeWidth={props.screen(5)}
								strokeLinejoin="round"
								pointerEvents="all"
								className="cursor-pointer"
								onClick={() => props.onSelectSeam(seam.id)}
							>
								{mismatch > 0.5 ? `${seam.name} ⚠ ${mismatch}cm` : seam.name}
							</text>
						)}
					</g>
				)
			})}
		</g>
	)
}

function middle(pairs: readonly [Point, Point][]): Point {
	const points = pairs.flat()

	return {
		x: points.reduce((total, entry) => total + entry.x, 0) / points.length,
		y: points.reduce((total, entry) => total + entry.y, 0) / points.length,
	}
}
