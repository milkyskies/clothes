import { type MouseEvent as ReactMouseEvent, useMemo, useRef, useState } from "react"
import { addSeam, seamsOnEdge } from "@/lib/drafting/assemble"
import { edgeLength, sameEdge } from "@/lib/drafting/assembly"
import { type EdgeRef, findPanel, panelBounds, panelPath } from "@/lib/drafting/draft"
import type { Point } from "@/lib/drafting/geometry/path"
import { pathToSvg } from "@/lib/drafting/geometry/svg"
import { assemble, type Placement } from "@/lib/drafting/layout"
import { selectionActions } from "../actions"
import { applyMatrix, edgeState, midOf, runPolyline, tidied } from "../assembled-geometry"
import { useCanvasView } from "../use-canvas-view"
import type { Editor } from "../use-editor"
import { ContextMenu, type MenuTarget } from "./context-menu"

const FRAME_CM = 220
const MARGIN = 20

/**
 * A click counts as landing on nothing when it hits the sheet behind everything.
 * Comparing against the svg itself is not enough: that sheet is a real element
 * and it is what actually receives the click.
 */
function hitBackground(event: ReactMouseEvent): boolean {
	if (event.target === event.currentTarget) return true

	return event.target instanceof Element && event.target.hasAttribute("data-canvas-background")
}

function pointsOf(points: readonly Point[]): string {
	return points.map((entry) => `${entry.x},${entry.y}`).join(" ")
}

interface AssembleViewProps {
	editor: Editor
}

/**
 * 組み立て works on the garment as it comes together, not on the drafting board.
 *
 * Drawn where they were drafted, two pieces that get sewn to each other can sit
 * a metre apart, and saying so needs a line across everything else. Put each
 * piece where its seams put it and the line is not needed at all: the edges are
 * already touching. Folds are ignored here so that nothing hides behind
 * anything, which matters when every edge has to be clickable.
 */
