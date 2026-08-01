import { Either } from "effect"
import {
	decodeFileRecord,
	decodeRecovery,
	decodeSettings,
	encodeFileRecord,
	encodeRecovery,
	encodeSettings,
	type FileRecord,
	type Recovery,
	type Settings,
} from "@/lib/drafting/schema"
import type { FileStore, FileSummary } from "./file-store"

const FILE_PREFIX = "clothes.file."
const RECOVERY_PREFIX = "clothes.recovery."
const SETTINGS_KEY = "clothes.settings"

export const DEFAULT_SETTINGS: Settings = { snap: 0.5 }

function readRecord(key: string): FileRecord | undefined {
	const raw = window.localStorage.getItem(key)

	if (raw === null) return undefined

	try {
		const decoded = decodeFileRecord(JSON.parse(raw))

		return Either.isRight(decoded) ? decoded.right : undefined
	} catch {
		// A draft written by an older build is dropped rather than crashing the editor.
		return undefined
	}
}

export const localFileStore: FileStore = {
	async list(): Promise<readonly FileSummary[]> {
		const summaries: FileSummary[] = []

		for (let index = 0; index < window.localStorage.length; index += 1) {
			const key = window.localStorage.key(index)

			if (key === null || !key.startsWith(FILE_PREFIX)) continue

			const record = readRecord(key)

			if (record === undefined) continue

			summaries.push({ id: record.id, name: record.name, updatedAt: record.updatedAt })
		}

		return summaries.sort((left, right) => right.updatedAt - left.updatedAt)
	},

	async read(id: string): Promise<FileRecord | undefined> {
		return readRecord(`${FILE_PREFIX}${id}`)
	},

	async write(record: FileRecord): Promise<void> {
		window.localStorage.setItem(
			`${FILE_PREFIX}${record.id}`,
			JSON.stringify(encodeFileRecord(record)),
		)
	},

	async remove(id: string): Promise<void> {
		window.localStorage.removeItem(`${FILE_PREFIX}${id}`)
		window.localStorage.removeItem(`${RECOVERY_PREFIX}${id}`)
	},

	async readRecovery(fileId: string): Promise<Recovery | undefined> {
		const raw = window.localStorage.getItem(`${RECOVERY_PREFIX}${fileId}`)

		if (raw === null) return undefined

		try {
			const decoded = decodeRecovery(JSON.parse(raw))

			return Either.isRight(decoded) ? decoded.right : undefined
		} catch {
			return undefined
		}
	},

	async writeRecovery(recovery: Recovery): Promise<void> {
		window.localStorage.setItem(
			`${RECOVERY_PREFIX}${recovery.fileId}`,
			JSON.stringify(encodeRecovery(recovery)),
		)
	},

	async clearRecovery(fileId: string): Promise<void> {
		window.localStorage.removeItem(`${RECOVERY_PREFIX}${fileId}`)
	},
}

export function readSettings(): Settings {
	const raw = window.localStorage.getItem(SETTINGS_KEY)

	if (raw === null) return DEFAULT_SETTINGS

	try {
		const decoded = decodeSettings(JSON.parse(raw))

		return Either.isRight(decoded) ? decoded.right : DEFAULT_SETTINGS
	} catch {
		return DEFAULT_SETTINGS
	}
}

export function writeSettings(settings: Settings): void {
	window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(encodeSettings(settings)))
}
