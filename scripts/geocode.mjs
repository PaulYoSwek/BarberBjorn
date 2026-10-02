import { readFileSync, writeFileSync } from 'node:fs'

const token = process.env.VITE_MAPBOX_TOKEN
if (!token) {
  console.log('no token, keeping street-center pin')
  process.exit(0)
}

const address = 'Olivierstraat 20, 4571 AZ Axel'
const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`
const response = await fetch(url)
const data = await response.json()
const center = data.features?.[0]?.center
if (!center) {
  console.log('house not found, keeping street-center pin')
  process.exit(0)
}

const [lng, lat] = center
const file = 'src/pin.ts'
const source = readFileSync(file, 'utf8')
writeFileSync(file, source.replace(/lng: [^,]+, lat: [^ }]+/, `lng: ${lng}, lat: ${lat}`))
console.log(`pin set to ${lng}, ${lat}`)
