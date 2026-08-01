import { Copy, Trash2 } from "lucide-react"
import { Button } from "@/features/shared/ui/button"
import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import { Separator } from "@/features/shared/ui/separator"
import { edgeGaps, edgeLength } from "@/lib/drafting/assembly"
import { findPanel, findVertex, nextVertex } from "@/lib/drafting/document"
import {
	deletePanel,
	deleteVertex,
	duplicatePanel,
	moveVertex,
	setEdgeAllowance,
	toggleEdgeCurve,
	updatePanel,
} from "@/lib/drafting/edit"
import type { Editor } from "../use-editor"

interface FieldProps {
	label: string
	children: React.ReactNode
}

function Field(props: FieldProps) {
	return (
		<Label className="flex items-center justify-between gap-3 text-sm font-normal">
			<span className="text-muted-foreground">{props.label}</span>
			{props.children}
		</Label>
	)
}

interface NumberFieldProps {
	value: number
	step?: number
	onChange: (next: number) => void
}

function NumberField(props: NumberFieldProps) {
	return (
		<Input
			type="number"
			step={props.step ?? 0.5}
			value={props.value}
			onChange={(event) => {
				const parsed = Number(event.target.value)

				if (Number.isFinite(parsed)) props.onChange(parsed)
			}}
			className="tnum h-7 w-24 text-right text-sm"
		/>
	)
}

interface InspectorProps {
	editor: Editor
}

export function Inspector(props: InspectorProps) {
	const { document, selection } = props.editor
	const panel = selection.panelId === undefined ? undefined : findPanel(document, selection.panelId)

	const vertex =
		panel === undefined || selection.vertexId === undefined
			? undefined
			: findVertex(panel, selection.vertexId)

	const edgeVertexId = selection.edgeVertexId

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<section className="space-y-2 p-4">
				<h2 className="text-xs font-medium text-muted-foreground">{"パーツ"}</h2>

				{document.panels.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						{"ペンか長方形でパーツを描いてください。"}
					</p>
				) : null}

				<ul className="space-y-0.5">
					{document.panels.map((entry) => (
						<li key={entry.id}>
							<button
								type="button"
								onClick={() => props.editor.select({ panelId: entry.id })}
								className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors ${
									entry.id === selection.panelId ? "bg-accent" : "hover:bg-muted"
								}`}
							>
								<span>{entry.name}</span>
								<span className="tnum text-xs text-muted-foreground">{`${entry.quantity}枚`}</span>
							</button>
						</li>
					))}
				</ul>
			</section>

			{panel === undefined ? null : (
				<>
					<Separator />

					<section className="space-y-3 p-4">
						<div className="flex items-center justify-between">
							<h2 className="text-xs font-medium text-muted-foreground">{"選んだパーツ"}</h2>

							<div className="flex gap-0.5">
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									onClick={() => props.editor.apply(duplicatePanel(document, panel.id))}
									title="複製する"
								>
									<Copy className="size-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									onClick={() => {
										props.editor.apply(deletePanel(document, panel.id))
										props.editor.select({})
									}}
									title="消す"
								>
									<Trash2 className="size-3.5" />
								</Button>
							</div>
						</div>

						<Field label="名前">
							<Input
								value={panel.name}
								onChange={(event) =>
									props.editor.apply(updatePanel(document, panel.id, { name: event.target.value }))
								}
								className="h-7 w-32 text-sm"
							/>
						</Field>

						<Field label="枚数">
							<NumberField
								value={panel.quantity}
								step={1}
								onChange={(next) =>
									props.editor.apply(
										updatePanel(document, panel.id, { quantity: Math.max(1, Math.round(next)) }),
									)
								}
							/>
						</Field>

						<Field label="わ（輪）">
							<input
								type="checkbox"
								checked={panel.onFold}
								onChange={(event) =>
									props.editor.apply(
										updatePanel(document, panel.id, { onFold: event.target.checked }),
									)
								}
								className="size-4 accent-foreground"
							/>
						</Field>
					</section>
				</>
			)}

			{panel !== undefined && vertex !== undefined ? (
				<>
					<Separator />

					<section className="space-y-3 p-4">
						<div className="flex items-center justify-between">
							<h2 className="text-xs font-medium text-muted-foreground">{"点"}</h2>

							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={() => {
									props.editor.apply(deleteVertex(document, panel.id, vertex.id))
									props.editor.select({ panelId: panel.id })
								}}
								title="点を消す"
							>
								<Trash2 className="size-3.5" />
							</Button>
						</div>

						<Field label="よこ">
							<NumberField
								value={vertex.x}
								onChange={(next) =>
									props.editor.apply(moveVertex(document, panel.id, vertex.id, next, vertex.y))
								}
							/>
						</Field>

						<Field label="たて">
							<NumberField
								value={vertex.y}
								onChange={(next) =>
									props.editor.apply(moveVertex(document, panel.id, vertex.id, vertex.x, next))
								}
							/>
						</Field>
					</section>
				</>
			) : null}

			{panel !== undefined && edgeVertexId !== undefined ? (
				<>
					<Separator />

					<section className="space-y-3 p-4">
						<h2 className="text-xs font-medium text-muted-foreground">{"辺"}</h2>

						<Field label="長さ">
							<span className="tnum text-sm">
								{`${edgeLength(document, { panelId: panel.id, vertexId: edgeVertexId }).toFixed(1)} cm`}
							</span>
						</Field>

						<Field label="縫い代">
							<NumberField
								value={panel.allowance[edgeVertexId] ?? document.defaultAllowance}
								onChange={(next) =>
									props.editor.apply(setEdgeAllowance(document, panel.id, edgeVertexId, next))
								}
							/>
						</Field>

						<Field label="次の点">
							<span className="text-sm text-muted-foreground">
								{nextVertex(panel, edgeVertexId)?.id ?? "—"}
							</span>
						</Field>

						<Button
							variant="outline"
							size="sm"
							className="w-full text-xs"
							onClick={() => props.editor.apply(toggleEdgeCurve(document, panel.id, edgeVertexId))}
						>
							{"直線とカーブを切り替える"}
						</Button>

						<div className="space-y-1 text-xs text-muted-foreground">
							<p>{"縫っていないところ"}</p>
							{edgeGaps(document, { panelId: panel.id, vertexId: edgeVertexId }).map((gap) => (
								<p key={`${gap.from}-${gap.to}`} className="tnum">
									{`${gap.from.toFixed(1)} 〜 ${gap.to.toFixed(1)} cm`}
								</p>
							))}
						</div>
					</section>
				</>
			) : null}
		</div>
	)
}
