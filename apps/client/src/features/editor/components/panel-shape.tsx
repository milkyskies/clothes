import { edgeGaps } from "@/lib/drafting/assembly"
import {
	type Document,
	type Panel,
	panelAllowance,
	panelPath,
	vertexPoint,
} from "@/lib/drafting/document"
import { flatten } from "@/lib/drafting/geometry/measure"
import { offsetPath } from "@/lib/drafting/geometry/offset"
import { pathToSvg, verticesToSvg } from "@/lib/drafting/geometry/svg"
import type { Selection } from "../use-editor"
import { useSvgPointDrag } from "../use-svg-point-drag"

interface PanelShapeProps {
	document: Document
	panel: Panel
	unit: number
	selection: Selection
	interactive: boolean
	showAllowance: boolean
	onSelectPanel: () => void
	onSelectEdge: (vertexId: string) => void
	onMovePanel: (x: number, y: number, done: boolean) => void
}

function mirrorAcrossFold(panel: Panel): string | undefined {
	if (panel.foldEdge === undefined) return undefined

	const index = panel.vertices.findIndex((vertex) => vertex.id === panel.foldEdge)
	const from = panel.vertices[index]
	const to = panel.vertices[(index + 1) % panel.vertices.length]

	if (from === undefined || to === undefined) return undefined

	const origin = { x: from.x, y: from.y }
	const spanX = to.x - from.x
	const spanY = to.y - from.y
	const squared = spanX * spanX + spanY * spanY

	if (squared === 0) return undefined

	function reflect(x: number, y: number): { x: number; y: number } {
		const projection = ((x - origin.x) * spanX + (y - origin.y) * spanY) / squared

		return {
			x: 2 * (origin.x + projection * spanX) - x,
			y: 2 * (origin.y + projection * spanY) - y,
		}
	}

	const reflected = panel.vertices.map((vertex) => reflect(vertex.x, vertex.y))
	const [head, ...rest] = reflected

	if (head === undefined) return undefined

	return `M ${head.x} ${head.y} ${rest.map((entry) => `L ${entry.x} ${entry.y}`).join(" ")} Z`
}

/**
 * Draws the outline, the cut line, and the runs of each edge that no seam
 * covers. Those gaps are what a sewer reads as 脇あき or 身八つ口; nothing in
 * here knows those words.
 */
