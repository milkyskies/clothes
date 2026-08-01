import { type MouseEvent as ReactMouseEvent, useRef, useState } from "react"
import { addPolygonPanel, moveVertex, setHandle } from "@/lib/drafting/edit"
import { useCanvasView } from "../use-canvas-view"
import type { Editor } from "../use-editor"
import { snapValue } from "../use-editor"
import { PanelShape } from "./panel-shape"
import { VertexHandles } from "./vertex-handles"

const MARGIN = 20

interface GridProps {
	unit: number
	extent: number
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
			/>
		</>
	)
}

function documentBounds(editor: Editor): { width: number; height: number } {
	let maxX = 60
	let maxY = 60

	for (const panel of editor.document.panels) {
		for (const vertex of panel.vertices) {
			maxX = Math.max(maxX, panel.x + vertex.x)
			maxY = Math.max(maxY, panel.y + vertex.y)
		}
	}

	return { width: maxX, height: maxY }
}

interface EditorCanvasProps {
	editor: Editor
}

export function EditorCanvas(props: EditorCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [draft, setDraft] = useState<{ x: number; y: number }[]>([])

	const bounds = documentBounds(props.editor)
	const unit = (bounds.width + MARGIN * 2) / 200

	const view = useCanvasView(containerRef, { ...bounds, margin: MARGIN })

	function toDocumentPoint(event: ReactMouseEvent<SVGSVGElement>): { x: number; y: number } {
		const svg = event.currentTarget
		const rect = svg.getBoundingClientRect()
		const box = svg.viewBox.baseVal

		const x = box.x + ((event.clientX - rect.left) / rect.width) * box.width
		const y = box.y + ((event.clientY - rect.top) / rect.height) * box.height

		return { x: snapValue(x, props.editor.snap), y: snapValue(y, props.editor.snap) }
	}

	function handleCanvasClick(event: ReactMouseEvent<SVGSVGElement>) {
		if (props.editor.tool === "select") {
			props.editor.select({})
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
				<Grid unit={unit} extent={Math.max(bounds.width, bounds.height) * 3} />

				{props.editor.document.panels.map((panel) => (
					<PanelShape
						key={panel.id}
						document={props.editor.document}
						panel={panel}
						unit={unit}
						selection={props.editor.selection}
						interactive={props.editor.tool === "select"}
						onSelectPanel={() => props.editor.select({ panelId: panel.id })}
						onSelectEdge={(vertexId) =>
							props.editor.select({ panelId: panel.id, edgeVertexId: vertexId })
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
									unit={unit}
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
						strokeWidth={unit * 0.2}
						strokeDasharray={`${unit} ${unit * 0.6}`}
					/>
				) : null}

				{draft.map((entry) => (
					<rect
						key={`${entry.x}-${entry.y}`}
						x={entry.x - unit * 0.7}
						y={entry.y - unit * 0.7}
						width={unit * 1.4}
						height={unit * 1.4}
						fill="var(--color-background)"
						stroke="var(--color-foreground)"
						strokeWidth={unit * 0.16}
					/>
				))}
			</svg>

			<div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur">
				{props.editor.tool === "pen"
					? "点を置いて、最初の点に戻ると閉じます"
					: "パーツを押すと点をつかめます"}
			</div>
		</div>
	)
}
