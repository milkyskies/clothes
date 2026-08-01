import { useCallback, useEffect, useRef, useState } from "react"
import type { Draft } from "@/lib/drafting/draft"
import type { Recovery } from "@/lib/drafting/schema"
import { jinbeiTop } from "@/lib/drafting/templates/jinbei"
import { type FileStore, type FileSummary, fileFrom } from "@/services/files/file-store"
import { readSettings, writeSettings } from "@/services/files/local-file-store"

const RECOVERY_IDLE_MS = 800

export interface Files {
	readonly ready: boolean
	readonly list: readonly FileSummary[]
	readonly currentId: string | undefined
	readonly currentName: string
	readonly savedAt: number | undefined
	readonly dirty: boolean
	readonly recovery: Recovery | undefined
	readonly save: () => Promise<void>
	readonly saveAs: (name: string) => Promise<void>
	readonly open: (id: string) => Promise<void>
	readonly create: (name: string) => Promise<void>
	readonly rename: (name: string) => void
	readonly remove: (id: string) => Promise<void>
	readonly restore: () => void
	readonly discardRecovery: () => Promise<void>
	readonly snap: number
	readonly setSnap: (snap: number) => void
}

interface FilesOptions {
	readonly store: FileStore
	readonly draft: Draft
	readonly onLoad: (draft: Draft) => void
}

/**
 * Files are saved explicitly; what happens on its own is a recovery buffer.
 *
 * Writing the file on every edit would make undo history and saved history the
 * same thing, so an idle timer keeps a copy of unsaved work beside the file and
 * that copy is offered back on the next visit rather than applied silently.
 */
export function useFiles(options: FilesOptions): Files {
	const [list, setList] = useState<readonly FileSummary[]>([])
	const [currentId, setCurrentId] = useState<string | undefined>(undefined)
	const [name, setName] = useState("")
	const [savedAt, setSavedAt] = useState<number | undefined>(undefined)
	const [dirty, setDirty] = useState(false)
	const [recovery, setRecovery] = useState<Recovery | undefined>(undefined)
	const [ready, setReady] = useState(false)
	const [snap, setSnapState] = useState(0.5)

	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const settling = useRef(true)

	const adopt = useCallback(
		(id: string, fileName: string, at: number, draft: Draft) => {
			settling.current = true
			setCurrentId(id)
			setName(fileName)
			setSavedAt(at)
			setDirty(false)
			options.onLoad(draft)
			writeSettings({ snap, lastOpenedFileId: id })
		},
		[options.onLoad, snap],
	)

	useEffect(() => {
		const settings = readSettings()

		setSnapState(settings.snap)

		void (async () => {
			const existing = await options.store.list()
			const wanted = settings.lastOpenedFileId
			const record = wanted === undefined ? undefined : await options.store.read(wanted)

			if (record === undefined) {
				const seeded = fileFrom(jinbeiTop(), "甚平（上）M", Date.now())

				await options.store.write(seeded)
				setList(await options.store.list())
				adopt(seeded.id, seeded.name, seeded.updatedAt, seeded.draft)
			} else {
				setList(existing)
				adopt(record.id, record.name, record.updatedAt, record.draft)

				const held = await options.store.readRecovery(record.id)

				if (held !== undefined && held.at > record.updatedAt) setRecovery(held)
			}

			setReady(true)
		})()
	}, [options.store, adopt])

	useEffect(() => {
		if (!ready || currentId === undefined) return

		if (settling.current) {
			settling.current = false
			return
		}

		setDirty(true)
		clearTimeout(timer.current)

		timer.current = setTimeout(() => {
			void options.store.writeRecovery({
				fileId: currentId,
				at: Date.now(),
				draft: options.draft,
			})
		}, RECOVERY_IDLE_MS)

		return () => clearTimeout(timer.current)
	}, [options.draft, options.store, currentId, ready])

	const save = useCallback(async () => {
		if (currentId === undefined) return

		const at = Date.now()

		await options.store.write({
			id: currentId,
			name,
			updatedAt: at,
			draft: { ...options.draft, name },
		})
		await options.store.clearRecovery(currentId)

		setSavedAt(at)
		setDirty(false)
		setRecovery(undefined)
		setList(await options.store.list())
	}, [options.store, options.draft, currentId, name])

	const saveAs = useCallback(
		async (fileName: string) => {
			const record = fileFrom(options.draft, fileName, Date.now())

			await options.store.write(record)
			setList(await options.store.list())
			adopt(record.id, record.name, record.updatedAt, record.draft)
		},
		[options.store, options.draft, adopt],
	)

	const open = useCallback(
		async (id: string) => {
			const record = await options.store.read(id)

			if (record === undefined) return

			adopt(record.id, record.name, record.updatedAt, record.draft)

			const held = await options.store.readRecovery(record.id)

			setRecovery(held !== undefined && held.at > record.updatedAt ? held : undefined)
		},
		[options.store, adopt],
	)

	const create = useCallback(
		async (fileName: string) => {
			const record = fileFrom(jinbeiTop(), fileName, Date.now())

			await options.store.write(record)
			setList(await options.store.list())
			adopt(record.id, record.name, record.updatedAt, record.draft)
		},
		[options.store, adopt],
	)

	const remove = useCallback(
		async (id: string) => {
			await options.store.remove(id)

			const remaining = await options.store.list()

			setList(remaining)

			if (id !== currentId) return

			const next = remaining[0]

			if (next === undefined) {
				await create("名前のない型")
				return
			}

			await open(next.id)
		},
		[options.store, currentId, create, open],
	)

	const restore = useCallback(() => {
		if (recovery === undefined) return

		options.onLoad(recovery.draft)
		setRecovery(undefined)
		setDirty(true)
	}, [recovery, options.onLoad])

	const discardRecovery = useCallback(async () => {
		if (currentId === undefined) return

		await options.store.clearRecovery(currentId)
		setRecovery(undefined)
	}, [options.store, currentId])

	const setSnap = useCallback(
		(next: number) => {
			setSnapState(next)
			writeSettings({ snap: next, lastOpenedFileId: currentId })
		},
		[currentId],
	)

	return {
		ready,
		list,
		currentId,
		currentName: name,
		savedAt,
		dirty,
		recovery,
		save,
		saveAs,
		open,
		create,
		rename: setName,
		remove,
		restore,
		discardRecovery,
		snap,
		setSnap,
	}
}
