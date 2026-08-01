import type { Design, Measurements } from "@/lib/drafting/model"

const FIGURE_HEIGHT = 170
const HEAD_RADIUS = 11

interface SilhouetteViewProps {
	measurements: Measurements
	design: Design
}

/**
 * Outline over a figure scaled to a 170 cm reference height, so the reader can
 * see where the hem and cuff land. Deliberately a drawing rather than a drape
 * simulation: rectangular panels with this much ease hang straight, and a
 * physics render without self-collision reads as a broken app.
 */
export function SilhouetteView(props: SilhouetteViewProps) {
	const shoulderY = HEAD_RADIUS * 2 + 6
	const halfBody = (props.measurements.chest + props.design.ease) / 4
	const halfShoulder = props.measurements.shoulderWidth / 2
	const hemY = shoulderY + props.measurements.bodyLength
	const cuffX = halfShoulder + props.measurements.sleeveLength
	const sleeveHalf = props.measurements.chest / 8

	const viewWidth = cuffX * 2 + 20

	return (
		<div className="space-y-3">
			<svg
				viewBox={`${-viewWidth / 2} 0 ${viewWidth} ${FIGURE_HEIGHT + 10}`}
				className="w-full max-w-sm rounded border border-border bg-background"
				style={{ aspectRatio: `${viewWidth} / ${FIGURE_HEIGHT + 10}` }}
				role="img"
				aria-label="シルエット"
			>
				<circle cx={0} cy={HEAD_RADIUS} r={HEAD_RADIUS} fill="var(--color-muted)" />
				<rect
					x={-props.measurements.chest / 6}
					y={shoulderY}
					width={props.measurements.chest / 3}
					height={FIGURE_HEIGHT - shoulderY - 4}
					rx={6}
					fill="var(--color-muted)"
				/>

				<path
					d={[
						`M ${-halfShoulder} ${shoulderY}`,
						`L ${-cuffX} ${shoulderY}`,
						`L ${-cuffX} ${shoulderY + sleeveHalf}`,
						`L ${-halfBody} ${shoulderY + sleeveHalf}`,
						`L ${-halfBody} ${hemY}`,
						`L ${halfBody} ${hemY}`,
						`L ${halfBody} ${shoulderY + sleeveHalf}`,
						`L ${cuffX} ${shoulderY + sleeveHalf}`,
						`L ${cuffX} ${shoulderY}`,
						`L ${halfShoulder} ${shoulderY}`,
						"Z",
					].join(" ")}
					fill="var(--color-foreground)"
					fillOpacity={0.14}
					stroke="var(--color-foreground)"
					strokeWidth={0.9}
					strokeLinejoin="round"
				/>

				<line
					x1={-halfBody}
					y1={shoulderY + props.design.kenzakiDepth}
					x2={0}
					y2={shoulderY + props.design.kenzakiDepth}
					stroke="var(--color-muted-foreground)"
					strokeWidth={0.7}
					strokeDasharray="2 1.5"
				/>
			</svg>

			<dl className="grid grid-cols-3 gap-3 text-xs">
				<div>
					<dt className="text-muted-foreground">{"胸囲ゆとり"}</dt>
					<dd className="tabular-nums font-medium">{`+${props.design.ease} cm`}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">{"出来上がり胸囲"}</dt>
					<dd className="tabular-nums font-medium">
						{`${props.measurements.chest + props.design.ease} cm`}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">{"袖口の位置"}</dt>
					<dd className="tabular-nums font-medium">{`肩先から ${props.measurements.sleeveLength} cm`}</dd>
				</div>
			</dl>
		</div>
	)
}
