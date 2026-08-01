import { runLength, seamMismatch } from "@/lib/drafting/assemble"
import { type Draft, type EdgeRun, findPanel, panelPath, vertexIndex } from "@/lib/drafting/draft"
import { flatten } from "@/lib/drafting/geometry/measure"
import type { Point } from "@/lib/drafting/geometry/path"
import { segmentStart } from "@/lib/drafting/geometry/path"

/** Walks an edge to the point a given number of centimetres along it. */
function pointAlong(draft: Draft, run: EdgeRun, distance: number): Point | undefined {
	const panel = findPanel(draft, run.edge.panelId)

	if (panel === undefined) return undefined

	const index = vertexIndex(panel, run.edge.vertexId)
	const path = panelPath(panel)
	const segment = path.segments[index]

	if (segment === undefined) return undefined

	const from = segmentStart(path, index)
	const samples = [...flatten({ start: from, segments: [segment] }).map((s) => s.point), segment.to]

	let travelled = 0

	for (let step = 1; step < samples.length; step += 1) {
		const previous = samples[step - 1]
		const current = samples[step]

		if (previous === undefined || current === undefined) continue

		const length = Math.hypot(current.x - previous.x, current.y - previous.y)

		if (travelled + length >= distance) {
			const along = length === 0 ? 0 : (distance - travelled) / length

			return {
				x: panel.x + previous.x + (current.x - previous.x) * along,
				y: panel.y + previous.y + (current.y - previous.y) * along,
			}
		}

		travelled += length
	}

	const last = samples[samples.length - 1]

	return last === undefined ? undefined : { x: panel.x + last.x, y: panel.y + last.y }
}

function runPoints(draft: Draft, run: EdgeRun): Point[] {
	const total = Math.max(1, Math.round(runLength(run) / 2))

	return Array.from({ length: total + 1 }, (_, step) =>
		pointAlong(draft, run, run.from + ((run.to - run.from) * step) / total),
	).filter((entry): entry is Point => entry !== undefined)
}

interface SeamLayerProps {
	draft: Draft
	screen: (pixels: number) => number
	selectedSeamId: string | undefined
	onSelectSeam: (seamId: string) => void
}

/**
 * Draws each seam as the two runs it covers plus a tie between their middles, so
 * which edge is sewn to which is visible without reading a list.
 */
export function SeamLayer(props: SeamLayerProps) {
	return (
		<g pointerEvents="none">
			{props.draft.seams.map((seam) => {
				const aPoints = runPoints(props.draft, seam.a)
				const bPoints = runPoints(props.draft, seam.b)
				const aMid = aPoints[Math.floor(aPoints.length / 2)]
				const bMid = bPoints[Math.floor(bPoints.length / 2)]

				const chosen = props.selectedSeamId === seam.id
				const mismatch = seamMismatch(seam)
				const colour = mismatch > 0.5 ? "var(--color-destructive)" : "var(--color-seam)"

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

						{aMid === undefined || bMid === undefined ? null : (
							<>
								<line
									x1={aMid.x}
									y1={aMid.y}
									x2={bMid.x}
									y2={bMid.y}
									stroke={colour}
									strokeWidth={props.screen(chosen ? 1.6 : 1)}
									strokeDasharray={`${props.screen(5)} ${props.screen(4)}`}
								/>

								{/* biome-ignore lint/a11y/noStaticElementInteractions: the seam list in the inspector is the keyboard path. */}
								<text
									x={(aMid.x + bMid.x) / 2}
									y={(aMid.y + bMid.y) / 2}
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
							</>
						)}
					</g>
				)
			})}
		</g>
	)
}
