import apimock from './apimock.js'
import apiclient from './apiclientService.js'
import { USE_MOCK } from '../config.js'

const blueprintsService = USE_MOCK ? apimock : apiclient

export default blueprintsService
