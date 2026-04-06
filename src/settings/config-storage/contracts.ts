export interface ShowProfileManifest {
  id: string
  label: string
  supportedEntityTypes: string[]
  graphicConfigIds: string[]
}

export interface GraphicConfigManifest {
  id: string
  entityType: string
  path: string
}
