import { useState } from "react"
import { edgeGaps, seamRunsOn } from "@/lib/drafting/assembly"
import { type Draft, type Panel, panelPath, vertexPoint } from "@/lib/drafting/draft"
import { flatten, segmentLength } from "@/lib/drafting/geometry/measure"
import { type Point, type Segment, segmentStart } from "@/lib/drafting/geometry/path"
import { pathToSvg } from "@/lib/drafting/geometry/svg"
import type { Selection } from "../use-editor"
import { useSvgPointDrag } from "../use-svg-point-drag"

interface PanelShapeProps {
	draft: Draft
	panel: Panel
	screen: (pixels: number) => number
	selection: Selection
	interactive: boolean
	/** Vertex id of the edge waiting for a partner to sew it to, if it is on this piece. */
	pending: string | undefined
	onSelectPanel: () => void
	onSelectEdge: (vertexId: string) => void
	onMovePanel: (x: number, y: number, done: boolean) => void
	onMenu: (kind: "panel" | "edge", id: string, clientX: number, clientY: number) => void
}

/**
 * Points along a single edge, including its end.
 *
 * `flatten` omits each segment's final point because the next segment supplies
 * it, which for one segment in isolation leaves a straight edge with a single
 * point and therefore no length, no midpoint and nothing to click.
 */
function edgePoints(from: Point, segment: Segment): Point[] {
	const sampled = flatten({ start: from, segments: [segment] }).map((entry) => entry.point)

	return [...sampled, segment.to]
}

/**
 * The point half way along a sampled edge, measured by distance rather than by
 * sample index: a straight edge has only two samples, and a curve's samples are
 * spaced by parameter rather than evenly, so neither midpoint is the middle one.
 */
