import { useMemo, useRef, useState } from "react"
import { Button } from "@/features/shared/ui/button"
import { edgeGaps, pointAlong } from "@/lib/drafting/assembly"
import { type Draft, findPanel, panelPath } from "@/lib/drafting/draft"
import type { Point } from "@/lib/drafting/geometry/path"
import { pathToSvg } from "@/lib/drafting/geometry/svg"
import { assemble, type Matrix, type Placement, placementMatrix } from "@/lib/drafting/layout"
import { placementsBounds } from "../assembled-geometry"
import { useCanvasView } from "../use-canvas-view"
import type { Editor } from "../use-editor"

const MARGIN = 25
const FAR = 500

function place(matrix: Matrix, point: Point): Point {
	return {
		x: matrix.a * point.x + matrix.c * point.y + matrix.e,
		y: matrix.b * point.x + matrix.d * point.y + matrix.f,
	}
}

/**
 * The half of the plane a folded piece is allowed to show.
 *
 * Both halves of a folded piece are drawn from the same outline, one of them
 * mirrored, so each has to be cut back to the side of the fold it came to rest
 * on or the piece appears at twice its length.
 */
function halfPlane(crease: NonNullable<Placement["crease"]>): string {
	const spanX = crease.to.x - crease.from.x
	const spanY = crease.to.y - crease.from.y
	const length = Math.hypot(spanX, spanY) || 1

	const alongX = (spanX / length) * FAR
	const alongY = (spanY / length) * FAR
	const outX = (-spanY / length) * crease.keep * FAR
	const outY = (spanX / length) * crease.keep * FAR

	const start = { x: crease.from.x - alongX, y: crease.from.y - alongY }
	const end = { x: crease.to.x + alongX, y: crease.to.y + alongY }

	return `M ${start.x} ${start.y} L ${end.x} ${end.y} L ${end.x + outX} ${end.y + outY} L ${start.x + outX} ${start.y + outY} Z`
}

/** The unsewn runs of a piece, in the position this placement puts them. */
function openEdges(draft: Draft, placement: Placement) {
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

			return { key: `${panel.id}-${placement.part}-${vertex.id}-${gap.from}`, points }
		})
	})
}

interface FinishedViewProps {
	editor: Editor
}

/**
 * The garment as it lies on a table, built by following its seams and folds.
 *
 * Clothes cut from flat pieces really do lie like this, so this is the finished
 * shape rather than a picture of it: move a line in 製図 and the whole thing
 * changes with it.
 */
export function FinishedView(props: FinishedViewProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [opened, setOpened] = useState(false)

	const { draft } = props.editor

	const [frame] = useState(() => placementsBounds(draft, assemble(draft).placements))

	const view = useCanvasView(containerRef, {
		width: frame.width,
		height: frame.height,
		x: frame.x,
		y: frame.y,
		margin: MARGIN,
	})
	const assembly = useMemo(() => assemble(draft, { opened }), [draft, opened])
	const loose = new Set(assembly.loose)

	// Pieces showing their wrong side are facing away, so they are drawn first and
	// the ones facing you land on top.
	const ordered = [...assembly.placements].sort(
		(left, right) => Number(right.flipped) - Number(left.flipped),
	)

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full touch-none select-none overflow-hidden overscroll-none bg-background"
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

				<defs>
					<pattern
						id="finished-ura-hatch"
						width={1.4}
						height={1.4}
						patternUnits="userSpaceOnUse"
						patternTransform="rotate(45)"
					>
						<line
							x1={0}
							y1={0}
							x2={0}
							y2={1.4}
							stroke="var(--color-foreground)"
							strokeOpacity={0.18}
							strokeWidth={0.25}
						/>
					</pattern>

					{ordered.map((placement) =>
						placement.crease === undefined ? null : (
							<clipPath
								key={`${placement.panelId}-${placement.part}`}
								id={`fold-${placement.panelId}-${placement.part}`}
								clipPathUnits="userSpaceOnUse"
							>
								<path d={halfPlane(placement.crease)} />
							</clipPath>
						),
					)}
				</defs>

				{ordered.map((placement) => {
					const panel = findPanel(draft, placement.panelId)

					if (panel === undefined) return null

					const matrix = placementMatrix(placement, panel)
					const detached = loose.has(panel.id)

					return (
						<g
							key={`${placement.panelId}-${placement.part}`}
							clipPath={
								placement.crease === undefined
									? undefined
									: `url(#fold-${placement.panelId}-${placement.part})`
							}
							opacity={detached ? 0.3 : 1}
						>
							<g
								transform={`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`}
							>
								<path
									d={pathToSvg(panelPath(panel))}
									fill="var(--color-foreground)"
									fillOpacity={0.06}
									stroke="var(--color-foreground)"
									strokeWidth={view.screen(1)}
									strokeOpacity={0.3}
									strokeLinejoin="round"
								/>

								{placement.flipped ? (
									<path d={pathToSvg(panelPath(panel))} fill="url(#finished-ura-hatch)" />
								) : null}
							</g>

							{openEdges(draft, placement).map((run) => (
								<polyline
									key={run.key}
									points={run.points.map((entry) => `${entry.x},${entry.y}`).join(" ")}
									fill="none"
									stroke="var(--color-cut)"
									strokeWidth={view.screen(1.8)}
									strokeLinecap="round"
									pointerEvents="none"
								/>
							))}
						</g>
					)
				})}

				{assembly.closures.map((closure) => (
					<line
						key={closure.seamId}
						x1={closure.from.x}
						y1={closure.from.y}
						x2={closure.to.x}
						y2={closure.to.y}
						stroke="var(--color-seam)"
						strokeWidth={view.screen(1.2)}
						strokeDasharray={`${view.screen(6)} ${view.screen(5)}`}
						pointerEvents="none"
					/>
				))}
			</svg>

			<div className="absolute top-3 left-3 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5">
				<Button
					variant={opened ? "ghost" : "default"}
					size="sm"
					className="h-7 px-2.5 text-xs"
					onClick={() => setOpened(false)}
				>
					{"たたむ"}
				</Button>
				<Button
					variant={opened ? "default" : "ghost"}
					size="sm"
					className="h-7 px-2.5 text-xs"
					onClick={() => setOpened(true)}
				>
					{"開く"}
				</Button>
			</div>

			<div className="pointer-events-none absolute bottom-3 left-3 space-y-0.5 text-xs text-muted-foreground">
				<p>
					{opened
						? "折りをほどいて平らに広げた形です。どの部品も他に隠れません。"
						: "台の上に置いた形です。"}
				</p>
				<p>{"無地＝表が上 ・ 斜線＝裏が上"}</p>
				{assembly.loose.length === 0 ? null : (
					<p>{`${assembly.loose.length}枚がまだどこにも付いていません（うすく表示）。`}</p>
				)}
			</div>
		</div>
	)
}
