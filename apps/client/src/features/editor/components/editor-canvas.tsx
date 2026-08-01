import { type MouseEvent as ReactMouseEvent, useRef, useState } from "react"
import { addPolygonPanel, movePanel, moveVertex, setHandle } from "@/lib/drafting/edit"
import { useCanvasView } from "../use-canvas-view"
import type { Editor } from "../use-editor"
import { snapValue } from "../use-editor"
import { PanelShape } from "./panel-shape"
import { VertexHandles } from "./vertex-handles"

const MARGIN = 20
const TICK_SPACING = 10

/**
 * The view frame is a fixed span of cloth rather than the extent of what is
 * drawn. Deriving it from the drawing made the viewBox change as pieces moved,
 * which read as the canvas zooming on its own mid-drag.
 */
const FRAME_CM = 180
const GRID_EXTENT_CM = 600

/** One centimetre, so stroke widths and type sizes below are read as real lengths. */
const UNIT = 1

interface GridProps {
	unit: number
	extent: number
	ticks: readonly number[]
	tickSize: number
}

function Grid(props: GridProps) {
	return (
		<>
			<defs>
				<pattern id="edit-grid-minor" width={1} height={1} patternUnits="userSpaceOnUse">
					<path
						d="M 1 0 L 0 0 0 1"
						fill="none"
						stroke="var(--color-grid)"
						strokeWidth={props.unit * 0.05}
					/>
				</pattern>
				<pattern id="edit-grid-major" width={10} height={10} patternUnits="userSpaceOnUse">
					<rect width={10} height={10} fill="url(#edit-grid-minor)" />
					<path
						d="M 10 0 L 0 0 0 10"
						fill="none"
						stroke="var(--color-grid-strong)"
						strokeWidth={props.unit * 0.09}
					/>
				</pattern>
			</defs>

			<rect
				x={-props.extent}
				y={-props.extent}
				width={props.extent * 2}
				height={props.extent * 2}
				fill="url(#edit-grid-major)"
				data-canvas-background
			/>

			<line
				x1={-props.extent}
				y1={0}
				x2={props.extent}
				y2={0}
				stroke="var(--color-grid-strong)"
				strokeWidth={props.unit * 0.12}
				pointerEvents="none"
			/>

			<line
				x1={0}
				y1={-props.extent}
				x2={0}
				y2={props.extent}
				stroke="var(--color-grid-strong)"
				strokeWidth={props.unit * 0.12}
				pointerEvents="none"
			/>

			{props.ticks.map((value) => (
				<g key={value} pointerEvents="none" opacity={0.75}>
					<text
						x={value}
						y={-props.tickSize * 0.6}
						textAnchor="middle"
						fontSize={props.tickSize}
						fill="var(--color-muted-foreground)"
					>
						{value}
					</text>
					<text
						x={-props.tickSize * 0.5}
						y={value}
						textAnchor="end"
						dominantBaseline="central"
						fontSize={props.tickSize}
						fill="var(--color-muted-foreground)"
					>
						{value}
					</text>
				</g>
			))}
		</>
	)
}

interface EditorCanvasProps {
	editor: Editor
}

