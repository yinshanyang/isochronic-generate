const fs = require('fs')
const path = require('path')
const { Observable } = require('rxjs')
const turf = Object.assign(require('@turf/turf'), require('@turf/meta'))
const program = require('commander')
const json = require('node-json')

program
  .version(require('./package.json').version)
  .option('-p, --precision', 'number of decimal places, `6`')
  .option('-i, --input <path>', 'input directory of contours, `./output/contours`')
  .option('-o, --output <path>', 'output directory,`./output/contours`')
  .parse(process.argv)

const PRECISION = program.precision || 6
const INPUT = program.input || './output/contours'
const OUTPUT = program.output || './output/contours'

// utils
const quantize = (d) =>
  ~~(d * Math.pow(10, PRECISION)) / Math.pow(10, PRECISION)

const transform = (feature) => {
  turf.coordEach(feature, (coords) => {
    coords[0] = quantize(coords[0])
    coords[1] = quantize(coords[1])
  })
  return feature
}

const saveOutput = ({ id, isobands }) =>
  json.write(`${path.resolve(__dirname, OUTPUT)}/${id}.geo.json`, isobands)

// main
const files = fs.readdirSync(path.resolve(__dirname, INPUT))

const stream$ = Observable.from(files)
  .do((file) => {
    const input = `${path.resolve(__dirname, INPUT)}/${file}`
    const output = `${path.resolve(__dirname, OUTPUT)}/${file}`
    const feature = json.read(input)
    transform(feature)
    json.write(output, feature)
  })

stream$.subscribe(console.log.bind(console))
