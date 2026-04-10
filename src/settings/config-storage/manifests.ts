import defaultShowProfile from './profiles/default-news/profile.json'
import titleGraphicConfig from './graphics/title.json'
import personGraphicConfig from './graphics/person.json'
import locationGraphicConfig from './graphics/location.json'
import phoneGraphicConfig from './graphics/phone.json'
import imageGraphicConfig from './graphics/image.json'
import type { GraphicConfigManifest, ShowProfileManifest } from './contracts'

export const showProfiles = [defaultShowProfile] as ShowProfileManifest[]

export const graphicConfigManifests = [
  titleGraphicConfig,
  personGraphicConfig,
  locationGraphicConfig,
  phoneGraphicConfig,
  imageGraphicConfig,
] as GraphicConfigManifest[]
