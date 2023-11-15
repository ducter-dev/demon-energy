require('dotenv').config()
const mysql = require('mysql')
const axios = require('axios')
var colors = require('colors')
const { subDays } = require('date-fns')
const format_date = require('date-fns/format')
const FormData = require('form-data')
const winston = require('winston')
const { format } = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')

// Configura el transportador para el registro de información diario
const infoTransport = new DailyRotateFile({
  filename: 'info_rdc-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  dirname: './logs'
})

// Configura el transportador para el registro de errores diario
const errorTransport = new DailyRotateFile({
  filename: 'error_rdc-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  dirname: './logs'
})

// Crea un registrador de Winston
const logger = winston.createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [infoTransport, errorTransport]
})

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

const id_user_reg = process.env.ID_USER_REG
const user_reg = process.env.USER_REG

const api_url = process.env.API_URL

/* 
  Obtener la data de la jornada anterior, se ejecutará todos los días a las 06:00
*/

async function getDataRDCTPA() {
  
  // Obtener la jornada del día anterior
  const fecha = new Date()
  const fechaReporte = format_date(subDays(fecha, 1), 'yyyy-MM-dd')

  console.log("🚀 ~ file: rdc.js:65 ~ getDataRDCTPA ~ fechaReporte:", fechaReporte)

  // Obtener la información de la terminal TPA

  const conexion = mysql.createConnection({
    host: dbHostTPA,
    user: dbUserTPA,
    password: dbPasswordTPA,
    database: dbDatabaseTPA,
  })

  conexion.connect((error) => {
    if (error) {
      console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
      logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
      return null
    }
  
    const sql = `SELECT e.noEmbarque, e.pg, FORMAT(e.presionTanque,1,0) AS presionTanque, 
      DATE_FORMAT(e.fechaSalida, '%H:%i') as fechaDoc, DATE_FORMAT(e.fechaSalida, '%Y-%m-%d %H:%i:%s') AS fechaSalida, e.nombreDestinatario, e.densidad AS densidad20, 
      emb.densidad_llenado as densidad,   e.nombrePorteador, e.compania AS idCompania, c.nombre AS compania, e.grupo, 
      e.subgrupo AS idSubgrupo, s.nombre AS subgrupo, FORMAT(e.masa, 0) AS masaStr, e.masa, e.volumen AS volumen20, 
      emb.volumen_llenado AS volumen, CONCAT(e.magnatel, '%') AS magnatel, e.presion, ROUND((e.masa / e.densidad)) AS litros, 
      DATE_FORMAT(emb.inicioCarga_llenado, '%H:%i') as inicioCarga, 
      DATE_FORMAT(emb.finCarga_llenado, '%H:%i') as finCarga, DATE_FORMAT(emb.finCarga_llenado, '%Y-%m-%d %H:%i:%s') AS finCarga_llenado,
      DATE_FORMAT(e.fechaJornada, '%Y-%m-%d') AS fechaJ, 
      IFNULL((SELECT DATE_FORMAT(fechaLlegada, '%H:%i') FROM accesos WHERE embarque = e.noEmbarque limit 1),'') AS fechaLlegada
      FROM entrada e
      INNER JOIN embarques emb ON e.NoEmbarque = emb.embarque
      INNER JOIN subgrupos s ON e.subgrupo = s.id
      INNER JOIN companias c ON e.compania = c.id
      WHERE e.fechaJornada = '${fechaReporte}' ORDER BY e.id ASC`
    
    conexion.query(sql, (error, results) => {
      if (error) {
        console.error(`Error al realizar la inserción del programa diaria: ${error.stack}`.bgRed)
        logger.error(`Error al realizar la inserción del programa diaria: ${error.stack}`)
        return null
      }
      const cargasPendientes = []
      const finalResults = []

      for (let index = 0; index < results.length; index++) {
        finalResults.push({...results[index]});
      }
      
      finalResults.forEach(carga => {
        if (carga.idCompania == 2) {
          const galones = parseFloat(parseInt(carga.masa) / parseFloat(carga.densidad20) * 0.264172)  
          carga.galones = galones
          carga.terminal_id = 1
          cargasPendientes.push(carga)
        }
      })
      
      // Enviara actualización del RDC por carga
      const url_rdc = `${api_url}/rdc`

      const jsonCargas = {
        meta_data: cargasPendientes
      }
      
      let config = {
        method: 'post',
        url: url_rdc,
        headers: { },
        data: jsonCargas
      }

      axios.request(config)
        .then( response => {
          console.log(`${response.data.message}`.bgGreen)
          logger.info(`${response.data.message}`)
        })
        .catch((error) => {
          console.log(`Error: ${error.message}`.bgRed)
          logger.error(`Error: ${error.message}`)
        })
        
      
    })
    conexion.end()
  })
}

