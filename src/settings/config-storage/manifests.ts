import defaultShowProfile from './profiles/default-news/profile.json'
import titleGraphicConfig from './graphics/title.json'
import supertitleGraphicConfig from './graphics/supertitle.json'
import personGraphicConfig from './graphics/person.json'
import locationGraphicConfig from './graphics/location.json'
import breakingNewsGraphicConfig from './graphics/breakingNews.json'
import waitingTitleGraphicConfig from './graphics/waitingTitle.json'
import waitingLocationGraphicConfig from './graphics/waitingLocation.json'
import phoneGraphicConfig from './graphics/phone.json'
import type { GraphicConfigManifest, ShowProfileManifest } from './contracts'

export const showProfiles = [defaultShowProfile] as ShowProfileManifest[]

export const graphicConfigManifests = [
  titleGraphicConfig,
  supertitleGraphicConfig,
  personGraphicConfig,
  locationGraphicConfig,
  breakingNewsGraphicConfig,
  waitingTitleGraphicConfig,
  waitingLocationGraphicConfig,
  phoneGraphicConfig,
] as GraphicConfigManifest[]
