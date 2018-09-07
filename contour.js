const fs = require('fs')
const path = require('path')
const { Observable } = require('rxjs')
const d3 = Object.assign(require('d3'), require('d3-contour'))
const turf = Object.assign(require('@turf/turf'), require('@turf/meta'))
const program = require('commander')
const json = require('node-json')

program
  .version(require('./package.json').version)
  .option('-P, --point-grid <path>', 'Path to source point grid, `./data/point-grid.geo.json`')
  .option('-i, --input <path>', 'Input directory of responses from OpenTripPlanner, `./output/raws`')
  .option('-o, --output <path>', 'Output directory,`./output/contours`')
  .option('-m, --minutes <value>', 'Number of minutes, `60`')
  .parse(process.argv)

const POINT_GRID = program.pointGrid || './data/point-grid.geo.json'
const INPUT = program.input || './output/raws'
const OUTPUT = program.output || './output/contours'
const MINUTES = program.minutes || 60

// derived constants
const WIDTH = require(path.resolve(__dirname, POINT_GRID)).properties.width
const HEIGHT = require(path.resolve(__dirname, POINT_GRID)).properties.height
const BBOX = turf.bbox(require(path.resolve(__dirname, POINT_GRID)))

// utils
const interpolate = ({ id, times: _times }) => {
  const OFFSET = 3
  const times = _times
    .map((time, index) => {
      const y = index % HEIGHT
      const x = ~~(index / HEIGHT)

      if (x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1 || time !== 2147483647) return time

      const kernel = [
        {x: -1, y: -1},
        {x: 0, y: -1},
        {x: 1, y: -1},
        {x: -1, y: 0},
        {x: 1, y: 0},
        {x: -1, y: 1},
        {x: 0, y: 1},
        {x: 1, y: 1}
      ]

      const neighbors = kernel
        .map(({ x, y }) => x * HEIGHT + y)
        .map((offset) => index + offset)
        .map((index) => _times[index])
        .filter((d) => d !== 2147483647)

      if (neighbors.length >= kernel.length - OFFSET) {
        const interpolation = Math.round(neighbors.reduce((memo, d) => memo + d, 0) / neighbors.length)
        return interpolation
      }

      return time
    })

  return { id, times }
}

const contour = ({ id, times }) => {
  // this data is height first
  const breaks = d3.range(0, -MINUTES * 60 - 1, -1 * 60)
  const contours = d3.contours()
    .size([HEIGHT, WIDTH])
    .thresholds(breaks)
  // I need to flip it at some point
  let isobands = contours(
    times.map((time) => -time)
  )
  isobands = isobands.map((isoband) => turf.feature(isoband, {time: -isoband.value}))
  isobands = turf.featureCollection(isobands)

  const mutate = (coords) => {
    // flip coords
    coords.reverse()

    // rescale
    const rangeX = BBOX[2] - BBOX[0]
    const rangeY = BBOX[3] - BBOX[1]

    coords[0] = (coords[0] - 0.5) / (WIDTH - 1) * rangeX + BBOX[0]
    coords[1] = (coords[1] - 0.5) / (HEIGHT - 1) * rangeY + BBOX[1]
  }
  turf.coordEach(isobands, (coords) => {
    mutate(coords)
  })
  isobands.features.reverse()

  return { id, isobands }
}

const saveOutput = ({ id, isobands }) =>
  json.format(`${path.resolve(__dirname, OUTPUT)}/${id}.geo.json`, isobands)

// main
const files = fs.readdirSync(path.resolve(__dirname, INPUT))

const stream$ = Observable.from(files)
  .map((file) => `${path.resolve(__dirname, INPUT)}/${file}`)
  .map(json.parse)
  .map(interpolate)
  .map(contour)
  .do(saveOutput)

stream$.subscribe(({ id }) => console.log(id))
