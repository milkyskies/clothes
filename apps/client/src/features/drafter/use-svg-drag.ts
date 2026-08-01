import { type PointerEvent as ReactPointerEvent, useCallback, useState } from "react"

export type DragAxis = "x" | "y"

export interface DragOptions {
	readonly axis: DragAxis
	readonly value: number
	readonly min: number
	readonly max: number
	readonly step: number
	readonly invert?: boolean
	readonly onChange: (next: number) => void
}

function quantize(value: number, step: number, min: number, max: number): number {
	const snapped = Math.round(value / step) * step

	return Math.min(max, Math.max(min, Number(snapped.toFixed(4))))
}

export interface DragBinding {
	readonly dragging: boolean
	readonly onPointerDown: (event: ReactPointerEvent<SVGElement>) => void
}

/**
 * Converts pointer travel into centimetres using the ratio between the SVG's
 * viewBox and its rendered size, so a handle tracks the cursor at any zoom.
 */
export function useSvgDrag(options: DragOptions): DragBinding {
	const [dragging, setDragging] = useState(false)

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<SVGElement>) => {
			const owner = event.currentTarget.ownerSVGElement

			if (owner === null) return

			const rect = owner.getBoundingClientRect()
			const box = owner.viewBox.baseVal
			const rendered = options.axis === "x" ? rect.width : rect.height
			const span = options.axis === "x" ? box.width : box.height

			if (rendered === 0) return

			const scale = span / rendered
			const startPointer = options.axis === "x" ? event.clientX : event.clientY
			const startValue = options.value
			const direction = options.invert === true ? -1 : 1

			const move = (native: PointerEvent) => {
				const now = options.axis === "x" ? native.clientX : native.clientY
				const travelled = (now - startPointer) * scale * direction

				options.onChange(quantize(startValue + travelled, options.step, options.min, options.max))
			}

			const finish = () => {
				setDragging(false)
				window.removeEventListener("pointermove", move)
				window.removeEventListener("pointerup", finish)
				window.removeEventListener("pointercancel", finish)
			}

			window.addEventListener("pointermove", move)
			window.addEventListener("pointerup", finish)
			window.addEventListener("pointercancel", finish)

			setDragging(true)
			event.preventDefault()
		},
		[
			options.axis,
			options.invert,
			options.max,
			options.min,
			options.onChange,
			options.step,
			options.value,
		],
	)

	return { dragging, onPointerDown }
}
