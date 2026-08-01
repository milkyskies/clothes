import { type MouseEvent as ReactMouseEvent, useRef, useState } from "react"
import { FitIcon } from "@/features/shared/icons/fit-icon"
import { PenIcon } from "@/features/shared/icons/pen-icon"
import { RectangleIcon } from "@/features/shared/icons/rectangle-icon"
import { findPanel, panelBounds } from "@/lib/drafting/draft"
import {
	addPolygonPanel,
	addRectanglePanel,
	movePanel,
	moveVertex,
	setEdgeBow,
	setEdgeBowAt,
} from "@/lib/drafting/edit"
import { edgeActions, panelActions, vertexActions } from "../actions"
import { useCanvasView } from "../use-canvas-view"
import type { Editor } from "../use-editor"
import { snapValue } from "../use-editor"
import { ContextMenu, type MenuTarget } from "./context-menu"
import { PanelShape } from "./panel-shape"
import { StitchLayer } from "./stitch-layer"
import { VertexHandles } from "./vertex-handles"

const MARGIN = 20
const TICK_SPACING = 10

const GRID_EXTENT_CM = 600

interface GridProps {
	screen: (pixels: number) => number
	extent: number
	ticks: readonly number[]
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
						strokeWidth={props.screen(0.5)}
					/>
				</pattern>
				<pattern id="edit-grid-major" width={10} height={10} patternUnits="userSpaceOnUse">
					<rect width={10} height={10} fill="url(#edit-grid-minor)" />
					<path
						d="M 10 0 L 0 0 0 10"
						fill="none"
						stroke="var(--color-grid-strong)"
						strokeWidth={props.screen(0.9)}
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
				strokeWidth={props.screen(1)}
				pointerEvents="none"
			/>

			<line
				x1={0}
				y1={-props.extent}
				x2={0}
				y2={props.extent}
				stroke="var(--color-grid-strong)"
				strokeWidth={props.screen(1)}
				pointerEvents="none"
			/>

