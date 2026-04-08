import defaultShowProfile from './profiles/default-news/profile.json'
import titleGraphicConfig from './graphics/title.json'
import personGraphicConfig from './graphics/person.json'
import locationGraphicConfig from './graphics/location.json'
import phoneGraphicConfig from './graphics/phone.json'
import staticImageGraphicConfig from './graphics/staticImage.json'
import type { GraphicConfigManifest, ShowProfileManifest } from './contracts'

export const showProfiles = [defaultShowProfile] as ShowProfileManifest[]

export const graphicConfigManifests = [
  titleGraphicConfig,
  personGraphicConfig,
  locationGraphicConfig,
  phoneGraphicConfig,
  staticImageGraphicConfig,
] as GraphicConfigManifest[]