function midpointOf(samples: readonly Point[]): Point {
	const first = samples[0]
	const last = samples[samples.length - 1]

	if (first === undefined || last === undefined) return { x: 0, y: 0 }

	let total = 0

	for (let index = 1; index < samples.length; index += 1) {
		const previous = samples[index - 1]
		const current = samples[index]

		if (previous === undefined || current === undefined) continue

		total += Math.hypot(current.x - previous.x, current.y - previous.y)
	}

	let travelled = 0

	for (let index = 1; index < samples.length; index += 1) {
		const previous = samples[index - 1]
		const current = samples[index]

		if (previous === undefined || current === undefined) continue

		const step = Math.hypot(current.x - previous.x, current.y - previous.y)

		if (travelled + step >= total / 2) {
			const along = step === 0 ? 0 : (total / 2 - travelled) / step

			return {
				x: previous.x + (current.x - previous.x) * along,
				y: previous.y + (current.y - previous.y) * along,
			}
		}

		travelled += step
	}

	return { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }
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
 * Draws the outline the piece is cut on, and the runs of each edge that no seam
 * covers. Those gaps are what a sewer reads as 脇あき or 身八つ口; nothing in
 * here knows those words.
 */
export function PanelShape(props: PanelShapeProps) {
	const move = useSvgPointDrag({
		x: props.panel.x,
		y: props.panel.y,
		onChange: props.onMovePanel,
	})

	const [hovered, setHovered] = useState<string | undefined>(undefined)

	const path = panelPath(props.panel)
	const selected = props.selection.panelId === props.panel.id
	const active = hovered ?? props.selection.edgeVertexId

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

	const edges = props.panel.vertices.flatMap((vertex, index) => {
		const segment = path.segments[index]

		if (segment === undefined) return []

		const from = segmentStart(path, index)
		const samples = edgePoints(from, segment)
		const middle = midpointOf(samples)

		const spanX = segment.to.x - from.x
		const spanY = segment.to.y - from.y
		const span = Math.hypot(spanX, spanY) || 1

		const normalX = -spanY / span
		const normalY = spanX / span
		const outward = normalX * (middle.x - centre.x) + normalY * (middle.y - centre.y) >= 0 ? 1 : -1
		const awayX = normalX * outward
		const awayY = normalY * outward

		const standoff = props.screen(14)

		return [
			{
				vertexId: vertex.id,
				points: samples.map((entry) => `${entry.x},${entry.y}`).join(" "),
				labelX: middle.x + awayX * standoff,
				labelY: middle.y + awayY * standoff,
				length: segmentLength(from, segment),
			},
		]
	})

	// A gap is only worth marking where sewing stops short. An edge no seam touches
	// is not an opening, it is a piece that has not been assembled yet.
	const gapSegments = props.panel.vertices.flatMap((vertex) => {
		const edge = { panelId: props.panel.id, vertexId: vertex.id }

		if (seamRunsOn(props.draft, edge).length === 0) return []

		const spans = edgeGaps(props.draft, edge)

		if (spans.length === 0) return []

		const index = props.panel.vertices.indexOf(vertex)
		const segment = path.segments[index]

		if (segment === undefined) return []

		const samples = edgePoints(vertexPoint(vertex), segment)

		return spans.map((span) => {
			const total = samples.length - 1
			const length = Math.hypot(segment.to.x - vertex.x, segment.to.y - vertex.y)
			const first = Math.max(0, Math.round((span.from / Math.max(length, 0.001)) * total))
			const last = Math.min(total, Math.round((span.to / Math.max(length, 0.001)) * total))
			const slice = samples.slice(first, last + 1)

			return {
				key: `${vertex.id}-${span.from}`,
				points: slice.map((entry) => `${entry.x},${entry.y}`).join(" "),
			}
		})
	})

	return (
		<g transform={`translate(${props.panel.x} ${props.panel.y})`}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard reach is provided by the panel list in the inspector. */}
			<path
				d={pathToSvg(path)}
				fill={selected ? "var(--color-accent)" : "var(--color-muted)"}
				fillOpacity={selected ? 0.45 : 0.2}
				stroke="var(--color-foreground)"
				strokeWidth={props.screen(selected ? 2 : 1.4)}
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
				onContextMenu={(event) => {
					event.preventDefault()
					props.onSelectPanel()
					props.onMenu("panel", props.panel.id, event.clientX, event.clientY)
				}}
			/>

			{gapSegments.map((gap) => (
				<polyline
					key={gap.key}
					points={gap.points}
					fill="none"
					stroke="var(--color-background)"
					strokeWidth={props.screen(3.5)}
					pointerEvents="none"
				/>
			))}

			{gapSegments.map((gap) => (
				<polyline
					key={`${gap.key}-mark`}
					points={gap.points}
					fill="none"
					stroke="var(--color-fold)"
					strokeWidth={props.screen(2.2)}
					strokeLinecap="round"
					strokeDasharray={`${props.screen(0.8)} ${props.screen(6)}`}
					pointerEvents="none"
				/>
			))}

			{props.interactive
				? edges.map((edge) => (
						// biome-ignore lint/a11y/noStaticElementInteractions: keyboard reach is provided by the inspector edge list.
						<polyline
							key={`${edge.vertexId}-hit`}
							points={edge.points}
							fill="none"
							// Hit testing needs a genuinely painted stroke, so this is drawn rather than made transparent.
							stroke="var(--color-foreground)"
							strokeOpacity={0.001}
							strokeWidth={props.screen(15)}
							strokeLinecap="round"
							pointerEvents="stroke"
							className="cursor-pointer"
							onPointerEnter={() => setHovered(edge.vertexId)}
							onPointerLeave={() => setHovered(undefined)}
							onPointerDown={(event) => {
								event.stopPropagation()
								props.onSelectEdge(edge.vertexId)
							}}
							onContextMenu={(event) => {
								event.preventDefault()
								event.stopPropagation()
								props.onSelectEdge(edge.vertexId)
								props.onMenu("edge", edge.vertexId, event.clientX, event.clientY)
							}}
						/>
					))
				: null}

			{props.interactive
				? edges
						.filter((edge) => edge.vertexId === active || edge.vertexId === props.pending)
						.map((edge) => (
							<polyline
								key={`${edge.vertexId}-active`}
								points={edge.points}
								fill="none"
								stroke={
									edge.vertexId === props.pending ? "var(--color-seam)" : "var(--color-foreground)"
								}
								strokeWidth={props.screen(4)}
								strokeLinecap="round"
								opacity={0.35}
								pointerEvents="none"
							/>
						))
				: null}

			{edges
				.filter((edge) => edge.vertexId === active)
				.map((edge) => (
					<text
						key={`${edge.vertexId}-dim`}
						x={edge.labelX}
						y={edge.labelY}
						textAnchor="middle"
						dominantBaseline="central"
						fontSize={props.screen(13)}
						fill="var(--color-foreground)"
						paintOrder="stroke"
						stroke="var(--color-background)"
						strokeWidth={props.screen(6)}
						strokeLinejoin="round"
						pointerEvents="none"
					>
						{`${edge.length.toFixed(1)} cm`}
					</text>
				))}

			{mirrored === undefined ? null : (
				<path
					d={mirrored}
					fill="var(--color-muted)"
					fillOpacity={0.12}
					stroke="var(--color-fold)"
					strokeWidth={props.screen(1)}
					strokeDasharray={`${props.screen(1.5)} ${props.screen(3.5)}`}
					pointerEvents="none"
				/>
			)}

			<text
				x={centre.x}
				y={centre.y}
				textAnchor="middle"
				dominantBaseline="central"
				fontSize={props.screen(13)}
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