			{props.ticks.map((value) => (
				<g key={value} pointerEvents="none" opacity={0.75}>
					<text
						x={value}
						y={-props.screen(8)}
						textAnchor="middle"
						fontSize={props.screen(12)}
						fill="var(--color-muted-foreground)"
					>
						{value}
					</text>
					<text
						x={-props.screen(7)}
						y={value}
						textAnchor="end"
						dominantBaseline="central"
						fontSize={props.screen(12)}
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
	const [menu, setMenu] = useState<MenuTarget | undefined>(undefined)

	// The frame is captured once when the view opens, so it greets you centred on
	// the pieces and then holds still: deriving it live from the drawing made the
	// viewBox change as pieces moved, which read as the canvas zooming on its own.
	const [frame] = useState(() => {
		const panels = props.editor.draft.panels

		if (panels.length === 0) return { x: -20, y: -20, width: 180, height: 180 }

		const corners = panels.flatMap((panel) => {
			const bounds = panelBounds(panel)

			return [
				{ x: panel.x + bounds.minX, y: panel.y + bounds.minY },
				{ x: panel.x + bounds.maxX, y: panel.y + bounds.maxY },
			]
		})

		const xs = corners.map((corner) => corner.x)
		const ys = corners.map((corner) => corner.y)
		const minX = Math.min(...xs)
		const minY = Math.min(...ys)

		return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
	})

	const view = useCanvasView(containerRef, {
		width: frame.width,
		height: frame.height,
		x: frame.x,
		y: frame.y,
		margin: MARGIN,
	})
	const ticks = Array.from(
		{ length: Math.floor(GRID_EXTENT_CM / TICK_SPACING) * 2 + 1 },
		(_, index) => (index - Math.floor(GRID_EXTENT_CM / TICK_SPACING)) * TICK_SPACING,
	).filter((value) => value !== 0)

	function menuFor(
		kind: "panel" | "edge" | "vertex",
		id: string,
		clientX: number,
		clientY: number,
	) {
		const panelId = kind === "panel" ? id : props.editor.selection.panelId

		if (panelId === undefined) return

		const built =
			kind === "panel"
				? {
						title: findPanel(props.editor.draft, id)?.name ?? "パーツ",
						actions: panelActions(props.editor, id),
					}
				: kind === "edge"
					? { title: "辺", actions: edgeActions(props.editor, panelId, id) }
					: { title: "点", actions: vertexActions(props.editor, panelId, id) }

		setMenu({
			clientX,
			clientY,
			title: built.title,
			items: built.actions.map((action) => ({
				label: action.label,
				icon: action.icon,
				danger: action.danger,
				onSelect: action.run,
			})),
		})
	}

	function canvasMenu(event: ReactMouseEvent<SVGSVGElement>) {
		const spot = toDocumentPoint(event)

		setMenu({
			clientX: event.clientX,
			clientY: event.clientY,
			title: `${spot.x} , ${spot.y} cm`,
			items: [
				{
					label: "ここに長方形を足す",
					icon: RectangleIcon,
					onSelect: () => {
						const created = addRectanglePanel(props.editor.draft, spot.x, spot.y, 30, 70)

						props.editor.apply(created.draft)
						props.editor.select({ panelId: created.panelId })
					},
				},
				{
					label: "ペンで描く",
					icon: PenIcon,
					onSelect: () => {
						props.editor.setTool("pen")
						setDraft([])
					},
				},
				{ label: "全体を表示", icon: FitIcon, onSelect: () => view.fit() },
			],
		})
	}

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
			const created = addPolygonPanel(props.editor.draft, draft)

			props.editor.apply(created.draft)
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
			className="relative h-full w-full touch-none select-none overflow-hidden overscroll-none bg-background"
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: the canvas is a pointer surface; the inspector provides the keyboard path. */}
			<svg
				viewBox={view.viewBox}
				preserveAspectRatio="xMidYMid slice"
				role="img"
				aria-label="製図"
				className={`h-full w-full ${props.editor.tool === "pen" ? "cursor-crosshair" : "cursor-grab"}`}
				onClick={handleCanvasClick}
				onContextMenu={(event) => {
					if (!hitEmptyCanvas(event)) return

					event.preventDefault()
					canvasMenu(event)
				}}
			>
				<Grid screen={view.screen} extent={GRID_EXTENT_CM} ticks={ticks} />

				{props.editor.draft.panels.map((panel) => (
					<PanelShape
						key={panel.id}
						draft={props.editor.draft}
						panel={panel}
						screen={view.screen}
						selection={props.editor.selection}
						interactive={props.editor.tool === "select"}
						onSelectPanel={() => props.editor.select({ panelId: panel.id })}
						onSelectEdge={(vertexId) =>
							props.editor.select({ panelId: panel.id, edgeVertexId: vertexId })
						}
						onMenu={(kind, id, clientX, clientY) => menuFor(kind, id, clientX, clientY)}
						onMovePanel={(x, y, done) =>
							props.editor.apply(
								movePanel(
									props.editor.draft,
									panel.id,
									snapValue(x, props.editor.snap),
									snapValue(y, props.editor.snap),
								),
								!done,
							)
						}
					/>
				))}

				<StitchLayer draft={props.editor.draft} screen={view.screen} selectedStitchId={undefined} />

				{props.editor.tool === "select" && props.editor.selection.panelId !== undefined
					? props.editor.draft.panels
							.filter((panel) => panel.id === props.editor.selection.panelId)
							.map((panel) => (
								<VertexHandles
									key={panel.id}
									panel={panel}
									screen={view.screen}
									selection={props.editor.selection}
									onSelect={(vertexId) => props.editor.select({ panelId: panel.id, vertexId })}
									onSelectEdge={(vertexId) =>
										props.editor.select({ panelId: panel.id, edgeVertexId: vertexId })
									}
									onMenu={(vertexId, clientX, clientY) =>
										menuFor("vertex", vertexId, clientX, clientY)
									}
									onMove={(vertexId, x, y, done) =>
										props.editor.apply(
											moveVertex(
												props.editor.draft,
												panel.id,
												vertexId,
												snapValue(x, props.editor.snap),
												snapValue(y, props.editor.snap),
											),
											!done,
										)
									}
									onSetBow={(vertexId, bow, at, done) =>
										props.editor.apply(
											setEdgeBowAt(
												setEdgeBow(props.editor.draft, panel.id, vertexId, bow),
												panel.id,
												vertexId,
												at,
											),
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
						strokeWidth={view.screen(1.4)}
						strokeDasharray={`${view.screen(6)} ${view.screen(4)}`}
					/>
				) : null}

				{draft.map((entry) => (
					<rect
						key={`${entry.x}-${entry.y}`}
						x={entry.x - view.screen(4)}
						y={entry.y - view.screen(4)}
						width={view.screen(8)}
						height={view.screen(8)}
						fill="var(--color-background)"
						stroke="var(--color-foreground)"
						strokeWidth={view.screen(1.2)}
					/>
				))}
			</svg>

			{menu === undefined ? null : (
				<ContextMenu target={menu} onDismiss={() => setMenu(undefined)} />
			)}
		</div>
	)
}
