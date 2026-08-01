import { type PointerEvent as ReactPointerEvent, useCallback, useState } from "react"

interface PointDragOptions {
	readonly x: number
	readonly y: number
	readonly onChange: (x: number, y: number, done: boolean) => void
}

export interface PointDragBinding {
	readonly dragging: boolean
	readonly onPointerDown: (event: ReactPointerEvent<SVGElement>) => void
}

/**
 * Drags a point in both axes, converting pointer travel to centimetres through
 * the ratio between the SVG's viewBox and its rendered size.
 */
export function useSvgPointDrag(options: PointDragOptions): PointDragBinding {
	const [dragging, setDragging] = useState(false)

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<SVGElement>) => {
			const owner = event.currentTarget.ownerSVGElement

			if (owner === null) return

			const rect = owner.getBoundingClientRect()
			const box = owner.viewBox.baseVal

			if (rect.width === 0 || rect.height === 0) return

			const scaleX = box.width / rect.width
			const scaleY = box.height / rect.height
			const startX = event.clientX
			const startY = event.clientY

			const move = (native: PointerEvent) => {
				options.onChange(
					options.x + (native.clientX - startX) * scaleX,
					options.y + (native.clientY - startY) * scaleY,
					false,
				)
			}

			const finish = (native: PointerEvent) => {
				options.onChange(
					options.x + (native.clientX - startX) * scaleX,
					options.y + (native.clientY - startY) * scaleY,
					true,
				)
				setDragging(false)
				window.removeEventListener("pointermove", move)
				window.removeEventListener("pointerup", finish)
				window.removeEventListener("pointercancel", finish)
			}

			window.addEventListener("pointermove", move)
			window.addEventListener("pointerup", finish)
			window.addEventListener("pointercancel", finish)

			setDragging(true)
			event.stopPropagation()
			event.preventDefault()
		},
		[options],
	)

	return { dragging, onPointerDown }
}
