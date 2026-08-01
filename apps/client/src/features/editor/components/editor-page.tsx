import { useHotkey } from "@tanstack/react-hotkeys"
import { lazy, Suspense } from "react"
import { CutIcon } from "@/features/shared/icons/cut-icon"
import { PenIcon } from "@/features/shared/icons/pen-icon"
import { RectangleIcon } from "@/features/shared/icons/rectangle-icon"
import { RedoIcon } from "@/features/shared/icons/redo-icon"
import { SelectIcon } from "@/features/shared/icons/select-icon"
import { UndoIcon } from "@/features/shared/icons/undo-icon"
import { Button } from "@/features/shared/ui/button"
import { Input } from "@/features/shared/ui/input"
import { Label } from "@/features/shared/ui/label"
import { Separator } from "@/features/shared/ui/separator"
import { removeSeam } from "@/lib/drafting/assemble"
import { addRectanglePanel, deletePanel, deleteVertex } from "@/lib/drafting/edit"
import { jinbeiTop } from "@/lib/drafting/templates/jinbei"
import { localFileStore } from "@/services/files/local-file-store"
import { type Mode, type Tool, useEditor } from "../use-editor"
import { useFiles } from "../use-files"
import { AssembleView } from "./assemble-view"
import { CheckPanel } from "./check-panel"
import { CuttingView } from "./cutting-view"
import { EditorCanvas } from "./editor-canvas"
import { FileBar } from "./file-bar"
import { FinishedView } from "./finished-view"

// The 3D stack is the heaviest thing in the bundle and most sessions never
// open it, so it only loads when the tab is first clicked.
const WearView = lazy(() => import("./wear-view"))

import { HintBar } from "./hint-bar"
import { Inspector } from "./inspector"
import { SeamInspector } from "./seam-inspector"

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

/**
 * 組み立て separates looking from doing: えらぶ inspects without ever creating a
 * seam, and ぬう is armed sewing, so a stray click cannot join two edges.
 */
const ASSEMBLE_TOOLS: readonly ToolEntry[] = [
	{ value: "select", label: "えらぶ", shortcut: "V", icon: SelectIcon },
	{ value: "sew", label: "ぬう", shortcut: "S", icon: CutIcon },
]

const MODES: readonly { value: Mode; label: string }[] = [
	{ value: "draw", label: "製図" },
	{ value: "assemble", label: "組み立て" },
	{ value: "finished", label: "出来上がり" },
	{ value: "wear", label: "着てみる" },
	{ value: "cutting", label: "裁ち方" },
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
	useHotkey(
		"S",
		() => {
			if (editor.mode === "assemble") editor.setTool("sew")
		},
		{ ignoreInputs: true },
	)

	// Everyone reaches for these two before reading anything, so they have to work.
	useHotkey("Escape", () => {
		editor.setPending(undefined)
		editor.select({})
	})
	useHotkey("Backspace", () => removeSelected(), { ignoreInputs: true })
	useHotkey("Delete", () => removeSelected(), { ignoreInputs: true })

	function removeSelected() {
		const { selection } = editor

		if (selection.seamId !== undefined) {
			editor.apply(removeSeam(editor.draft, selection.seamId))
			editor.select({})

			return
		}

		if (selection.panelId === undefined) return

		if (selection.vertexId !== undefined) {
			editor.apply(deleteVertex(editor.draft, selection.panelId, selection.vertexId))
			editor.select({ panelId: selection.panelId })

			return
		}

		if (selection.edgeVertexId !== undefined) return

		editor.apply(deletePanel(editor.draft, selection.panelId))
		editor.select({})
	}

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
			<header className="flex shrink-0 items-center border-b px-3 py-2">
				<FileBar files={files} />
			</header>

			<div className="flex shrink-0 items-center gap-3 border-b px-3 py-1.5">
				<div className="flex items-center gap-0.5 rounded-md border p-0.5">
					{MODES.map((entry) => (
						<Button
							key={entry.value}
							variant={editor.mode === entry.value ? "default" : "ghost"}
							size="sm"
							className="h-7 px-2.5 text-xs"
							onClick={() => editor.setMode(entry.value)}
						>
							{entry.label}
						</Button>
					))}
				</div>

				{editor.mode === "assemble" ? (
					<>
						<Separator orientation="vertical" className="h-6" />

						<div className="flex items-center gap-0.5">
							{ASSEMBLE_TOOLS.map((entry) => (
								<Button
									key={entry.value}
									variant={editor.tool === entry.value ? "default" : "ghost"}
									size="sm"
									className="h-8 gap-1.5 px-2 text-xs"
									onClick={() => editor.setTool(entry.value)}
									title={`${entry.label}（${entry.shortcut}）`}
								>
									<entry.icon className="size-4" />
									{entry.label}
								</Button>
							))}
						</div>
					</>
				) : null}

				{editor.mode === "draw" ? (
					<>
						<Separator orientation="vertical" className="h-6" />

						<div className="flex items-center gap-0.5">
							{TOOLS.map((entry) => (
								<Button
									key={entry.value}
									variant={editor.tool === entry.value ? "default" : "ghost"}
									size="icon"
									className="size-8"
									onClick={() => editor.setTool(entry.value)}
									title={`${entry.label}（${entry.shortcut}）`}
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
					</>
				) : null}

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
			</div>

			<HintBar editor={editor} />

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
				<main className="min-w-0 flex-1">
					{editor.mode === "draw" ? <EditorCanvas editor={editor} /> : null}
					{editor.mode === "assemble" ? <AssembleView editor={editor} /> : null}
					{editor.mode === "finished" ? <FinishedView editor={editor} /> : null}
					{editor.mode === "wear" ? (
						<Suspense
							fallback={
								<p className="p-6 text-xs text-muted-foreground">{"3D を読み込んでいます…"}</p>
							}
						>
							<WearView editor={editor} />
						</Suspense>
					) : null}
					{editor.mode === "cutting" ? <CuttingView editor={editor} /> : null}
				</main>

				<aside className="flex w-72 shrink-0 flex-col border-l">
					<div className="min-h-0 flex-1 overflow-y-auto">
						{editor.mode === "assemble" ? <SeamInspector editor={editor} /> : null}
						{editor.mode === "draw" ? <Inspector editor={editor} /> : null}
					</div>

					<CheckPanel editor={editor} />
				</aside>
			</div>
		</div>
	)
}
