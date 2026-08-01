import { useGesture } from "@use-gesture/react"
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react"

const MIN_ZOOM = 0.2
const MAX_ZOOM = 8

interface Size {
	readonly width: number
	readonly height: number
}

export interface CanvasView {
	readonly viewBox: string
	readonly zoom: number
	/**
	 * Converts a size in screen pixels to the centimetres the viewBox needs to
	 * draw it at that size. Anything that is interface rather than cloth — a
	 * handle, a hairline, a caption — is sized through here so it holds its size
	 * as the drawing is zoomed.
	 */
	readonly screen: (pixels: number) => number
	readonly fit: () => void
	readonly zoomBy: (factor: number) => void
}

function clampZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

function useElementSize(ref: RefObject<HTMLElement | null>): Size {
	const [size, setSize] = useState<Size>({ width: 1, height: 1 })

	useEffect(() => {
		const element = ref.current

		if (element === null) return

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0]

			if (entry === undefined) return

			setSize({
				width: Math.max(1, entry.contentRect.width),
				height: Math.max(1, entry.contentRect.height),
			})
		})

		observer.observe(element)

		return () => observer.disconnect()
	}, [ref])

	return size
}

/**
 * Pan and zoom over a viewBox measured in centimetres.
 *
 * Wheel events pan and pinch events zoom, which is what a macOS trackpad
 * produces natively: two-finger scroll arrives as a plain wheel event, and a
 * pinch arrives as ctrl+wheel, which use-gesture routes to the pinch handler.
 */
export function useCanvasView(
	ref: RefObject<HTMLElement | null>,
	content: { width: number; height: number; margin: number },
): CanvasView {
	const size = useElementSize(ref)
	const [zoom, setZoom] = useState(1)
	const [pan, setPan] = useState({ x: 0, y: 0 })
	const panAllowed = useRef(false)

	/**
	 * Whether a drag pans is decided here rather than inside the gesture handler.
	 * The gesture library binds to the container, so its listener runs before any
	 * child can intervene, and only a capture-phase listener sees the true target
	 * early enough to tell "grabbed the grid" from "grabbed a panel".
	 */
	useEffect(() => {
		const element = ref.current

		if (element === null) return

		const onPointerDown = (event: PointerEvent) => {
			panAllowed.current =
				event.target instanceof Element && event.target.hasAttribute("data-canvas-background")
		}

		element.addEventListener("pointerdown", onPointerDown, true)

		return () => element.removeEventListener("pointerdown", onPointerDown, true)
	}, [ref])

	const baseWidth = content.width + content.margin * 2
	const baseHeight = content.height + content.margin * 2

	const viewWidth = baseWidth / zoom
	const viewHeight = (viewWidth * size.height) / size.width
	const centimetresPerPixel = viewWidth / size.width

	const originX = -content.margin + (baseWidth - viewWidth) / 2 + pan.x
	const originY = -content.margin + (baseHeight - viewHeight) / 2 + pan.y

	const zoomAt = useCallback(
		(nextZoom: number, pointerX: number, pointerY: number) => {
			const element = ref.current

			if (element === null) return

			const rect = element.getBoundingClientRect()
			const offsetX = pointerX - rect.left
			const offsetY = pointerY - rect.top

			const anchorX = originX + offsetX * centimetresPerPixel
			const anchorY = originY + offsetY * centimetresPerPixel

			const clamped = clampZoom(nextZoom)
			const nextViewWidth = baseWidth / clamped
			const nextViewHeight = (nextViewWidth * size.height) / size.width
			const nextScale = nextViewWidth / size.width

			setZoom(clamped)
			setPan({
				x: anchorX - offsetX * nextScale + content.margin - (baseWidth - nextViewWidth) / 2,
				y: anchorY - offsetY * nextScale + content.margin - (baseHeight - nextViewHeight) / 2,
			})
		},
		[
			baseHeight,
			baseWidth,
			centimetresPerPixel,
			content.margin,
			originX,
			originY,
			ref,
			size.height,
			size.width,
		],
	)

	useGesture(
		{
			onDrag: (gesture) => {
				if (!panAllowed.current) return

				setPan((current) => ({
					x: current.x - gesture.delta[0] * centimetresPerPixel,
					y: current.y - gesture.delta[1] * centimetresPerPixel,
				}))
			},
			onWheel: (gesture) => {
				if (gesture.ctrlKey) return

				// A horizontal trackpad swipe is browser back/forward on macOS unless the wheel event is cancelled.
				gesture.event.preventDefault()

				setPan((current) => ({
					x: current.x + gesture.delta[0] * centimetresPerPixel,
					y: current.y + gesture.delta[1] * centimetresPerPixel,
				}))
			},
			onPinch: (gesture) => {
				zoomAt(gesture.offset[0], gesture.origin[0], gesture.origin[1])
			},
		},
		{
			target: ref,
			eventOptions: { passive: false },
			drag: { filterTaps: true, pointer: { keys: false } },
			pinch: { scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM }, from: () => [zoom, 0] },
		},
	)

	const fit = useCallback(() => {
		setZoom(1)
		setPan({ x: 0, y: 0 })
	}, [])

	const zoomBy = useCallback(
		(factor: number) => {
			const element = ref.current

			if (element === null) return

			const rect = element.getBoundingClientRect()

			zoomAt(zoom * factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
		},
		[ref, zoom, zoomAt],
	)

	return useMemo(
		() => ({
			viewBox: `${originX} ${originY} ${viewWidth} ${viewHeight}`,
			zoom,
			screen: (pixels: number) => pixels * centimetresPerPixel,
			fit,
			zoomBy,
		}),
		[centimetresPerPixel, fit, originX, originY, viewHeight, viewWidth, zoom, zoomBy],
	)
}