export function AssembleView(props: AssembleViewProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [hovered, setHovered] = useState<EdgeRef | undefined>(undefined)
	const [menu, setMenu] = useState<MenuTarget | undefined>(undefined)

	const pending = props.editor.pending
	const setPending = props.editor.setPending

	const view = useCanvasView(containerRef, {
		width: FRAME_CM,
		height: FRAME_CM,
		margin: MARGIN,
	})

	const { draft, selection } = props.editor
	const assembly = useMemo(() => assemble(draft, { opened: true }), [draft])
	const placements = useMemo(() => tidied(draft, assembly), [draft, assembly])

	const chosen =
		selection.panelId === undefined || selection.edgeVertexId === undefined
			? undefined
			: { panelId: selection.panelId, vertexId: selection.edgeVertexId }

	const shownSeams = draft.seams.filter((seam) => {
		if (seam.id === selection.seamId) return true
		if (chosen === undefined) return false

		return sameEdge(seam.a.edge, chosen) || sameEdge(seam.b.edge, chosen)
	})

	function matrixOf(panelId: string) {
		return placements.find((entry) => entry.panelId === panelId)?.matrix
	}

	function choose(edge: EdgeRef) {
		// Picking an edge picks the seam on it too, so the verbs above the canvas
		// have something named to act on instead of a bare edge.
		props.editor.select({
			panelId: edge.panelId,
			edgeVertexId: edge.vertexId,
			seamId: seamsOnEdge(draft, edge)[0]?.id,
		})

		if (pending === undefined) {
			setPending(edge)
			return
		}

		if (sameEdge(pending, edge)) {
			setPending(undefined)
			return
		}

		props.editor.apply(addSeam(draft, pending, edge))
		setPending(undefined)
	}

	function labelOf(placement: Placement) {
		const panel = findPanel(draft, placement.panelId)

		if (panel === undefined) return null

		const bounds = panelBounds(panel)
		const middle = applyMatrix(placement.matrix, {
			x: panel.x + bounds.minX + bounds.width / 2,
			y: panel.y + bounds.minY + bounds.height / 2,
		})

		return (
			<text
				x={middle.x}
				y={middle.y}
				textAnchor="middle"
				dominantBaseline="central"
				fontSize={view.screen(12)}
				fill="var(--color-muted-foreground)"
				pointerEvents="none"
			>
				{panel.name}
			</text>
		)
	}

	function edgeMenu(edge: EdgeRef, event: ReactMouseEvent) {
		event.preventDefault()
		choose(edge)

		const held = seamsOnEdge(draft, edge)

		const built = selectionActions({
			...props.editor,
			selection: { panelId: edge.panelId, edgeVertexId: edge.vertexId, seamId: held[0]?.id },
		})

		setMenu({
			clientX: event.clientX,
			clientY: event.clientY,
			title: built.title,
			items: built.actions.map((action) => ({
				label: action.label,
				icon: action.icon,
				danger: action.danger,
				onSelect: action.run,
			})),
		})
	}

	function edgesOf(placement: Placement) {
		const panel = findPanel(draft, placement.panelId)

		if (panel === undefined) return []

		return panel.vertices.map((vertex) => {
			const edge: EdgeRef = { panelId: panel.id, vertexId: vertex.id }
			const state = edgeState(draft, edge)

			return {
				edge,
				whole: runPolyline(draft, placement.matrix, edge, 0, edgeLength(draft, edge)),
				gaps: state.gaps.map((span) => ({
					key: `${vertex.id}-gap-${span.from}`,
					points: runPolyline(draft, placement.matrix, edge, span.from, span.to),
				})),
				sewn: state.sewn.map((span) => ({
					key: `${vertex.id}-sewn-${span.from}`,
					points: runPolyline(draft, placement.matrix, edge, span.from, span.to),
				})),
			}
		})
	}

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full touch-none overflow-hidden overscroll-none bg-background"
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: the seam list in the inspector is the keyboard path. */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: this is a pointer surface; the inspector mirrors every action. */}
			<svg
				viewBox={view.viewBox}
				preserveAspectRatio="xMidYMid slice"
				role="img"
				aria-label="組み立て"
				className="h-full w-full cursor-grab"
				onClick={(event) => {
					if (!hitBackground(event)) return

					props.editor.select({})
					setPending(undefined)
				}}
			>
				<rect
					x={-3000}
					y={-3000}
					width={6000}
					height={6000}
					fill="transparent"
					data-canvas-background
				/>

				{placements.map((placement) => {
					const panel = findPanel(draft, placement.panelId)

					if (panel === undefined) return null

					const { matrix } = placement

					return (
						<g key={placement.panelId}>
							<g
								transform={`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.a * panel.x + matrix.c * panel.y + matrix.e} ${matrix.b * panel.x + matrix.d * panel.y + matrix.f})`}
							>
								<path
									d={pathToSvg(panelPath(panel))}
									fill="var(--color-foreground)"
									fillOpacity={placement.panelId === selection.panelId ? 0.09 : 0.04}
								/>
							</g>

							{labelOf(placement)}

							{edgesOf(placement).map((entry) => {
								const held = pending !== undefined && sameEdge(pending, entry.edge)
								const picked = chosen !== undefined && sameEdge(chosen, entry.edge)
								const under = hovered !== undefined && sameEdge(hovered, entry.edge)

								return (
									<g key={entry.edge.vertexId}>
										{entry.sewn.map((run) => (
											<polyline
												key={run.key}
												points={pointsOf(run.points)}
												fill="none"
												stroke="var(--color-seam)"
												strokeWidth={view.screen(1.6)}
												strokeLinecap="round"
												opacity={0.5}
												pointerEvents="none"
											/>
										))}

										{entry.gaps.map((run) => (
											<polyline
												key={run.key}
												points={pointsOf(run.points)}
												fill="none"
												stroke="var(--color-cut)"
												strokeWidth={view.screen(2.4)}
												strokeLinecap="round"
												pointerEvents="none"
											/>
										))}

										{held || picked || under ? (
											<polyline
												points={pointsOf(entry.whole)}
												fill="none"
												stroke={held ? "var(--color-ring)" : "var(--color-foreground)"}
												strokeWidth={view.screen(held ? 5 : 3.5)}
												strokeLinecap="round"
												opacity={held ? 0.9 : picked ? 0.4 : 0.2}
												pointerEvents="none"
											/>
										) : null}

										{/* biome-ignore lint/a11y/noStaticElementInteractions: every edge is also reachable from the seam list. */}
										<polyline
											points={pointsOf(entry.whole)}
											fill="none"
											stroke="var(--color-foreground)"
											strokeOpacity={0.001}
											strokeWidth={view.screen(14)}
											strokeLinecap="round"
											pointerEvents="stroke"
											className="cursor-pointer"
											onPointerEnter={() => setHovered(entry.edge)}
											onPointerLeave={() =>
												setHovered((held) =>
													held !== undefined && sameEdge(held, entry.edge) ? undefined : held,
												)
											}
											onClick={(event) => {
												event.stopPropagation()
												choose(entry.edge)
											}}
											onContextMenu={(event) => edgeMenu(entry.edge, event)}
										/>
									</g>
								)
							})}
						</g>
					)
				})}

				{shownSeams.map((seam) => {
					const held = matrixOf(seam.a.edge.panelId)
					const moving = matrixOf(seam.b.edge.panelId)

					if (held === undefined || moving === undefined) return null

					const a = midOf(runPolyline(draft, held, seam.a.edge, seam.a.from, seam.a.to))
					const b = midOf(runPolyline(draft, moving, seam.b.edge, seam.b.from, seam.b.to))

					if (a === undefined || b === undefined) return null

					return (
						<g key={seam.id} pointerEvents="none">
							<line
								x1={a.x}
								y1={a.y}
								x2={b.x}
								y2={b.y}
								stroke="var(--color-seam)"
								strokeWidth={view.screen(1.4)}
								strokeDasharray={`${view.screen(5)} ${view.screen(4)}`}
							/>
							<text
								x={(a.x + b.x) / 2}
								y={(a.y + b.y) / 2}
								textAnchor="middle"
								dominantBaseline="central"
								fontSize={view.screen(12)}
								fill="var(--color-seam)"
								paintOrder="stroke"
								stroke="var(--color-background)"
								strokeWidth={view.screen(5)}
								strokeLinejoin="round"
							>
								{seam.name}
							</text>
						</g>
					)
				})}
			</svg>

			{menu === undefined ? null : (
				<ContextMenu target={menu} onDismiss={() => setMenu(undefined)} />
			)}

			{assembly.loose.length === 0 ? null : (
				<p className="pointer-events-none absolute top-3 left-3 text-xs text-muted-foreground">
					{`下に並んでいる ${assembly.loose.length}枚 はまだどこにも付いていません。`}
				</p>
			)}
		</div>
	)
}
