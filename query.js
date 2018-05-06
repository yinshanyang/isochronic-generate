const fs = require('fs')
const path = require('path')
const qs = require('querystring')
const axios = require('axios')
const { Observable } = require('rxjs')
const program = require('commander')
const json = require('node-json')

program
  .version(require('./package.json').version)
  .option('-p, --point-set <path>', 'Path to source point set, `./data/point-set.geo.json`')
  .option('-o, --output <path>', 'Output directory `./output/raws`')
  .option('-a, --api <value>', 'API endpoint')
  .option('-b, --banned <value>', 'Comma seperated list of banned routes, e.g. 1_EW,1_NE, defaults to none')
  .parse(process.argv)

const POINT_SET = program.pointSet || './data/point-set.geo.json'
const OUTPUT = program.output || './output/raws'
const API = program.api || 'http://192.168.33.10:8080/otp'
const BANNED = program.banned || ''

// utils
const createSurface = (point) => {
  const { lat, lon } = point
  const query = qs.stringify({
    batch: true,
    date: '04-30-2018',
    time: '12:00pm',
    styles: 'color30',
    cutoffMinutes: 360,
    maxWalkDistance: 50000,
    layers: 'traveltime',
    mode: 'TRANSIT,WALK',
    fromPlace: `${lat},${lon}`,
    toPlace: `${lat},${lon}`
  })

  return Observable.fromPromise(
    axios.request({
      method: 'post',
      url: `${API}/surfaces?${query}`
    })
  )
  .map(({ data }) => ({
    point,
    surface: data
  }))
  .catch(() => Observable.of(null))
}

const querySurface = ({ point, surface }) => {
  const { id } = surface
  const query = qs.stringify({
    targets: 'point-grid',
    detail: true
  })

  return Observable.fromPromise(
    axios.request({
      method: 'get',
      url: `${API}/surfaces/${id}/indicator?${query}`
    })
  )
  .map(({ data }) => ({
    point,
    surface,
    points: data
  }))
  .catch(() => Observable.of(null))
}

const formatResponse = ({ point, points: { times } }) =>
  Object.assign({}, point, { times })

const saveOutput = (data) => {
  json.write(`${path.resolve(__dirname, OUTPUT)}/${data.id}.json`, data)
  return data.id
}

// main
const points = require(path.resolve(__dirname, POINT_SET)).features
  .map((feature) => ({
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
    id: feature.properties.index
  }))

const surfaces$ = Observable.from(points)
  .concatMap((d) =>
    Observable.of(d)
      // create isosurface on opentripplanner
      .concatMap(createSurface)
      .filter((d) => d)
      .do(({ point }) => console.log(`created: ${point.id}`))
      // query for pointset
      .concatMap(querySurface)
      .filter((d) => d)
      .do(({ point }) => console.log(`queried: ${point.id}`))
  )
  // save pointset data
  .bufferCount(1)
  .map(([ data ]) => data)
  .map(formatResponse)
  .map(saveOutput)
  .do((id) => console.log(`saved:   ${id}`))

surfaces$.subscribe()
