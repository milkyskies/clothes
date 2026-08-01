import { useHotkey } from "@tanstack/react-hotkeys"
import { PenIcon } from "@/features/shared/icons/pen-icon"
import { RectangleIcon } from "@/features/shared/icons/rectangle-icon"
import { RedoIcon } from "@/features/shared/icons/redo-icon"
import { SelectIcon } from "@/features/shared/icons/select-icon"
import { UndoIcon } from "@/features/shared/icons/undo-icon"
import { Button } from "@/features/shared/ui/button"
import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import { Separator } from "@/features/shared/ui/separator"
import { addRectanglePanel } from "@/lib/drafting/edit"
import { jinbeiTop } from "@/lib/drafting/templates/jinbei"
import { localFileStore } from "@/services/files/local-file-store"
import { type Tool, useEditor } from "../use-editor"
import { useFiles } from "../use-files"
import { EditorCanvas } from "./editor-canvas"
import { FileBar } from "./file-bar"
import { Inspector } from "./inspector"

const TOOLS: readonly { value: Tool; label: string; icon: typeof PenIcon }[] = [
	{ value: "select", label: "えらぶ", icon: SelectIcon },
	{ value: "pen", label: "ペン", icon: PenIcon },
]

export function EditorPage() {
	const editor = useEditor(jinbeiTop())

	const files = useFiles({
		store: localFileStore,
		draft: editor.draft,
		onLoad: editor.load,
	})

	useHotkey("Mod+S", () => void files.save())
	useHotkey("Mod+Shift+S", () => void files.saveAs(`${files.currentName}のコピー`))
	useHotkey("Mod+Z", () => editor.undo(), { ignoreInputs: true })
	useHotkey("Mod+Shift+Z", () => editor.redo(), { ignoreInputs: true })
	useHotkey("V", () => editor.setTool("select"), { ignoreInputs: true })
	useHotkey("P", () => editor.setTool("pen"), { ignoreInputs: true })

	function addRectangle() {
		const created = addRectanglePanel(editor.draft, 4, 4, 30, 70)

		editor.apply(created.draft)
		editor.select({ panelId: created.panelId })
		editor.setTool("select")
	}

	return (
		<div className="flex h-screen overflow-hidden">
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex items-center gap-3 border-b px-3 py-2">
					<div className="flex items-center gap-0.5">
						{TOOLS.map((entry) => (
							<Button
								key={entry.value}
								variant={editor.tool === entry.value ? "default" : "ghost"}
								size="icon"
								className="size-8"
								onClick={() => editor.setTool(entry.value)}
								title={entry.label}
							>
								<entry.icon className="size-4" />
							</Button>
						))}

						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={addRectangle}
							title="長方形を足す"
						>
							<RectangleIcon className="size-4" />
						</Button>
					</div>

					<Separator orientation="vertical" className="h-6" />

					<div className="flex items-center gap-0.5">
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={!editor.canUndo}
							onClick={editor.undo}
							title="元に戻す"
						>
							<UndoIcon className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={!editor.canRedo}
							onClick={editor.redo}
							title="やり直す"
						>
							<RedoIcon className="size-4" />
						</Button>
					</div>

					<Separator orientation="vertical" className="h-6" />

					<Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
						<span>{"スナップ"}</span>
						<Input
							type="number"
							min={0}
							step={0.1}
							value={files.snap}
							onChange={(event) => {
								const parsed = Number(event.target.value)

								if (Number.isFinite(parsed)) editor.setSnap(Math.max(0, parsed))
								files.setSnap(Math.max(0, parsed))
							}}
							className="tnum h-7 w-16 text-right text-xs"
						/>
						<span>{"cm"}</span>
					</Label>

					<div className="ml-auto">
						<FileBar files={files} />
					</div>
				</header>

				{files.recovery === undefined ? null : (
					<div className="flex items-center gap-3 border-b bg-muted/60 px-3 py-2 text-xs">
						<span>{"保存されていない作業が残っています。"}</span>
						<Button variant="default" size="sm" className="h-7 text-xs" onClick={files.restore}>
							{"元に戻す"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs"
							onClick={() => void files.discardRecovery()}
						>
							{"捨てる"}
						</Button>
					</div>
				)}

				<div className="min-h-0 flex-1">
					<EditorCanvas editor={editor} />
				</div>
			</div>

			<aside className="w-72 shrink-0 border-l">
				<Inspector editor={editor} />
			</aside>
		</div>
	)
}
