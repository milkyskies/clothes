import { useMemo, useRef } from "react"
import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import { cuttingLayout, pieces } from "@/lib/drafting/cutting"
import { findPanel, panelBounds, panelPath } from "@/lib/drafting/draft"
import { pathToSvg } from "@/lib/drafting/geometry/svg"
import { useCanvasView } from "../use-canvas-view"
import type { Editor } from "../use-editor"

const MARGIN = 10

interface CuttingViewProps {
	editor: Editor
}

/**
 * 裁ち方図 and 寸法表: what to cut, and how much cloth to buy.
 *
 * Both come out of the same drawing the 製図 mode works on, so a piece that
 * changes shape changes what you buy without anything being retyped.
 */
export function CuttingView(props: CuttingViewProps) {
	const containerRef = useRef<HTMLDivElement>(null)

	const { draft } = props.editor
	const layout = useMemo(() => cuttingLayout(draft), [draft])
	const list = useMemo(() => pieces(draft), [draft])

	const view = useCanvasView(containerRef, {
		width: Math.max(layout.width, 1),
		height: Math.max(layout.length, 1),
		margin: MARGIN,
	})

	function changeWidth(value: string) {
		const parsed = Number(value)

		if (!Number.isFinite(parsed) || parsed <= 0) return

		props.editor.apply({ ...draft, fabric: { ...draft.fabric, width: parsed } })
	}

	return (
		<div className="flex h-full min-h-0">
			<div
				ref={containerRef}
				className="relative h-full min-w-0 flex-1 touch-none select-none overflow-hidden overscroll-none bg-background"
			>
				<svg
					viewBox={view.viewBox}
					preserveAspectRatio="xMidYMid meet"
					role="img"
					aria-label="裁ち方図"
					className="h-full w-full cursor-grab"
				>
					<rect
						x={-3000}
						y={-3000}
						width={6000}
						height={6000}
						fill="transparent"
						data-canvas-background
					/>

					<rect
						x={0}
						y={0}
						width={layout.width}
						height={layout.length}
						fill="var(--color-muted)"
						fillOpacity={0.5}
						stroke="var(--color-border)"
						strokeWidth={view.screen(1)}
					/>

					{layout.placements.map((placement) => {
						const panel = findPanel(draft, placement.piece.panelId)

						if (panel === undefined) return null

						const bounds = panelBounds(panel)
						const x = placement.across - bounds.minX
						const y = placement.along - bounds.minY

						return (
							<g
								key={`${placement.piece.panelId}-${placement.copy}`}
								transform={`translate(${x} ${y})`}
							>
								<path
									d={pathToSvg(panelPath(panel))}
									fill="var(--color-background)"
									stroke="var(--color-cut)"
									strokeWidth={view.screen(1.2)}
									strokeLinejoin="round"
								/>

								<text
									x={bounds.minX + bounds.width / 2}
									y={bounds.minY + bounds.height / 2}
									textAnchor="middle"
									dominantBaseline="central"
									fontSize={view.screen(11)}
									fill="var(--color-muted-foreground)"
								>
									{placement.piece.name}
								</text>
							</g>
						)
					})}

					<text
						x={layout.width / 2}
						y={-view.screen(8)}
						textAnchor="middle"
						fontSize={view.screen(11)}
						fill="var(--color-muted-foreground)"
					>
						{`幅 ${layout.width}cm`}
					</text>
				</svg>
			</div>

			<aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l">
				<section className="space-y-3 p-4">
					<h2 className="text-xs font-medium text-muted-foreground">{"生地"}</h2>

					<Label className="flex items-center justify-between gap-3 text-sm font-normal">
						<span className="text-muted-foreground">{"幅"}</span>
						<span className="flex items-center gap-1.5">
							<Input
								type="number"
								min={1}
								step={1}
								value={draft.fabric.width}
								onChange={(event) => changeWidth(event.target.value)}
								className="tnum h-7 w-20 text-right text-sm"
							/>
							<span className="text-xs text-muted-foreground">{"cm"}</span>
						</span>
					</Label>

					<div className="rounded-md border p-3">
						<p className="text-xs text-muted-foreground">{"買う長さ"}</p>
						<p className="tnum text-2xl">{`${(layout.length / 100).toFixed(2)} m`}</p>
						<p className="tnum text-xs text-muted-foreground">
							{`${layout.length}cm ・ 使う割合 ${Math.round(layout.efficiency * 100)}%`}
						</p>
					</div>

					{layout.tooWide.length === 0 ? null : (
						<p className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
							{`${layout.tooWide.map((piece) => piece.name).join("・")} が生地の幅より広いので置けません。`}
						</p>
					)}
				</section>

				<section className="space-y-2 border-t p-4">
					<h2 className="text-xs font-medium text-muted-foreground">{"寸法表"}</h2>

					<table className="w-full text-sm">
						<tbody>
							{list.map((piece) => (
								<tr key={piece.panelId} className="border-b last:border-0">
									<td className="py-1.5 pr-2">
										{piece.name}
										{piece.onFold ? <span className="text-muted-foreground">{" わ"}</span> : null}
									</td>
									<td className="tnum py-1.5 text-right text-muted-foreground">
										{`${piece.across} × ${piece.along}`}
									</td>
									<td className="tnum w-10 py-1.5 text-right text-muted-foreground">
										{`${piece.quantity}枚`}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			</aside>
		</div>
	)
}
