require('dotenv').config()
const mysql = require('mysql')
const axios = require('axios')

const port = process.env.PORT_DB_TPA
const dbHostTPA = process.env.HOST_DB_TPA
const dbUserTPA = process.env.USER_DB_TPA
const dbPasswordTPA = process.env.PASSWORD_DB_TPA
const dbDatabaseTPA = process.env.DB_TPA

const dbHostIRGE = process.env.HOST_DB_IRGE
const dbUserIRGE = process.env.USER_DB_IRGE
const dbPasswordIRGE = process.env.PASSWORD_DB_IRGE
const dbDatabaseIRGE = process.env.DB_IRGE


const api_url = process.env.API_URL

async function monitorearEnergy() {
  
  await getNominaciones()
  setTimeout(monitorearEnergy, 10000)
}


async function conectarTPA () {
  const conexion = mysql.createConnection({
    host: dbHostTPA,
    user: dbUserTPA,
    password: dbPasswordTPA,
    database: dbDatabaseTPA,
  })

  await conexion.connect((error) => {
    if (error) {
      console.error('Error al conectar a la base de datos: ' + error.stack)
      return null
    }
    
    conexion.query('SELECT * FROM llenaderas_web', (error, results, fields) => {
      if (error) {
        console.error('Error al realizar la consulta: ' + error.stack)
        return []
      }
      conexion.end()
      console.log(results)
    })
  })
}


async function conectarIRGE() {
  const conexion = mysql.createConnection({
    host: dbHostIRGE,
    user: dbUserIRGE,
    password: dbPasswordIRGE,
    database: dbDatabaseIRGE,
  })

  await conexion.connect((error) => {
    if (error) {
      console.error('Error al conectar a la base de datos: ' + error.stack)
      return null
    }
    
    conexion.query('SELECT * FROM llenaderas_web', (error, results, fields) => {
      if (error) {
        console.error('Error al realizar la consulta: ' + error.stack)
        return []
      }
      conexion.end()
      console.log(results)
    })
  })
}


async function getNominaciones ()
{
  console.log(`api_url: ${api_url}`)
  await axios.get(api_url)
    .then(response => {
      console.log(response.data)
    })
    .catch(error => {
      console.log(error)
    })
}

monitorearEnergy()