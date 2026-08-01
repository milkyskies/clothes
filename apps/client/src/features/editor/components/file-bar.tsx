import { useState } from "react"
import { DeleteIcon } from "@/features/shared/icons/delete-icon"
import { DuplicateIcon } from "@/features/shared/icons/duplicate-icon"
import { RectangleIcon } from "@/features/shared/icons/rectangle-icon"
import { Button } from "@/features/shared/ui/button"
import { Input } from "@/features/shared/ui/input"
import { Separator } from "@/features/shared/ui/separator"
import type { Files } from "../use-files"

function clockOf(at: number): string {
	return new Date(at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
}

interface FileBarProps {
	files: Files
}

export function FileBar(props: FileBarProps) {
	const [listOpen, setListOpen] = useState(false)

	return (
		<div className="relative flex items-center gap-2">
			<Input
				value={props.files.currentName}
				onChange={(event) => props.files.rename(event.target.value)}
				className="h-7 w-44 text-sm"
			/>

			<Button
				variant={props.files.dirty ? "default" : "ghost"}
				size="sm"
				className="h-7 text-xs"
				onClick={() => void props.files.save()}
				title="保存する（⌘S）"
			>
				{"保存"}
			</Button>

			<span className="tnum text-xs text-muted-foreground">
				{props.files.dirty
					? "未保存"
					: props.files.savedAt === undefined
						? ""
						: `${clockOf(props.files.savedAt)} に保存`}
			</span>

			<Separator orientation="vertical" className="h-6" />

			<Button
				variant="ghost"
				size="sm"
				className="h-7 text-xs"
				onClick={() => setListOpen((open) => !open)}
			>
				{`ファイル（${props.files.list.length}）`}
			</Button>

			{listOpen ? (
				<div className="absolute top-9 left-0 z-40 w-72 rounded-md border bg-popover p-1 shadow-md">
					<div className="flex gap-1 p-1">
						<Button
							variant="outline"
							size="sm"
							className="h-7 flex-1 text-xs"
							onClick={() => {
								void props.files.create("名前のない型")
								setListOpen(false)
							}}
						>
							<RectangleIcon className="size-3.5" />
							{"新規"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-7 flex-1 text-xs"
							onClick={() => {
								void props.files.saveAs(`${props.files.currentName}のコピー`)
								setListOpen(false)
							}}
						>
							<DuplicateIcon className="size-3.5" />
							{"複製して保存"}
						</Button>
					</div>

					<Separator className="my-1" />

					<ul className="max-h-72 overflow-y-auto">
						{props.files.list.map((entry) => (
							<li key={entry.id} className="flex items-center gap-1">
								<button
									type="button"
									onClick={() => {
										void props.files.open(entry.id)
										setListOpen(false)
									}}
									className={`flex flex-1 items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
										entry.id === props.files.currentId ? "bg-accent" : "hover:bg-muted"
									}`}
								>
									<span className="truncate">{entry.name}</span>
									<span className="tnum shrink-0 text-xs text-muted-foreground">
										{clockOf(entry.updatedAt)}
									</span>
								</button>

								<Button
									variant="ghost"
									size="icon"
									className="size-7 shrink-0"
									onClick={() => void props.files.remove(entry.id)}
									title="消す"
								>
									<DeleteIcon className="size-3.5" />
								</Button>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	)
}