async function getDataRDCIRGE() {
  
  // Obtener la jornada del día anterior
  const fecha = new Date()
  const fechaReporte = format_date(subDays(fecha, 1), 'yyyy-MM-dd')

  console.log("🚀 ~ file: rdc.js:65 ~ getDataRDCIRGE ~ fechaReporte:", fechaReporte)

  // Obtener la información de la terminal TPA

  const conexion = mysql.createConnection({
    host: dbHostIRGE,
    user: dbUserIRGE,
    password: dbPasswordIRGE,
    database: dbDatabaseIRGE,
  })

  conexion.connect((error) => {
    if (error) {
      console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
      logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
      return null
    }
  
    const sql = `SELECT e.noEmbarque, e.pg, FORMAT(e.presionTanque,1,0) AS presionTanque, 
      DATE_FORMAT(e.fechaSalida, '%H:%i') as fechaDoc, DATE_FORMAT(e.fechaSalida, '%Y-%m-%d %H:%i:%s') AS fechaSalida, e.nombreDestinatario, e.densidad AS densidad20, 
      emb.densidad_llenado as densidad,   e.nombrePorteador, e.compania AS idCompania, c.nombre AS compania, e.grupo, 
      e.subgrupo AS idSubgrupo,   s.nombre AS subgrupo, FORMAT(e.masa, 0) AS masaStr, e.masa, e.volumen AS volumen20, 
      emb.volumen_llenado AS volumen, CONCAT(e.magnatel, '%') AS magnatel, e.presion, ROUND((e.masa / e.densidad)) AS litros, 
      DATE_FORMAT(emb.inicioCarga_llenado, '%H:%i') as inicioCarga, 
      DATE_FORMAT(emb.finCarga_llenado, '%H:%i') as finCarga, DATE_FORMAT(emb.finCarga_llenado, '%Y-%m-%d %H:%i:%s') AS finCarga_llenado,
      DATE_FORMAT(e.fechaJornada, '%Y-%m-%d') AS fechaJ, 
      IFNULL((SELECT DATE_FORMAT(fechaLlegada, '%H:%i') FROM accesos WHERE embarque = e.noEmbarque limit 1),'') AS fechaLlegada
      FROM entrada e
      INNER JOIN embarques emb ON e.NoEmbarque = emb.embarque
      INNER JOIN subgrupos s ON e.subgrupo = s.id
      INNER JOIN companias c ON e.compania = c.id
      WHERE e.fechaJornada = '${fechaReporte}' 
      ORDER BY e.id ASC`

    console.log("🚀 ~ file: rdc.js:150 ~ conexion.connect ~ sql:", sql)
  
    conexion.query(sql, (error, results) => {
      if (error) {
        console.error(`Error al realizar la inserción del programa diaria: ${error.stack}`.bgRed)
        logger.error(`Error al realizar la inserción del programa diaria: ${error.stack}`)
        return null
      }
      const cargasPendientes = []
      const finalResults = []

      for (let index = 0; index < results.length; index++) {
        finalResults.push({...results[index]});
      }
      
      finalResults.forEach(carga => {
        if (carga.idCompania == 2) {
          const galones = parseFloat(parseInt(carga.masa) / parseFloat(carga.densidad20) * 0.264172)  
          carga.galones = galones
          carga.terminal_id = 2
          cargasPendientes.push(carga)
        }
      })
      
      // Enviara actualización del RDC por carga
      const url_rdc = `${api_url}/rdc`

      const jsonCargas = {
        meta_data: cargasPendientes
      }
      
      let config = {
        method: 'post',
        url: url_rdc,
        headers: { },
        data: jsonCargas
      }

      axios.request(config)
        .then( response => {
          console.log(`${response.data.message}`.bgGreen)
          logger.info(`${response.data.message}`)
        })
        .catch((error) => {
          console.log(`Error: ${error.message}`.bgRed)
          logger.error(`Error: ${error.message}`)
        })
        
      
    })
    conexion.end()
  })
}



getDataRDCIRGE()