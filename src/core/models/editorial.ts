// A CSV row is only an input detail. The domain starts at block-level collections,
// so row-shaped structures must not be promoted to domain entities.
export interface TitleEntity {
  id: string
  number?: string
  text: string
}

export interface PersonEntity {
  name: string
  role?: string
}

export interface TextValueEntity {
  value: string
}

export interface PhoneEntity {
  label: string
  number: string
}

export interface GraphicConfigEntityItem {
  [field: string]: string
}

export type GraphicConfigEntityCollections = Record<string, GraphicConfigEntityItem[]>

// Each block owns independent ordered collections grouped by entity type.
// Collection order is preserved from source data, but cross-type relationships
// must not be inferred from source row positions.
export interface EditorialBlock {
  name: string
  titles: TitleEntity[]
  persons: PersonEntity[]
  locations: TextValueEntity[]
  phones: PhoneEntity[]
  entityCollections?: GraphicConfigEntityCollections
}

export interface EditorialDocument {
  blocks: EditorialBlock[]
}
