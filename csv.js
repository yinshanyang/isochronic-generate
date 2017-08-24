const fs = require('fs')
const path = require('path')
const program = require('commander')

program
  .version(require('./package.json').version)
  .option('-p, --point-set', 'Path to source point set, `./data/point-set.geo.json`')
  .option('-i, --input', 'Path to computed contours, `./output/contours`')
  .option('-o, --output', 'Path to output this file, `./output/points.csv`')
  .parse(process.argv)

const POINT_SET = program.pointSet || './data/point-set.geo.json'
const INPUT = program.input || './output/contours'
const OUTPUT = program.output || './output/points.csv'

// main
const points = require(path.resolve(__dirname, POINT_SET))

const headers = ['index', 'lat', 'lon', 'data']
const body = points.features
  .map((feature, index) => ({
    index,
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
    data: fs.existsSync(`${path.resolve(__dirname, INPUT)}/${index}.geo.json`)
  }))
  .map((d) => headers.map((key) => d[key]))

const csv = [headers].concat(body)
  .map((row) => row.join(','))
  .join('\n')

fs.writeFileSync(path.resolve(__dirname, OUTPUT), csv)
