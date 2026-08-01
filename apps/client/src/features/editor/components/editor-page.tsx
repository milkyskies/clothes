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

interface ToolEntry {
	readonly value: Tool
	readonly label: string
	readonly shortcut: string
	readonly icon: typeof PenIcon
}

const TOOLS: readonly ToolEntry[] = [
	{ value: "select", label: "えらぶ", shortcut: "V", icon: SelectIcon },
	{ value: "pen", label: "ペン", shortcut: "P", icon: PenIcon },
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

	function changeSnap(value: string) {
		const parsed = Number(value)

		if (!Number.isFinite(parsed)) return

		const snap = Math.max(0, parsed)

		editor.setSnap(snap)
		files.setSnap(snap)
	}

	return (
		<div className="flex h-screen flex-col overflow-hidden">
			<header className="flex shrink-0 items-center gap-3 border-b px-3 py-2">
				<FileBar files={files} />

				<Separator orientation="vertical" className="h-6" />

				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						disabled={!editor.canUndo}
						onClick={editor.undo}
						title="元に戻す（⌘Z）"
					>
						<UndoIcon className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						disabled={!editor.canRedo}
						onClick={editor.redo}
						title="やり直す（⇧⌘Z）"
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
						onChange={(event) => changeSnap(event.target.value)}
						className="tnum h-7 w-16 text-right text-xs"
					/>
					<span>{"cm"}</span>
				</Label>
			</header>

			{files.recovery === undefined ? null : (
				<div className="flex shrink-0 items-center gap-3 border-b bg-muted/60 px-3 py-2 text-xs">
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

			<div className="flex min-h-0 flex-1">
				<nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r py-2">
					{TOOLS.map((entry) => (
						<Button
							key={entry.value}
							variant={editor.tool === entry.value ? "default" : "ghost"}
							size="icon"
							className="size-9"
							onClick={() => editor.setTool(entry.value)}
							title={`${entry.label}（${entry.shortcut}）`}
						>
							<entry.icon className="size-4" />
						</Button>
					))}

					<Separator className="my-1 w-6" />

					<Button
						variant="ghost"
						size="icon"
						className="size-9"
						onClick={addRectangle}
						title="長方形を足す"
					>
						<RectangleIcon className="size-4" />
					</Button>
				</nav>

				<main className="min-w-0 flex-1">
					<EditorCanvas editor={editor} />
				</main>

				<aside className="w-72 shrink-0 border-l">
					<Inspector editor={editor} />
				</aside>
			</div>
		</div>
	)
}