export function EditorCanvas(props: EditorCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [draft, setDraft] = useState<{ x: number; y: number }[]>([])

	const view = useCanvasView(containerRef, {
		width: FRAME_CM,
		height: FRAME_CM,
		margin: MARGIN,
	})
	const ticks = Array.from(
		{ length: Math.floor(GRID_EXTENT_CM / TICK_SPACING) * 2 + 1 },
		(_, index) => (index - Math.floor(GRID_EXTENT_CM / TICK_SPACING)) * TICK_SPACING,
	).filter((value) => value !== 0)

	// Axis figures are annotation, not drawing, so they hold their size on screen
	// rather than growing with the cloth as the view zooms in.
	const tickSize = (FRAME_CM / view.zoom) * 0.016

	function toDocumentPoint(event: ReactMouseEvent<SVGSVGElement>): { x: number; y: number } {
		const svg = event.currentTarget
		const rect = svg.getBoundingClientRect()
		const box = svg.viewBox.baseVal

		const x = box.x + ((event.clientX - rect.left) / rect.width) * box.width
		const y = box.y + ((event.clientY - rect.top) / rect.height) * box.height

		return { x: snapValue(x, props.editor.snap), y: snapValue(y, props.editor.snap) }
	}

	// A click on a vertex or panel bubbles here too, and stopping propagation on
	// pointerdown does not stop the click that follows, so deselection is gated on
	// the click having actually landed on empty canvas.
	function hitEmptyCanvas(event: ReactMouseEvent<SVGSVGElement>): boolean {
		if (event.target === event.currentTarget) return true

		return event.target instanceof Element && event.target.hasAttribute("data-canvas-background")
	}

	function handleCanvasClick(event: ReactMouseEvent<SVGSVGElement>) {
		if (props.editor.tool === "select") {
			if (hitEmptyCanvas(event)) props.editor.select({})

			return
		}

		if (props.editor.tool !== "pen") return

		const spot = toDocumentPoint(event)
		const first = draft[0]

		if (
			first !== undefined &&
			draft.length > 2 &&
			Math.hypot(spot.x - first.x, spot.y - first.y) < 2
		) {
			const created = addPolygonPanel(props.editor.document, draft)

			props.editor.apply(created.document)
			props.editor.select({ panelId: created.panelId })
			props.editor.setTool("select")
			setDraft([])

			return
		}

		setDraft((points) => [...points, spot])
	}

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full touch-none overflow-hidden overscroll-none bg-background"
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drawing is pointer work; every operation is also reachable from the inspector. */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: the canvas is a pointer surface; the inspector provides the keyboard path. */}
			<svg
				viewBox={view.viewBox}
				preserveAspectRatio="xMidYMid slice"
				role="img"
				aria-label="製図"
				className={`h-full w-full ${props.editor.tool === "pen" ? "cursor-crosshair" : "cursor-grab"}`}
				onClick={handleCanvasClick}
			>
				<Grid unit={UNIT} extent={GRID_EXTENT_CM} ticks={ticks} tickSize={tickSize} />

				{props.editor.document.panels.map((panel) => (
					<PanelShape
						key={panel.id}
						document={props.editor.document}
						panel={panel}
						unit={UNIT}
						selection={props.editor.selection}
						interactive={props.editor.tool === "select"}
						labelSize={tickSize}
						onSelectPanel={() => props.editor.select({ panelId: panel.id })}
						onSelectEdge={(vertexId) =>
							props.editor.select({ panelId: panel.id, edgeVertexId: vertexId })
						}
						onMovePanel={(x, y, done) =>
							props.editor.apply(
								movePanel(
									props.editor.document,
									panel.id,
									snapValue(x, props.editor.snap),
									snapValue(y, props.editor.snap),
								),
								!done,
							)
						}
					/>
				))}

				{props.editor.tool === "select" && props.editor.selection.panelId !== undefined
					? props.editor.document.panels
							.filter((panel) => panel.id === props.editor.selection.panelId)
							.map((panel) => (
								<VertexHandles
									key={panel.id}
									panel={panel}
									unit={UNIT}
									selection={props.editor.selection}
									onSelect={(vertexId) => props.editor.select({ panelId: panel.id, vertexId })}
									onMove={(vertexId, x, y, done) =>
										props.editor.apply(
											moveVertex(
												props.editor.document,
												panel.id,
												vertexId,
												snapValue(x, props.editor.snap),
												snapValue(y, props.editor.snap),
											),
											!done,
										)
									}
									onMoveHandle={(vertexId, side, x, y, done) =>
										props.editor.apply(
											setHandle(props.editor.document, panel.id, vertexId, side, { x, y }),
											!done,
										)
									}
								/>
							))
					: null}

				{draft.length > 0 ? (
					<polyline
						points={draft.map((entry) => `${entry.x},${entry.y}`).join(" ")}
						fill="none"
						stroke="var(--color-foreground)"
						strokeWidth={UNIT * 0.2}
						strokeDasharray={`${UNIT} ${UNIT * 0.6}`}
					/>
				) : null}

				{draft.map((entry) => (
					<rect
						key={`${entry.x}-${entry.y}`}
						x={entry.x - UNIT * 0.7}
						y={entry.y - UNIT * 0.7}
						width={UNIT * 1.4}
						height={UNIT * 1.4}
						fill="var(--color-background)"
						stroke="var(--color-foreground)"
						strokeWidth={UNIT * 0.16}
					/>
				))}
			</svg>
		</div>
	)
}
