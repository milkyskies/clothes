import type { Panel } from "@/lib/drafting/document"
import type { Selection } from "../use-editor"
import { useSvgPointDrag } from "../use-svg-point-drag"

interface VertexHandlesProps {
	panel: Panel
	unit: number
	selection: Selection
	onSelect: (vertexId: string) => void
	onMove: (vertexId: string, x: number, y: number, done: boolean) => void
	onMoveHandle: (
		vertexId: string,
		side: "out" | "nextIn",
		x: number,
		y: number,
		done: boolean,
	) => void
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

export function VertexHandles(props: VertexHandlesProps) {
	return (
		<g transform={`translate(${props.panel.x} ${props.panel.y})`}>
			{props.panel.vertices.map((vertex, index) => {
				const next = props.panel.vertices[(index + 1) % props.panel.vertices.length]
				const active = props.selection.vertexId === vertex.id

				return (
					<g key={vertex.id}>
						{active && vertex.out !== undefined ? (
							<>
								<line
									x1={vertex.x}
									y1={vertex.y}
									x2={vertex.x + vertex.out.x}
									y2={vertex.y + vertex.out.y}
									stroke="var(--color-ring)"
									strokeWidth={props.unit * 0.1}
								/>
								<Draggable
									x={vertex.x + vertex.out.x}
									y={vertex.y + vertex.out.y}
									radius={props.unit * 0.7}
									fill="var(--color-background)"
									stroke="var(--color-ring)"
									strokeWidth={props.unit * 0.14}
									onDrag={(x, y, done) =>
										props.onMoveHandle(vertex.id, "out", x - vertex.x, y - vertex.y, done)
									}
								/>
							</>
						) : null}

						{active && vertex.nextIn !== undefined && next !== undefined ? (
							<>
								<line
									x1={next.x}
									y1={next.y}
									x2={next.x + vertex.nextIn.x}
									y2={next.y + vertex.nextIn.y}
									stroke="var(--color-ring)"
									strokeWidth={props.unit * 0.1}
								/>
								<Draggable
									x={next.x + vertex.nextIn.x}
									y={next.y + vertex.nextIn.y}
									radius={props.unit * 0.7}
									fill="var(--color-background)"
									stroke="var(--color-ring)"
									strokeWidth={props.unit * 0.14}
									onDrag={(x, y, done) =>
										props.onMoveHandle(vertex.id, "nextIn", x - next.x, y - next.y, done)
									}
								/>
							</>
						) : null}

						<Draggable
							x={vertex.x}
							y={vertex.y}
							radius={props.unit * (active ? 1.05 : 0.8)}
							square
							fill={active ? "var(--color-foreground)" : "var(--color-background)"}
							stroke="var(--color-foreground)"
							strokeWidth={props.unit * 0.16}
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
