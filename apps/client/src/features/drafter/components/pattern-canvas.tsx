import { Minus, Plus } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { Button } from "@/features/shared/ui/button"
import { boundingBox, offsetPath } from "@/lib/drafting/geometry/offset"
import { pathToSvg, verticesToSvg } from "@/lib/drafting/geometry/svg"
import type { Panel } from "@/lib/drafting/model"
import { useCanvasView } from "../use-canvas-view"
import type { DraftState } from "../use-draft-state"
import { Dimension } from "./dimension"
import { DimensionEditor, type EditorTarget } from "./dimension-editor"

const PANEL_GAP = 14
const MARGIN = 18

interface PlacedPanel {
	readonly panel: Panel
	readonly x: number
	readonly y: number
	readonly width: number
	readonly height: number
}

function place(panels: readonly Panel[]): { placed: PlacedPanel[]; width: number; height: number } {
	const placed: PlacedPanel[] = []
	let cursor = 0
	let tallest = 0

	for (const panel of panels) {
		const box = boundingBox(offsetPath(panel.outline, panel.allowance))

		placed.push({ panel, x: cursor - box.minX, y: -box.minY, width: box.width, height: box.height })

		cursor += box.width + PANEL_GAP
		tallest = Math.max(tallest, box.height)
	}

	return { placed, width: Math.max(cursor - PANEL_GAP, 1), height: tallest }
}

interface GridProps {
	width: number
	height: number
	unit: number
}

function Grid(props: GridProps) {
	return (
		<>
			<defs>
				<pattern id="grid-minor" width={1} height={1} patternUnits="userSpaceOnUse">
					<path
						d="M 1 0 L 0 0 0 1"
						fill="none"
						stroke="var(--color-grid)"
						strokeWidth={props.unit * 0.05}
					/>
				</pattern>
				<pattern id="grid-major" width={10} height={10} patternUnits="userSpaceOnUse">
					<rect width={10} height={10} fill="url(#grid-minor)" />
					<path
						d="M 10 0 L 0 0 0 10"
						fill="none"
						stroke="var(--color-grid-strong)"
						strokeWidth={props.unit * 0.09}
					/>
				</pattern>
			</defs>

			<rect
				x={-MARGIN * 4}
				y={-MARGIN * 4}
				width={props.width + MARGIN * 8}
				height={props.height + MARGIN * 8}
				fill="url(#grid-major)"
			/>
		</>
	)
}

interface PanelFigureProps {
	placed: PlacedPanel
	unit: number
}

function PanelFigure(props: PanelFigureProps) {
	const cut = offsetPath(props.placed.panel.outline, props.placed.panel.allowance)

	return (
		<g transform={`translate(${props.placed.x} ${props.placed.y})`}>
			<path
				d={verticesToSvg(cut)}
				fill="var(--color-background)"
				fillOpacity={0.85}
				stroke="var(--color-cut)"
				strokeWidth={props.unit * 0.16}
				strokeDasharray={`${props.unit * 1.1} ${props.unit * 0.7}`}
			/>

			<path
				d={pathToSvg(props.placed.panel.outline)}
				fill="var(--color-muted)"
				fillOpacity={0.5}
				stroke="var(--color-foreground)"
				strokeWidth={props.unit * 0.22}
				strokeLinejoin="round"
			/>

			{props.placed.panel.onFold ? (
				<line
					x1={0}
					y1={0}
					x2={0}
					y2={props.placed.height - props.unit * 3}
					stroke="var(--color-fold)"
					strokeWidth={props.unit * 0.3}
					strokeDasharray={`${props.unit * 2} ${props.unit}`}
				/>
			) : null}

			<text
				x={props.placed.width / 2}
				y={props.placed.height + props.unit * 3.4}
				textAnchor="middle"
				fontSize={props.unit * 2.6}
				fill="var(--color-foreground)"
			>
				{props.placed.panel.name}
				<tspan fill="var(--color-muted-foreground)">{` ${props.placed.panel.quantity}枚`}</tspan>
				{props.placed.panel.onFold ? <tspan fill="var(--color-fold)">{" わ"}</tspan> : null}
			</text>
		</g>
	)
}

interface PatternCanvasProps {
	state: DraftState
}

