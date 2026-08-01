import type { Fabric } from "@/lib/drafting/model"
import type { Layout } from "@/lib/drafting/nesting"

interface LayoutViewProps {
	layout: Layout
	fabric: Fabric
	needed: number
}

export function LayoutView(props: LayoutViewProps) {
	const boltLength = Math.max(props.needed, props.layout.usedLength) * 1.02

	return (
		<div className="space-y-3">
			<svg
				viewBox={`0 0 ${props.fabric.width} ${boltLength}`}
				className="w-full max-w-md rounded border border-border bg-muted"
				style={{ aspectRatio: `${props.fabric.width} / ${boltLength}` }}
				role="img"
				aria-label="裁ち方図"
			>
				<rect
					x={0}
					y={0}
					width={props.fabric.width}
					height={boltLength}
					fill="var(--color-muted)"
				/>

				{props.layout.placements.map((placement) => (
					<g key={`${placement.piece.panelId}-${placement.piece.copy}`}>
						<rect
							x={placement.x}
							y={placement.y}
							width={placement.piece.width}
							height={placement.piece.height}
							fill="var(--color-background)"
							stroke="var(--color-foreground)"
							strokeWidth={boltLength / 400}
						/>
						<text
							x={placement.x + placement.piece.width / 2}
							y={placement.y + placement.piece.height / 2}
							textAnchor="middle"
							dominantBaseline="middle"
							fontSize={Math.min(placement.piece.width / 4, boltLength / 32)}
							fill="var(--color-muted-foreground)"
						>
							{placement.piece.name}
						</text>
					</g>
				))}

				<line
					x1={0}
					y1={props.needed}
					x2={props.fabric.width}
					y2={props.needed}
					stroke="var(--color-cut)"
					strokeWidth={boltLength / 300}
					strokeDasharray={`${boltLength / 60} ${boltLength / 90}`}
				/>
			</svg>

			<p className="text-xs text-muted-foreground">
				{`縦が反物の長さ、横が幅${props.fabric.width}cm。地の目は全ての布地で長さ方向に通っています。赤い線が水通しの縮みを見込んだ買う長さです。`}
			</p>
		</div>
	)
}
