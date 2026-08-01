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

interface PanelShapeProps {
	document: Document
	panel: Panel
	unit: number
	selection: Selection
	interactive: boolean
	onSelectPanel: () => void
	onSelectEdge: (vertexId: string) => void
}

/**
 * Draws the outline, the cut line, and the runs of each edge that no seam
 * covers. Those gaps are what a sewer reads as 脇あき or 身八つ口; nothing in
 * here knows those words.
 */
export function PanelShape(props: PanelShapeProps) {
	const path = panelPath(props.panel)
	const cut = offsetPath(path, panelAllowance(props.panel, props.document.defaultAllowance))
	const selected = props.selection.panelId === props.panel.id

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
			<path
				d={verticesToSvg(cut)}
				fill="var(--color-background)"
				stroke="var(--color-cut)"
				strokeWidth={props.unit * 0.14}
				strokeDasharray={`${props.unit} ${props.unit * 0.6}`}
			/>

			{/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard reach is provided by the panel list in the inspector. */}
			<path
				d={pathToSvg(path)}
				fill={selected ? "var(--color-accent)" : "var(--color-muted)"}
				fillOpacity={selected ? 0.8 : 0.45}
				stroke="var(--color-foreground)"
				strokeWidth={props.unit * (selected ? 0.28 : 0.2)}
				strokeLinejoin="round"
				className={props.interactive ? "cursor-pointer" : undefined}
				onClick={props.interactive ? props.onSelectPanel : undefined}
			/>

			{gapSegments.map((gap) => (
				<polyline
					key={gap.key}
					points={gap.points}
					fill="none"
					stroke="var(--color-background)"
					strokeWidth={props.unit * 0.5}
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

			<text
				x={0}
				y={-props.unit * 1.6}
				fontSize={props.unit * 2.4}
				fill="var(--color-muted-foreground)"
			>
				{props.panel.name}
				{props.panel.quantity > 1 ? <tspan>{` ${props.panel.quantity}枚`}</tspan> : null}
				{props.panel.onFold ? <tspan fill="var(--color-fold)">{" わ"}</tspan> : null}
			</text>
		</g>
	)
}
