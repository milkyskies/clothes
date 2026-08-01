import { useMemo, useRef } from "react"
import { edgeGaps, pointAlong } from "@/lib/drafting/assembly"
import { type Draft, findPanel, panelPath } from "@/lib/drafting/draft"
import type { Point } from "@/lib/drafting/geometry/path"
import { pathToSvg } from "@/lib/drafting/geometry/svg"
import { assemble, type Matrix, placementMatrix } from "@/lib/drafting/layout"
import { useCanvasView } from "../use-canvas-view"
import type { Editor } from "../use-editor"

const FRAME_CM = 260
const MARGIN = 20

function place(matrix: Matrix, point: Point): Point {
	return {
		x: matrix.a * point.x + matrix.c * point.y + matrix.e,
		y: matrix.b * point.x + matrix.d * point.y + matrix.f,
	}
}

/** The unsewn runs of every piece, in the positions the assembly puts them. */
function openEdges(draft: Draft, assembly: ReturnType<typeof assemble>) {
	return assembly.placements.flatMap((placement) => {
		const panel = findPanel(draft, placement.panelId)

		if (panel === undefined) return []

		return panel.vertices.flatMap((vertex) => {
			const edge = { panelId: panel.id, vertexId: vertex.id }

			return edgeGaps(draft, edge).map((gap) => {
				const steps = Math.max(2, Math.round((gap.to - gap.from) / 2))

				const points = Array.from({ length: steps + 1 }, (_, step) =>
					pointAlong(draft, edge, gap.from + ((gap.to - gap.from) * step) / steps),
				)
					.filter((entry): entry is Point => entry !== undefined)
					.map((entry) => place(placement.matrix, entry))

				return { key: `${panel.id}-${vertex.id}-${gap.from}`, points }
			})
		})
	})
}

interface FinishedViewProps {
	editor: Editor
}

/**
 * The garment opened out flat, built by following the seams.
 *
 * Clothes cut from flat pieces spread out on a table exactly like this, so this
 * is the finished shape rather than a picture of it: move a line in 製図 and the
 * whole thing changes with it.
 */
export function FinishedView(props: FinishedViewProps) {
	const containerRef = useRef<HTMLDivElement>(null)

	const view = useCanvasView(containerRef, {
		width: FRAME_CM,
		height: FRAME_CM,
		margin: MARGIN,
	})

	const { draft } = props.editor
	const assembly = useMemo(() => assemble(draft), [draft])
	const loose = new Set(assembly.loose)

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full touch-none overflow-hidden overscroll-none bg-background"
		>
			<svg
				viewBox={view.viewBox}
				preserveAspectRatio="xMidYMid slice"
				role="img"
				aria-label="出来上がり図"
				className="h-full w-full cursor-grab"
			>
				<rect
					x={-3000}
					y={-3000}
					width={6000}
					height={6000}
					fill="transparent"
					data-canvas-background
				/>

				{assembly.placements.map((placement) => {
					const panel = findPanel(draft, placement.panelId)

					if (panel === undefined) return null

					const matrix = placementMatrix(placement, panel)

					return (
						<g
							key={placement.panelId}
							transform={`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`}
							opacity={loose.has(panel.id) ? 0.3 : 1}
						>
							<path
								d={pathToSvg(panelPath(panel))}
								fill="var(--color-foreground)"
								fillOpacity={0.06}
								stroke="var(--color-foreground)"
								strokeWidth={view.screen(1)}
								strokeOpacity={0.35}
								strokeLinejoin="round"
							/>
						</g>
					)
				})}

				<g pointerEvents="none">
					{openEdges(draft, assembly).map((run) => (
						<polyline
							key={run.key}
							points={run.points.map((entry) => `${entry.x},${entry.y}`).join(" ")}
							fill="none"
							stroke="var(--color-cut)"
							strokeWidth={view.screen(2)}
							strokeLinecap="round"
						/>
					))}
				</g>

				{assembly.closures.map((closure) => (
					<g key={closure.seamId} pointerEvents="none">
						<line
							x1={closure.from.x}
							y1={closure.from.y}
							x2={closure.to.x}
							y2={closure.to.y}
							stroke="var(--color-seam)"
							strokeWidth={view.screen(1.2)}
							strokeDasharray={`${view.screen(6)} ${view.screen(5)}`}
						/>
						<text
							x={(closure.from.x + closure.to.x) / 2}
							y={(closure.from.y + closure.to.y) / 2}
							textAnchor="middle"
							dominantBaseline="central"
							fontSize={view.screen(11)}
							fill="var(--color-seam)"
							paintOrder="stroke"
							stroke="var(--color-background)"
							strokeWidth={view.screen(4)}
							strokeLinejoin="round"
						>
							{closure.name}
						</text>
					</g>
				))}
			</svg>

			<div className="pointer-events-none absolute bottom-3 left-3 space-y-0.5 text-xs text-muted-foreground">
				<p>
					{"赤いふちは縫われていないところ。点線は台の上では合わせられない縫いで、着ると閉じます。"}
				</p>
				{assembly.loose.length === 0 ? null : (
					<p>{`${assembly.loose.length}枚がまだどこにも付いていません（うすく表示）。`}</p>
				)}
			</div>
		</div>
	)
}
