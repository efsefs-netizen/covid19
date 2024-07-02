const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null
let initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('The Server is running')
    })
  } catch (e) {
    console.log(e.message)
  }
}

initializeDBAndServer()

let convertTOCamelCase1 = state => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  }
}

//authentication
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET_KEY', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//api0
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}'
  `
  const isUserExist = await db.get(getUserQuery)
  if (isUserExist === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const getPassword = await bcrypt.compare(password, isUserExist.password)
    if (getPassword !== true) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'SECRET_KEY')
      response.send({jwtToken})
    }
  }
})

//api1
app.get('/states/', authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT * FROM state`
  const states = await db.all(getAllStatesQuery)
  response.send(
    states.map(eachState => {
      return convertTOCamelCase1(eachState)
    }),
  )
})

//api2
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const stateId = request.params.stateId
  const getAllStatesQuery = `
    SELECT * FROM state where state_id = ${stateId}`
  const state = await db.get(getAllStatesQuery)
  response.send({
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  })
})

//api3
app.post('/districts/', authenticateToken, (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createDistrictQuery = `
    INSERT INTO district(district_name,
                         state_id,
                         cases,
                         cured,
                         active,
                         deaths) 
      values
      ('${districtName}',${stateId},${cases},${cured},${active},${deaths})`
  db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

//api4
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const districtId = request.params.districtId
    const getDistrictQuery = `
    SELECT * FROM district where district_id = ${districtId}`
    const district = await db.get(getDistrictQuery)
    response.send({
      districtId: district.district_id,
      districtName: district.district_name,
      stateId: district.state_id,
      cases: district.cases,
      cured: district.cured,
      active: district.active,
      deaths: district.deaths,
    })
  },
)

//api5
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const districtId = request.params.districtId
    const getDistrictQuery = `
    DELETE FROM district where district_id = ${districtId}`
    await db.run(getDistrictQuery)
    response.send('District Removed')
  },
)

//api6
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const districtId = request.params.districtId
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const getDistrictQuery = `
    UPDATE district SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
     where district_id = ${districtId}`
    db.run(getDistrictQuery)
    response.send('District Details Updated')
  },
)

//api7
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const stateId = request.params.stateId
    const getAllStatesQuery = `
    SELECT SUM(cases) AS tcases,
           SUM(cured) AS tcured,
           SUM(active) AS tactive,
           sum(deaths) AS tdeaths
           FROM district where state_id = ${stateId}
           `
    const stats = await db.get(getAllStatesQuery)
    response.send({
      totalCases: stats.tcases,
      totalCured: stats.tcured,
      totalActive: stats.tactive,
      totalDeaths: stats.tdeaths,
    })
  },
)

//api8
app.get(
  '/districts/:districtId/details/',
  authenticateToken,
  async (request, response) => {
    const districtId = request.params.districtId
    const getDistrictQuery = `
    select state.state_name FROM district
    inner join state on state.state_id = district.state_id
     where district_id = ${districtId}`
    const district = await db.get(getDistrictQuery)
    response.send({
      stateName: district.state_name,
    })
  },
)

module.exports = app