export function PanelShape(props: PanelShapeProps) {
	const move = useSvgPointDrag({
		x: props.panel.x,
		y: props.panel.y,
		onChange: props.onMovePanel,
	})

	const path = panelPath(props.panel)
	const cut = offsetPath(path, panelAllowance(props.panel, props.document.defaultAllowance))
	const selected = props.selection.panelId === props.panel.id

	// 「わ」 means the piece is cut against a fold, so what is drawn is half of it. Reflecting the outline shows the other half without it becoming real geometry.
	const mirrored = mirrorAcrossFold(props.panel)

	// The name sits inside the piece, the way a printed 裁ち方図 labels it, so it follows the shape however the outline is edited.
	const centre = {
		x:
			props.panel.vertices.reduce((total, vertex) => total + vertex.x, 0) /
			props.panel.vertices.length,
		y:
			props.panel.vertices.reduce((total, vertex) => total + vertex.y, 0) /
			props.panel.vertices.length,
	}

	const gapSegments = props.panel.vertices.flatMap((vertex) => {
		const edge = { panelId: props.panel.id, vertexId: vertex.id }
		const spans = edgeGaps(props.document, edge)

		if (spans.length === 0) return []

		const index = props.panel.vertices.indexOf(vertex)
		const segment = path.segments[index]

		if (segment === undefined) return []

		const samples = flatten({ start: vertexPoint(vertex), segments: [segment] })

		return spans.map((span) => {
			const total = samples.length - 1
			const length = Math.hypot(segment.to.x - vertex.x, segment.to.y - vertex.y)
			const first = Math.max(0, Math.round((span.from / Math.max(length, 0.001)) * total))
			const last = Math.min(total, Math.round((span.to / Math.max(length, 0.001)) * total))
			const slice = samples.slice(first, last + 1)

			return {
				key: `${vertex.id}-${span.from}`,
				points: slice.map((entry) => `${entry.point.x},${entry.point.y}`).join(" "),
			}
		})
	})

	return (
		<g transform={`translate(${props.panel.x} ${props.panel.y})`}>
			{props.showAllowance ? (
				<path
					d={verticesToSvg(cut)}
					fill="none"
					stroke="var(--color-cut)"
					strokeWidth={props.unit * 0.14}
					strokeDasharray={`${props.unit} ${props.unit * 0.6}`}
					pointerEvents="none"
				/>
			) : null}

			<path
				d={pathToSvg(path)}
				fill={selected ? "var(--color-accent)" : "var(--color-muted)"}
				fillOpacity={selected ? 0.45 : 0.2}
				stroke="var(--color-foreground)"
				strokeWidth={props.unit * (selected ? 0.28 : 0.2)}
				strokeLinejoin="round"
				className={props.interactive ? "cursor-move" : undefined}
				style={{ touchAction: "none" }}
				onPointerDown={
					props.interactive
						? (event) => {
								props.onSelectPanel()
								move.onPointerDown(event)
							}
						: undefined
				}
			/>

			{gapSegments.map((gap) => (
				<polyline
					key={gap.key}
					points={gap.points}
					fill="none"
					stroke="var(--color-background)"
					strokeWidth={props.unit * 0.5}
					pointerEvents="none"
				/>
			))}

			{gapSegments.map((gap) => (
				<polyline
					key={`${gap.key}-mark`}
					points={gap.points}
					fill="none"
					stroke="var(--color-fold)"
					strokeWidth={props.unit * 0.34}
					strokeLinecap="round"
					strokeDasharray={`${props.unit * 0.1} ${props.unit * 0.9}`}
					pointerEvents="none"
				/>
			))}

			{props.interactive
				? props.panel.vertices.map((vertex, index) => {
						const segment = path.segments[index]

						if (segment === undefined) return null

						const midX = (vertex.x + segment.to.x) / 2
						const midY = (vertex.y + segment.to.y) / 2

						return (
							// biome-ignore lint/a11y/noStaticElementInteractions: keyboard reach is provided by the inspector edge list.
							<circle
								key={`${vertex.id}-edge`}
								cx={midX}
								cy={midY}
								r={props.unit * 0.9}
								fill={
									props.selection.edgeVertexId === vertex.id
										? "var(--color-foreground)"
										: "transparent"
								}
								stroke="var(--color-muted-foreground)"
								strokeWidth={props.unit * 0.12}
								className="cursor-pointer"
								onClick={(event) => {
									event.stopPropagation()
									props.onSelectEdge(vertex.id)
								}}
							/>
						)
					})
				: null}

			{mirrored === undefined ? null : (
				<path
					d={mirrored}
					fill="var(--color-muted)"
					fillOpacity={0.12}
					stroke="var(--color-fold)"
					strokeWidth={props.unit * 0.14}
					strokeDasharray={`${props.unit * 0.8} ${props.unit * 0.5}`}
					pointerEvents="none"
				/>
			)}

			<text
				x={centre.x}
				y={centre.y}
				textAnchor="middle"
				dominantBaseline="central"
				fontSize={props.unit * 2.4}
				fill="var(--color-muted-foreground)"
				pointerEvents="none"
			>
				{props.panel.name}
				{props.panel.quantity > 1 ? <tspan>{` ${props.panel.quantity}枚`}</tspan> : null}
				{props.panel.foldEdge === undefined ? null : (
					<tspan fill="var(--color-fold)">{" わ"}</tspan>
				)}
			</text>
		</g>
	)
}
