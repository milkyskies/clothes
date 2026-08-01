import { DeleteIcon } from "@/features/shared/icons/delete-icon"
import { Button } from "@/features/shared/ui/button"
import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import { Separator } from "@/features/shared/ui/separator"
import {
	findSeam,
	flipSeam,
	removeSeam,
	renameSeam,
	runLength,
	seamMismatch,
	setSeamRun,
} from "@/lib/drafting/assemble"
import { edgeLength } from "@/lib/drafting/assembly"
import type { EdgeRun, Seam } from "@/lib/drafting/draft"
import { findPanel } from "@/lib/drafting/draft"
import type { Editor } from "../use-editor"
import { StitchSection } from "./stitch-section"

function edgeName(editor: Editor, run: EdgeRun): string {
	return findPanel(editor.draft, run.edge.panelId)?.name ?? "?"
}

interface RunFieldsProps {
	editor: Editor
	seam: Seam
	side: "a" | "b"
}

function RunFields(props: RunFieldsProps) {
	const run = props.seam[props.side]
	const total = edgeLength(props.editor.draft, run.edge)

	function set(from: number, to: number) {
		props.editor.apply(setSeamRun(props.editor.draft, props.seam.id, props.side, from, to))
	}

	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between">
				<span className="text-sm">{edgeName(props.editor, run)}</span>
				<span className="tnum text-xs text-muted-foreground">{`辺 ${total.toFixed(1)} cm`}</span>
			</div>

			<div className="flex items-center gap-1.5">
				<Input
					type="number"
					step={0.5}
					value={run.from}
					onChange={(event) => set(Number(event.target.value), run.to)}
					className="tnum h-7 flex-1 text-right text-sm"
				/>
				<span className="text-xs text-muted-foreground">{"〜"}</span>
				<Input
					type="number"
					step={0.5}
					value={run.to}
					onChange={(event) => set(run.from, Number(event.target.value))}
					className="tnum h-7 flex-1 text-right text-sm"
				/>
			</div>

			<p className="tnum text-xs text-muted-foreground">
				{`縫う長さ ${runLength(run).toFixed(1)} cm`}
			</p>
		</div>
	)
}

interface SeamInspectorProps {
	editor: Editor
}

/**
 * A seam is two runs of cloth held together. Shortening either one is the only
 * way this model makes an opening, so the numbers here are where 脇あき and
 * 身八つ口 come from.
 */
export function SeamInspector(props: SeamInspectorProps) {
	const { draft, selection } = props.editor
	const seam = selection.seamId === undefined ? undefined : findSeam(draft, selection.seamId)

	const chosenEdge =
		selection.panelId === undefined || selection.edgeVertexId === undefined
			? undefined
			: { panelId: selection.panelId, vertexId: selection.edgeVertexId }

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<section className="space-y-2 p-4">
				<h2 className="text-xs font-medium text-muted-foreground">{"縫い"}</h2>

				{draft.seams.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						{"辺を2つ続けて押すと、その2辺を縫い合わせます。"}
					</p>
				) : null}

				<ul className="space-y-0.5">
					{draft.seams.map((entry) => {
						const mismatch = seamMismatch(entry)

						return (
							<li key={entry.id}>
								<button
									type="button"
									onClick={() => props.editor.select({ seamId: entry.id })}
									className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors ${
										entry.id === selection.seamId ? "bg-accent" : "hover:bg-muted"
									}`}
								>
									<span>{entry.name}</span>
									{mismatch > 0.5 ? (
										<span className="tnum text-xs text-destructive">{`${mismatch}cm ちがう`}</span>
									) : (
										<span className="tnum text-xs text-muted-foreground">
											{`${runLength(entry.a).toFixed(0)}cm`}
										</span>
									)}
								</button>
							</li>
						)
					})}
				</ul>
			</section>

			{seam === undefined ? null : (
				<>
					<Separator />

					<section className="space-y-3 p-4">
						<div className="flex items-center justify-between">
							<h2 className="text-xs font-medium text-muted-foreground">{"選んだ縫い"}</h2>

							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={() => {
									props.editor.apply(removeSeam(draft, seam.id))
									props.editor.select({})
								}}
								title="ほどく"
							>
								<DeleteIcon className="size-3.5" />
							</Button>
						</div>

						<Label className="flex items-center justify-between gap-3 text-sm font-normal">
							<span className="text-muted-foreground">{"名前"}</span>
							<Input
								value={seam.name}
								onChange={(event) =>
									props.editor.apply(renameSeam(draft, seam.id, event.target.value))
								}
								className="h-7 w-32 text-sm"
							/>
						</Label>

						<RunFields editor={props.editor} seam={seam} side="a" />
						<RunFields editor={props.editor} seam={seam} side="b" />

						<div className="space-y-1.5">
							<Button
								variant="outline"
								size="sm"
								className="h-7 w-full text-xs"
								onClick={() => props.editor.apply(flipSeam(draft, seam.id))}
							>
								{"向きを反転"}
							</Button>

							<p className="text-xs text-muted-foreground">
								{seam.reversed === true
									? "後の辺を逆向きに合わせています。"
									: "両方の辺を同じ向きに合わせています。"}
							</p>
						</div>

						{seamMismatch(seam) > 0.5 ? (
							<p className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
								{`両側の長さが ${seamMismatch(seam)}cm ちがいます。少しなら いせ込めますが、大きいと縫えません。`}
							</p>
						) : null}

						<p className="text-xs text-muted-foreground">
							{"縫う範囲を短くすると、残りがあきになります。"}
						</p>
					</section>
				</>
			)}

			{chosenEdge === undefined ? null : <StitchSection editor={props.editor} edge={chosenEdge} />}
		</div>
	)
}
