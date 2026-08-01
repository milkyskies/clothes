import type { Draft, Stitch, StitchKind } from "@/lib/drafting/draft"
import { stitchLine } from "@/lib/drafting/stitch"

/** How each kind of stitching reads on the cloth, as a dash pattern in centimetres. */
const DASHES: Record<StitchKind, string> = {
	finish: "0.25 0.2",
	topstitch: "0.5 0.3",
	bartack: "0",
	hand: "0.15 0.45",
}

function rowsOf(draft: Draft, stitch: Stitch) {
	const count = Math.max(1, Math.round(stitch.rows))

	return Array.from({ length: count }, (_, row) => ({
		inset: stitch.offset + row * 0.35,
		points: stitchLine(draft, stitch, row),
	})).filter((row) => row.points.length > 0)
}

interface StitchLayerProps {
	draft: Draft
	screen: (pixels: number) => number
	selectedStitchId: string | undefined
}

export function StitchLayer(props: StitchLayerProps) {
	return (
		<g pointerEvents="none">
			{props.draft.stitches.flatMap((stitch) =>
				rowsOf(props.draft, stitch).map((row) => {
					const chosen = props.selectedStitchId === stitch.id

					return (
						<polyline
							key={`${stitch.id}-${row.inset}`}
							points={row.points.map((entry) => `${entry.x},${entry.y}`).join(" ")}
							fill="none"
							stroke="var(--color-fold)"
							strokeWidth={props.screen(chosen ? 2 : 1.3)}
							strokeDasharray={DASHES[stitch.kind]}
							strokeLinecap="round"
							opacity={chosen ? 1 : 0.8}
						/>
					)
				}),
			)}
		</g>
	)
}
