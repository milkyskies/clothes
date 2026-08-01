import { type DragAxis, useSvgDrag } from "../use-svg-drag"
import type { EditorTarget } from "./dimension-editor"

export interface DimensionProps {
	label: string
	value: number
	min: number
	max: number
	step: number
	axis: DragAxis
	invert?: boolean
	anchorX: number
	anchorY: number
	extent: number
	unit: number
	editingLabel: string | undefined
	onChange: (next: number) => void
	onEdit: (target: EditorTarget) => void
}

function projectToClient(
	element: SVGGraphicsElement,
	x: number,
	y: number,
): { clientX: number; clientY: number } | undefined {
	const owner = element.ownerSVGElement

	if (owner === null) return undefined

	const matrix = owner.getScreenCTM()

	if (matrix === null) return undefined

	const origin = owner.createSVGPoint()

	origin.x = x
	origin.y = y

	const projected = origin.matrixTransform(matrix)

	return { clientX: projected.x, clientY: projected.y }
}

/**
 * A measurement that can be grabbed or typed. The handle and the figure edit the
 * same value, because a sewer arrives at 4 cm both ways: by eye on the drawing,
 * and by already knowing the number.
 */
export function Dimension(props: DimensionProps) {
	const drag = useSvgDrag({
		axis: props.axis,
		value: props.value,
		min: props.min,
		max: props.max,
		step: props.step,
		invert: props.invert,
		onChange: props.onChange,
	})

	const vertical = props.axis === "y"
	const endX = vertical ? props.anchorX : props.anchorX + props.extent
	const endY = vertical ? props.anchorY + props.extent : props.anchorY

	const midX = (props.anchorX + endX) / 2
	const midY = (props.anchorY + endY) / 2

	const editing = props.editingLabel === props.label
	const fontSize = props.unit * 2.4
	const active = drag.dragging || editing
	const stroke = active ? "var(--color-foreground)" : "var(--color-muted-foreground)"
	const tick = props.unit * 0.55

	// CJK labels occupy a full em per character, unlike the half-width a Latin estimate would give.
	const hitWidth = fontSize * (props.label.length + String(props.value).length * 0.62 + 0.9)

	function openEditor(event: { currentTarget: SVGGraphicsElement }) {
		const point = projectToClient(event.currentTarget, midX, midY)

		if (point === undefined) return

		props.onEdit({
			label: props.label,
			value: props.value,
			min: props.min,
			max: props.max,
			step: props.step,
			clientX: point.clientX,
			clientY: point.clientY,
			onCommit: props.onChange,
		})
	}

	return (
		<g>
			<line
				x1={props.anchorX}
				y1={props.anchorY}
				x2={endX}
				y2={endY}
				stroke={stroke}
				strokeWidth={props.unit * 0.13}
			/>

			<line
				x1={vertical ? props.anchorX - tick : props.anchorX}
				y1={vertical ? props.anchorY : props.anchorY - tick}
				x2={vertical ? props.anchorX + tick : props.anchorX}
				y2={vertical ? props.anchorY : props.anchorY + tick}
				stroke={stroke}
				strokeWidth={props.unit * 0.13}
			/>

			{editing ? null : (
				// biome-ignore lint/a11y/useSemanticElements: SVG has no button element, so role plus key handling is the accessible equivalent.
				<g
					role="button"
					tabIndex={0}
					aria-label={`${props.label} ${props.value}センチ。押すと入力できます`}
					className="group cursor-pointer outline-none"
					onClick={openEditor}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") openEditor(event)
					}}
				>
					<rect
						x={midX - hitWidth / 2}
						y={midY - fontSize}
						width={hitWidth}
						height={fontSize * 2}
						fill="transparent"
					/>

					<rect
						x={midX - hitWidth / 2}
						y={midY - fontSize}
						width={hitWidth}
						height={fontSize * 2}
						rx={fontSize * 0.2}
						fill="none"
						stroke="var(--color-foreground)"
						strokeWidth={props.unit * 0.16}
						className="opacity-0 group-focus-visible:opacity-100"
					/>

					<text
						x={midX}
						y={midY}
						textAnchor="middle"
						dominantBaseline="central"
						fontSize={fontSize}
						paintOrder="stroke"
						stroke="var(--color-background)"
						strokeWidth={fontSize * 0.42}
						strokeLinejoin="round"
						fill="var(--color-foreground)"
					>
						<tspan fill="var(--color-muted-foreground)">{props.label}</tspan>
						<tspan dx={fontSize * 0.28} fontWeight={600}>
							{props.value}
						</tspan>
					</text>
				</g>
			)}

			<circle
				cx={endX}
				cy={endY}
				r={props.unit * (drag.dragging ? 1.35 : 1)}
				fill={drag.dragging ? "var(--color-foreground)" : "var(--color-background)"}
				stroke="var(--color-foreground)"
				strokeWidth={props.unit * 0.18}
				className="cursor-grab active:cursor-grabbing"
				style={{ touchAction: "none" }}
				onPointerDown={drag.onPointerDown}
			/>
		</g>
	)
}
