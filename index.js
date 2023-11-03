require('dotenv').config()
const mysql = require('mysql')
const axios = require('axios')
var colors = require('colors')


colors.enable()

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
  console.log('Iniciando monitoreo de energy24-7'.bgBlue)
  await conectarTPA()
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

async function getCustomersNews() {

  // Obtener la información del api

  await axios.get(`${api_url}/subgrupos`)
    .then(response => {
      const { data } = response
      console.log(`${data}`.bgGreen)
      
      if (data.lenght > 0) {
        const conexion = mysql.createConnection({
          host: data.terminal === 'TPA' ? dbHostTPA : dbHostIRGE,
          user: data.terminal === 'TPA' ? dbUserTPA : dbUserIRGE,
          password: data.terminal === 'TPA' ? dbPasswordTPA : dbPasswordIRGE,
          database: data.terminal === 'TPA' ? dbDatabaseTPA : dbDatabaseIRGE
        })
      
        conexion.connect((error) => {
          if (error) {
            console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
            return null
          }
          const idCompania = data.compania == 1 ? data.compania : 3
          const sql = `INSERT INTO subgrupos(id, orden, nombre, activo, compania, grupo)
                      VALUES('${data.clave}', 0, '${data.nombre}', 1, ${idCompania}, 1)`
          conexion.query(sql, (error, result) => {
            if (error) {
              console.error(`Error al realizar la inserción del subgrupo: ${error.stack}`.bgRed)
              return null
            }
            console.log(`Creado en subgrupos: ${result}`.bgGreen)
            const sql2 = `INSERT INTO nominaciones_orden(subgrupo, orden, color, textColor, label, button)
                          VALUES('${data.clave}', 0, '#D1D1D1', 'black','black','#B3AEAE')`
            conexion.query(sql2, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del subgrupo: ${error.stack}`.bgRed)
                return null
              }
              console.log(`Agregeado al grupo de nominaciones: ${result}`.bgGreen)
            })
            // Enviara actualización del id de subgrupo
            conexion.end()
          })
        })
      } else {
        console.log('No existen subgrupos nuevos.'.bgYellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
    })

    //

}


async function getNominaciones ()
{
  await axios.get(api_url)
    .then(response => {
      console.log(response.data)
    })
    .catch(error => {
      console.log(error)
    })
}

monitorearEnergy()