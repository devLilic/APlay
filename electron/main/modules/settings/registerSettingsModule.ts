import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, dialog, ipcMain } from 'electron'
import {
  ipcInvokeChannels,
  type GraphicConfigExportRequest,
  type ProfileConfigExportRequest,
  type ReferenceImageDataResponse,
  type SettingsGetRequest,
  type SettingsValuePayload,
} from '../../../../src/shared/ipc/contracts'
import { createSettingsStore } from './settingsStore'
import type { AppSettings, SettingsKey } from '../../../../src/shared/settings/types'
import { createGraphicConfigFileSaveService } from '../../../../src/settings/storage/graphicConfigExport'
import { createProfileConfigFileSaveService } from '../../../../src/settings/storage/profileConfigExport'

let settingsHandlersRegistered = false

export function registerSettingsModule() {
  if (settingsHandlersRegistered) {
    return
  }

  settingsHandlersRegistered = true

  const settingsStore = createSettingsStore(app.getPath('userData'))

  ipcMain.handle(ipcInvokeChannels.settingsGet, (_event, payload: SettingsGetRequest) => {
    return {
      key: payload.key,
      value: settingsStore.getSetting(payload.key),
    } as SettingsValuePayload
  })

  ipcMain.handle(ipcInvokeChannels.settingsSet, (_event, payload: SettingsValuePayload) => {
    const key = payload.key as SettingsKey
    const value = payload.value as AppSettings[typeof key]

    return {
      key,
      value: settingsStore.setSetting(key, value),
    } as SettingsValuePayload
  })

  ipcMain.handle(ipcInvokeChannels.settingsPickReferenceImage, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select reference background image',
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'],
        },
      ],
    })

    return {
      filePath: result.canceled ? null : (result.filePaths[0] ?? null),
    }
  })

  ipcMain.handle(ipcInvokeChannels.settingsPickSourceCsvFile, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select working CSV source file',
      properties: ['openFile'],
      filters: [
        {
          name: 'CSV Files',
          extensions: ['csv'],
        },
      ],
    })

    return {
      filePath: result.canceled ? null : (result.filePaths[0] ?? null),
    }
  })

  ipcMain.handle(
    ipcInvokeChannels.settingsReadReferenceImage,
    async (_event, payload: { filePath: string }): Promise<ReferenceImageDataResponse> => {
      try {
        const filePath = payload.filePath.trim()
        if (filePath.length === 0) {
          return { dataUrl: null }
        }

        const fileBuffer = await readFile(filePath)
        return {
          dataUrl: `data:${resolveImageMimeType(filePath)};base64,${fileBuffer.toString('base64')}`,
        }
      } catch {
        return { dataUrl: null }
      }
    },
  )

  ipcMain.on(
    ipcInvokeChannels.settingsReadSourceFile,
    (event, payload: { filePath: string }) => {
      try {
        const filePath = payload.filePath.trim()
        if (filePath.length === 0) {
          event.returnValue = { content: null }
          return
        }

        event.returnValue = {
          content: readFileSync(filePath, 'utf8'),
        }
      } catch {
        event.returnValue = { content: null }
      }
    },
  )

  ipcMain.handle(
    ipcInvokeChannels.settingsExportGraphicConfig,
    async (_event, payload: GraphicConfigExportRequest) => {
      const exportService = createGraphicConfigFileSaveService({
        async pickFilePath(suggestedFileName) {
          const result = await dialog.showSaveDialog({
            title: 'Export graphic config JSON',
            defaultPath: suggestedFileName,
            filters: [
              {
                name: 'JSON Files',
                extensions: ['json'],
              },
            ],
          })

          return result.canceled ? null : (result.filePath ?? null)
        },
        async writeFile(filePath, content) {
          await writeFile(filePath, content, 'utf8')
        },
      })

      const result = await exportService.save(payload.graphicConfig, payload.suggestedFileName)

      return {
        filePath: result.filePath,
      }
    },
  )

  ipcMain.handle(
    ipcInvokeChannels.settingsExportProfileConfig,
    async (_event, payload: ProfileConfigExportRequest) => {
      const exportService = createProfileConfigFileSaveService({
        async pickFilePath(suggestedFileName) {
          const result = await dialog.showSaveDialog({
            title: 'Export profile config JSON',
            defaultPath: suggestedFileName,
            filters: [
              {
                name: 'JSON Files',
                extensions: ['json'],
              },
            ],
          })

          return result.canceled ? null : (result.filePath ?? null)
        },
        async writeFile(filePath, content) {
          await writeFile(filePath, content, 'utf8')
        },
      })

      const result = await exportService.save(payload.settings, payload.profileId, payload.suggestedFileName)

      return {
        filePath: result.filePath,
      }
    },
  )
}

function resolveImageMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.bmp':
      return 'image/bmp'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
    default:
      return 'image/png'
  }
}
