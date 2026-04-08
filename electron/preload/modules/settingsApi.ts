import { contextBridge, ipcRenderer } from 'electron'
import type { AppLanguage } from '../../../config/types'
import {
  ipcInvokeChannels,
  type DatasourceFileWriteResponse,
  type GraphicConfigExportResponse,
  type OscSendResponse,
  type ProfileConfigExportResponse,
  type DatasourceJsonPickerResponse,
  type GraphicConfigImportPickerResponse,
  type ReferenceImageDataResponse,
  type ReferenceImagePickerResponse,
  type ProfileConfigImportPickerResponse,
  type SettingsGetResponse,
  type SourceFileReadResponse,
  type SourceCsvPickerResponse,
  type TextFileReadResponse,
} from '../../../src/shared/ipc/contracts'
import type { AppSettings, GraphicInstanceConfig, OscArgConfig } from '../../../src/settings/models/appConfig'
import type { OscTransportStage } from '../../../src/integrations/osc/oscClient'
import type { UpdatePreferences, UiPreferences } from '../../../src/shared/settings/types'
import { invoke } from './shared'

export function registerSettingsApi() {
  contextBridge.exposeInMainWorld('settingsApi', {
    async getLanguage(): Promise<AppLanguage | null> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'language' })
      return extractValue(response)
    },
    async setLanguage(language: AppLanguage | null): Promise<AppLanguage | null> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'language', value: language })
      return extractValue(response)
    },
    async getUpdatePreferences(): Promise<UpdatePreferences> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'updatePreferences' })
      return extractValue(response)
    },
    async setUpdatePreferences(value: UpdatePreferences): Promise<UpdatePreferences> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'updatePreferences', value })
      return extractValue(response)
    },
    async getUiPreferences(): Promise<UiPreferences> {
      const response = await invoke(ipcInvokeChannels.settingsGet, { key: 'uiPreferences' })
      return extractValue(response)
    },
    async setUiPreferences(value: UiPreferences): Promise<UiPreferences> {
      const response = await invoke(ipcInvokeChannels.settingsSet, { key: 'uiPreferences', value })
      return extractValue(response)
    },
    async pickReferenceImage(): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsPickReferenceImage)
      return extractFilePath(response)
    },
    async pickSourceCsvFile(): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsPickSourceCsvFile)
      return extractCsvFilePath(response)
    },
    async pickDatasourceJsonFile(): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsPickDatasourceJsonFile)
      return extractDatasourceJsonFilePath(response)
    },
    async pickGraphicConfigImportFile(): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsPickGraphicConfigImportFile)
      return extractGraphicConfigImportFilePath(response)
    },
    async pickProfileConfigImportFile(): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsPickProfileConfigImportFile)
      return extractProfileConfigImportFilePath(response)
    },
    async readReferenceImage(filePath: string): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsReadReferenceImage, { filePath })
      return extractDataUrl(response)
    },
    async readTextFile(filePath: string): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsReadTextFile, { filePath })
      return extractTextFileContent(response)
    },
    readSourceFileSync(filePath: string): string | null {
      const response = ipcRenderer.sendSync(ipcInvokeChannels.settingsReadSourceFile, { filePath }) as SourceFileReadResponse
      return response.content
    },
    writeDatasourceFileSync(filePath: string, content: string): void {
      const response = ipcRenderer.sendSync(
        ipcInvokeChannels.settingsWriteDatasourceFile,
        { filePath, content },
      ) as DatasourceFileWriteResponse
      extractDatasourceWriteResult(response)
    },
    async exportGraphicConfig(graphicConfig: GraphicInstanceConfig, suggestedFileName?: string): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsExportGraphicConfig, {
        graphicConfig,
        suggestedFileName,
      })
      return extractGraphicConfigExportPath(response)
    },
    async exportProfileConfig(settings: AppSettings, profileId: string, suggestedFileName?: string): Promise<string | null> {
      const response = await invoke(ipcInvokeChannels.settingsExportProfileConfig, {
        settings,
        profileId,
        suggestedFileName,
      })
      return extractProfileConfigExportPath(response)
    },
    async sendOscMessage(host: string, port: number, address: string, args: OscArgConfig[]): Promise<OscTransportStage[]> {
      const response = await invoke(ipcInvokeChannels.settingsSendOscMessage, {
        host,
        port,
        address,
        args,
      })
      return extractOscSendResult(response)
    },
  })
}

function extractValue<TValue>(payload: SettingsGetResponse): TValue {
  return payload.value as TValue
}

function extractFilePath(payload: ReferenceImagePickerResponse): string | null {
  return payload.filePath
}

function extractDataUrl(payload: ReferenceImageDataResponse): string | null {
  return payload.dataUrl
}

function extractCsvFilePath(payload: SourceCsvPickerResponse): string | null {
  return payload.filePath
}

function extractDatasourceJsonFilePath(payload: DatasourceJsonPickerResponse): string | null {
  return payload.filePath
}

function extractGraphicConfigImportFilePath(payload: GraphicConfigImportPickerResponse): string | null {
  return payload.filePath
}

function extractProfileConfigImportFilePath(payload: ProfileConfigImportPickerResponse): string | null {
  return payload.filePath
}

function extractGraphicConfigExportPath(payload: GraphicConfigExportResponse): string | null {
  return payload.filePath
}

function extractProfileConfigExportPath(payload: ProfileConfigExportResponse): string | null {
  return payload.filePath
}

function extractTextFileContent(payload: TextFileReadResponse): string | null {
  return payload.content
}

function extractOscSendResult(payload: OscSendResponse): OscTransportStage[] {
  if (!payload.ok) {
    const stageSummary = payload.stages.length > 0 ? ` [${payload.stages.join(' -> ')}]` : ''
    throw new Error(`${payload.error ?? 'OSC send failed'}${stageSummary}`)
  }

  return payload.stages
}

function extractDatasourceWriteResult(payload: DatasourceFileWriteResponse): void {
  if (!payload.ok) {
    throw new Error(payload.error ?? 'Datasource write failed')
  }
}