export function PatternCanvas(props: PatternCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [editor, setEditor] = useState<EditorTarget | undefined>(undefined)

	const { placed, width, height } = useMemo(
		() => place(props.state.result.panels),
		[props.state.result.panels],
	)

	const unit = (width + MARGIN * 2) / 240

	const view = useCanvasView(containerRef, { width, height, margin: MARGIN })

	const shared = { unit, editingLabel: editor?.label, onEdit: setEditor }

	const front = placed.find((entry) => entry.panel.id === "front")
	const back = placed.find((entry) => entry.panel.id === "back")
	const sleeve = placed.find((entry) => entry.panel.id === "sleeve")
	const collar = placed.find((entry) => entry.panel.id === "collar")

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full cursor-grab touch-none overflow-hidden overscroll-none active:cursor-grabbing"
		>
			<svg
				viewBox={view.viewBox}
				preserveAspectRatio="xMidYMid slice"
				className="h-full w-full"
				role="img"
				aria-label="製図"
			>
				<Grid width={width} height={height} unit={unit} />

				{placed.map((entry) => (
					<PanelFigure key={entry.panel.id} placed={entry} unit={unit} />
				))}

				<g data-handle>
					{back === undefined ? null : (
						<Dimension
							label="身丈"
							value={props.state.measurements.bodyLength}
							min={50}
							max={95}
							step={1}
							axis="y"
							anchorX={back.x - MARGIN * 0.5}
							anchorY={back.y}
							extent={back.height}
							{...shared}
							onChange={(next) => props.state.update({ bodyLength: next })}
						/>
					)}

					{front === undefined ? null : (
						<>
							<Dimension
								label="剣先"
								value={props.state.design.kenzakiDepth}
								min={10}
								max={30}
								step={1}
								axis="y"
								anchorX={front.x}
								anchorY={front.y}
								extent={props.state.design.kenzakiDepth}
								{...shared}
								onChange={(next) => props.state.update({ kenzakiDepth: next })}
							/>

							<Dimension
								label="ゆとり"
								value={props.state.design.ease}
								min={0}
								max={30}
								step={1}
								axis="x"
								anchorX={front.x}
								anchorY={front.y + front.height + unit * 7}
								extent={front.width}
								{...shared}
								onChange={(next) => props.state.update({ ease: next })}
							/>

							<Dimension
								label="脇あき"
								value={props.state.design.sideVent}
								min={0}
								max={30}
								step={1}
								axis="y"
								invert
								anchorX={front.x + front.width + MARGIN * 0.4}
								anchorY={front.y + front.height}
								extent={-props.state.design.sideVent}
								{...shared}
								onChange={(next) => props.state.update({ sideVent: next })}
							/>

							<Dimension
								label="袖付けあき"
								value={props.state.design.sleeveOpening}
								min={0}
								max={12}
								step={1}
								axis="y"
								anchorX={front.x + front.width + MARGIN * 0.9}
								anchorY={front.y + props.state.measurements.chest / 4}
								extent={-props.state.design.sleeveOpening}
								{...shared}
								invert
								onChange={(next) => props.state.update({ sleeveOpening: next })}
							/>
						</>
					)}

					{sleeve === undefined ? null : (
						<Dimension
							label="袖丈"
							value={props.state.measurements.sleeveLength}
							min={20}
							max={70}
							step={1}
							axis="y"
							anchorX={sleeve.x + sleeve.width + MARGIN * 0.4}
							anchorY={sleeve.y}
							extent={sleeve.height}
							{...shared}
							onChange={(next) => props.state.update({ sleeveLength: next })}
						/>
					)}

					{collar === undefined ? null : (
						<Dimension
							label="襟幅"
							value={props.state.design.collarWidth}
							min={3}
							max={8}
							step={0.5}
							axis="x"
							anchorX={collar.x}
							anchorY={collar.y - MARGIN * 0.4}
							extent={collar.width}
							{...shared}
							onChange={(next) => props.state.update({ collarWidth: next })}
						/>
					)}
				</g>
			</svg>

			{editor === undefined ? null : (
				<DimensionEditor target={editor} onDismiss={() => setEditor(undefined)} />
			)}

			<div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur">
				<span className="flex items-center gap-1.5">
					<span className="h-px w-4 bg-foreground" />
					{"出来上がり"}
				</span>
				<span className="flex items-center gap-1.5">
					<span className="h-0 w-4 border-t border-dashed border-cut" />
					{"裁ち切り"}
				</span>
				<span className="flex items-center gap-1.5">
					<span className="h-0 w-4 border-t-2 border-dotted border-fold" />
					{"わ"}
				</span>
			</div>

			<div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 backdrop-blur">
				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					onClick={() => view.zoomBy(1 / 1.25)}
					title="縮小"
				>
					<Minus className="size-3.5" />
				</Button>

				<button
					type="button"
					onClick={view.fit}
					title="全体を表示"
					className="tnum min-w-12 rounded px-1 text-xs text-muted-foreground hover:text-foreground"
				>
					{`${Math.round(view.zoom * 100)}%`}
				</button>

				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					onClick={() => view.zoomBy(1.25)}
					title="拡大"
				>
					<Plus className="size-3.5" />
				</Button>
			</div>
		</div>
	)
}
