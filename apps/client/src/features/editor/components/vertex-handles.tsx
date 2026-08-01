import type { Panel } from "@/lib/drafting/document"
import type { Selection } from "../use-editor"
import { useSvgPointDrag } from "../use-svg-point-drag"

interface VertexHandlesProps {
	panel: Panel
	screen: (pixels: number) => number
	selection: Selection
	onSelect: (vertexId: string) => void
	onMove: (vertexId: string, x: number, y: number, done: boolean) => void
	onSetBow: (vertexId: string, bow: number, done: boolean) => void
	onMenu: (vertexId: string, clientX: number, clientY: number) => void
}

interface DraggableProps {
	x: number
	y: number
	radius: number
	fill: string
	stroke: string
	strokeWidth: number
	square?: boolean
	onDrag: (x: number, y: number, done: boolean) => void
	onSelect?: () => void
	onMenu?: (clientX: number, clientY: number) => void
}

function Draggable(props: DraggableProps) {
	const drag = useSvgPointDrag({ x: props.x, y: props.y, onChange: props.onDrag })

	const common = {
		fill: props.fill,
		stroke: props.stroke,
		strokeWidth: props.strokeWidth,
		className: "cursor-grab active:cursor-grabbing",
		style: { touchAction: "none" as const },
		onPointerDown: (event: React.PointerEvent<SVGElement>) => {
			props.onSelect?.()
			drag.onPointerDown(event)
		},
		onContextMenu: (event: React.MouseEvent<SVGElement>) => {
			if (props.onMenu === undefined) return

			event.preventDefault()
			event.stopPropagation()
			props.onSelect?.()
			props.onMenu(event.clientX, event.clientY)
		},
	}

	if (props.square === true) {
		return (
			<rect
				x={props.x - props.radius}
				y={props.y - props.radius}
				width={props.radius * 2}
				height={props.radius * 2}
				{...common}
			/>
		)
	}

	return <circle cx={props.x} cy={props.y} r={props.radius} {...common} />
}

/**
 * Points can be dragged, and a curved edge carries one grip at its deepest
 * point. Pulling that grip sets how deep the edge bows, which is the number a
 * draft states. There are no bezier handles because a draft never shows any.
 */
export function VertexHandles(props: VertexHandlesProps) {
	return (
		<g transform={`translate(${props.panel.x} ${props.panel.y})`}>
			{props.panel.vertices.map((vertex, index) => {
				const next = props.panel.vertices[(index + 1) % props.panel.vertices.length]

				if (next === undefined) return null

				const active = props.selection.vertexId === vertex.id
				const edgeChosen = props.selection.edgeVertexId === vertex.id
				const bow = vertex.bow ?? 0

				const spanX = next.x - vertex.x
				const spanY = next.y - vertex.y
				const span = Math.hypot(spanX, spanY) || 1
				const normalX = -spanY / span
				const normalY = spanX / span
				const midX = (vertex.x + next.x) / 2
				const midY = (vertex.y + next.y) / 2

				return (
					<g key={vertex.id}>
						{bow !== 0 || edgeChosen ? (
							<>
								<line
									x1={midX}
									y1={midY}
									x2={midX + normalX * bow}
									y2={midY + normalY * bow}
									stroke="var(--color-ring)"
									strokeWidth={props.screen(0.8)}
									strokeDasharray={`${props.screen(2)} ${props.screen(2)}`}
								/>
								<Draggable
									x={midX + normalX * bow}
									y={midY + normalY * bow}
									radius={props.screen(edgeChosen ? 5 : 4)}
									fill={edgeChosen ? "var(--color-foreground)" : "var(--color-background)"}
									stroke="var(--color-foreground)"
									strokeWidth={props.screen(1.2)}
									onDrag={(x, y, done) =>
										props.onSetBow(
											vertex.id,
											Number(((x - midX) * normalX + (y - midY) * normalY).toFixed(2)),
											done,
										)
									}
								/>
							</>
						) : null}

						<Draggable
							x={vertex.x}
							y={vertex.y}
							radius={props.screen(active ? 6 : 4.5)}
							square
							fill={active ? "var(--color-foreground)" : "var(--color-background)"}
							stroke="var(--color-foreground)"
							strokeWidth={props.screen(1.2)}
							onSelect={() => props.onSelect(vertex.id)}
							onMenu={(clientX, clientY) => props.onMenu(vertex.id, clientX, clientY)}
							onDrag={(x, y, done) => props.onMove(vertex.id, x, y, done)}
						/>
					</g>
				)
			})}
		</g>
	)
}
