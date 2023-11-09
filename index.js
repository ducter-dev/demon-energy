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
  filename: 'info-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  dirname: './logs'
})

// Configura el transportador para el registro de errores diario
const errorTransport = new DailyRotateFile({
  filename: 'error-%DATE%.log',
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

/**
 * Monitors energy24-7.
 *
 * @return {Promise<void>} Returns a promise that resolves when the monitoring is complete.
 */
async function monitorearEnergy() {
  console.log('🚀 Iniciando monitoreo de energy24-7'.bgBlue)
  logger.info('🚀 Iniciando monitoreo de energy24-7')
  await getCustomersNews()
  setTimeout(monitorearEnergy, 60000)
}

/**
 * Retrieves the latest news about customers from the API.
 *
 * @return {Promise} A promise that resolves with the latest customer news.
 */
async function getCustomersNews() {

  // Obtener la información del api
  const url_subgroups = `${api_url}/subgroups`
  
  await axios.get(url_subgroups)
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {

        data.forEach(async (subgrupo) => {
          console.log(`Registrando subgrupo ${subgrupo.nombre}`.bgGreen)

          const conexion = mysql.createConnection({
            host: subgrupo.terminal === 'TPA' ? dbHostTPA : dbHostIRGE,
            user: subgrupo.terminal === 'TPA' ? dbUserTPA : dbUserIRGE,
            password: subgrupo.terminal === 'TPA' ? dbPasswordTPA : dbPasswordIRGE,
            database: subgrupo.terminal === 'TPA' ? dbDatabaseTPA : dbDatabaseIRGE
          })
        
          conexion.connect((error) => {
            if (error) {
              console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
              logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
              return null
            }
            const idCompania = subgrupo.compania == 1 ? subgrupo.compania : 3
            const sql = `INSERT INTO subgrupos(id, orden, nombre, activo, compania, grupo)
                        VALUES('${subgrupo.clave}', 0, '${subgrupo.nombre}', 1, ${idCompania}, 1)`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del subgrupo: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del subgrupo: ${error.stack}`)
                return null
              }
              console.log(`Creado en subgrupos: ${subgrupo.nombre}`.bgGreen)
              const sql2 = `INSERT INTO nominaciones_orden(subgrupo, orden, color, textColor, label, button)
                            VALUES('${subgrupo.clave}', 0, '#D1D1D1', 'black','black','#B3AEAE')`
              
              conexion.query(sql2, (error, result) => {
                if (error) {
                  console.error(`Error al realizar la inserción del subgrupo: ${error.stack}`.bgRed)
                  logger.error(`Error al realizar la inserción del subgrupo: ${error.stack}`)
                  return null
                }
                console.log(`Subgrupo agregado al grupo de nominaciones: ${subgrupo.nombre}`.bgGreen)
                logger.info(`Subgrupo agregado al grupo de nominaciones: ${subgrupo.nombre}`)
              })

              conexion.end()

              // Enviara actualización del id de subgrupo
              const url_update_subgroup = `${api_url}/subgroups`
              let dataForm = new FormData()
              dataForm.append('indentifier', subgrupo.ID)

              let config = {
                method: 'post',
                url: url_update_subgroup,
                headers: {
                  ...dataForm.getHeaders()
                },
                data: dataForm
              }

              axios.request(config)
                .then( response => {
                  console.log(`${response.data.message}`.bgGreen)
                  logger.info(`${response.data.message}`)
                })
                .catch((error) => {
                  console.log(`Error: ${error}`.bgRed)
                  logger.error(`Error: ${error}`)
                })
            })
          })
        })

      } else {
        console.log('No existen subgrupos nuevos.'.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })

  // Obtener operadores nuevos
  await getOperatorsNews()

}


/**
 * Retrieves the latest news from the operators API and registers them in the database.
 *
 * @return {Promise<void>} This function does not return anything.
 */
async function getOperatorsNews() {
  // Obtener la información del api tpa
  const url_tpa = `${api_url}/operators?terminal=tpa` 

  await axios.get(url_tpa)
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {

        data.forEach(operator => {
          console.log(`Registrando operator ${operator.nombre} en TPA`.bgGreen)
          
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
            }
            const sql = `INSERT INTO operador(id_operador, nombre_operador, grupo, telefonoOperador, identificacion)
                        VALUES('${operator.ID}', '${operator.nombre}', 'Nieto', '', '${operator.clave_elector}')`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del operador: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del operador: ${error.stack}`)
                return null
              }
              console.log(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
              logger.info(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`)
              conexion.end()

              // Enviara actualización del id de operador
              const url_update_operator = `${api_url}/operators`
              let dataForm = new FormData()
              dataForm.append('indentifier', operator.ID)
              dataForm.append('terminal', 'tpa')

              let config = {
                method: 'post',
                url: url_update_operator,
                headers: {
                  ...dataForm.getHeaders()
                },
                data: dataForm
              }

              axios.request(config)
                .then( response => {
                  console.log(`${response.data.message}`.bgGreen)
                  logger.info(`${response.data.message}`)
                })
                .catch((error) => {
                  console.log(`Error: ${error}`.bgRed)
                  logger.error(`Error: ${error}`)
                })
            })
          })
        })

        // Actualizar Autotanques
      } else {
        console.log('No existen operadores nuevos en TPA.'.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })


  // Obtener la información del api irge
  const url_irge = `${api_url}/operators?terminal=irge` 
  
  await axios.get(url_irge)
  .then(response => {
    const { data } = response.data
    
    if (data.length > 0) {

      data.forEach(operator => {
        console.log(`Registrando operator ${operator.nombre} en IRGE`.bgGreen)

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
          const sql = `INSERT INTO operador(id_operador, nombre_operador, grupo, telefonoOperador, identificacion)
                      VALUES('${operator.ID}', '${operator.nombre}', 'Nieto', '', '${operator.clave_elector}')`
          conexion.query(sql, (error, result) => {
            if (error) {
              console.error(`Error al realizar la inserción del operador: ${error.stack}`.bgRed)
              logger.error(`Error al realizar la inserción del operador: ${error.stack}`)
              return null
            }
            console.log(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
            logger.info(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`)
            conexion.end()

            // Enviara actualización del id de operador
            const url_update_operator = `${api_url}/operators`
            let dataForm = new FormData()
            dataForm.append('indentifier', operator.ID)
            dataForm.append('terminal', 'irge')

            let config = {
              method: 'post',
              url: url_update_operator,
              headers: {
                ...dataForm.getHeaders()
              },
              data: dataForm
            }

            axios.request(config)
              .then( response => {
                console.log(`${response.data.message}`.bgGreen)
                logger.info(`${response.data.message}`)
              })
              .catch((error) => {
                console.log(`Error: ${error}`.bgRed)
                logger.error(`Error: ${error}`)
              })
          })
        })
      })
      
      // Actualizar Autotanques
    } else {
      console.log('No existen operadores nuevos en IRGE.'.yellow)
    }
  })
  .catch(error => {
    console.log(`Error: ${error}`.bgRed)
    logger.error(`Error: ${error}`.bgRed)
  })
  

  await getEquipmentsNewsTPA()
}


/**
 * Retrieves the latest information about equipments from the API and registers them in the database.
 *
 * @return {Promise<void>} A Promise that resolves when the function completes.
 */
async function getEquipmentsNewsTPA() {
  // Obtener la información del api tpa
  const url_equipments = `${api_url}/equipments?terminal=tpa` 
  const idBase = 2650

  await axios.get(url_equipments)
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {

        data.forEach(equipment => {
          console.log(`Registrando autotanque ${equipment.nombre} en TPA`.bgGreen)
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
            }
            const sql = `INSERT INTO autotanques(SbiID, pg, capacidad, placa, embarque, fechaMod, idCRE)
                        VALUES('${idBase + equipment.ID}', '${equipment.pg}','${equipment.capacidad}', '${equipment.placa}', 0, '${equipment.fecha_creacion}', '${equipment.idCRE}')`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del autotanque: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del autotanque: ${error.stack}`)
              }
              console.log(`Ha sido registrado autotanque ${equipment.pg} en la terminal TPA`.bgGreen)
              logger.info(`Ha sido registrado autotanque ${equipment.pg} en la terminal TPA`)
              conexion.end()
              
              // Enviara actualización del id de operador
              const url_update_equipment = `${api_url}/equipments`
              let dataForm = new FormData()
              dataForm.append('indentifier', equipment.ID)
              dataForm.append('terminal', 'tpa')

              let config = {
                method: 'post',
                url: url_update_equipment,
                headers: {
                  ...dataForm.getHeaders()
                },
                data: dataForm
              }

              axios.request(config)
                .then( response => {
                  console.log(`${response.data.message}`.bgGreen)
                  logger.info(`${response.data.message}`)
                })
                .catch((error) => {
                  console.log(`Error: ${error}`.bgRed)
                  logger.error(`Error: ${error}`)
                })
            })
          })
        })

        
      } else {
        console.log('No existen autotanques nuevos en TPA.'.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })
  await getEquipmentsNewsIRGE()
}

async function getEquipmentsNewsIRGE() {
  // Obtener la información del api irge
  const url_equipments = `${api_url}/equipments?terminal=irge` 
  const idBase = 2650
  
  await axios.get(url_equipments)
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {

        data.forEach(equipment => {
          console.log(`Registrando autotanque ${equipment.nombre}`.bgGreen)
          
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
            }
            const sql = `INSERT INTO autotanques(SbiID, pg, capacidad, placa, embarque, fechaMod, idCRE)
                        VALUES('${idBase + equipment.ID}', '${equipment.pg}','${equipment.capacidad}', '${equipment.placa}', 0, '${equipment.fecha_creacion}', '${equipment.idCRE}')`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del autotanque: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del autotanque: ${error.stack}`)
              }
              console.log(`Ha sido registrado autotanque ${equipment.pg} en la terminal IRGE`.bgGreen)
              logger.error(`Ha sido registrado autotanque ${equipment.pg} en la terminal IRGE`)
              conexion.end()

              // Enviara actualización del id de operador
              const url_update_equipment = `${api_url}/equipments`
              let dataForm = new FormData()
              dataForm.append('indentifier', equipment.ID)
              dataForm.append('terminal', 'irge')

              let config = {
                method: 'post',
                url: url_update_equipment,
                headers: {
                  ...dataForm.getHeaders()
                },
                data: dataForm
              }

              axios.request(config)
                .then( response => {
                  console.log(`${response.data.message}`.bgGreen)
                  logger.info(`${response.data.message}`)
                })
                .catch((error) => {
                  console.log(`Error: ${error}`.bgRed)
                  logger.error(`Error: ${error}`)
                })
            })
          })
        })

        // Actualizar Autotanques
      } else {
        console.log('No existen autotanques nuevos en IRGE.'.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })

  await getNominations()
}


/**
 * Retrieves nominations from the API and inserts them into the database.
 *
 * @return {Promise<void>} Returns a Promise that resolves when the function completes.
 */
async function getNominations ()
{
  // Obtener la información del api
  const url_nominations = `${api_url}/nominations`
  
  await axios.get(url_nominations)
    .then(response => {
      const { data } = response.data

      if (data.length > 0) {

        data.forEach(nomination => {

          // Ver si tiene nominacion en TPA
          if (nomination.volumen_tpa > 0) {
            console.log(`Registrando nominación mensual en TPA con id: ${nomination.ID}`.yellow)
            const conexionTPA = mysql.createConnection({
              host: dbHostTPA,
              user: dbUserTPA,
              password: dbPasswordTPA,
              database: dbDatabaseTPA,
            })
            const anioTPA = parseInt(nomination.fecha_final.substr(0,4))
            const monthTPA = nomination.fecha_final.substr(5,2)
            const subgrupoTPA = nomination.subgrupos.find( s => s.terminal === 'TPA')
            
            if (subgrupoTPA) {
              conexionTPA.connect((error) => {
                if (error) {
                  console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
                  logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
                  return null
                }
                
                const sql = `INSERT INTO nominacion_mensual(unidadNeg, anio, mes, nominacion)
                            VALUES('${subgrupoTPA.clave}', ${anioTPA}, '${monthTPA}', ${nomination.volumen_tpa})`
                console.log("🚀 ~ file: index.js:527 ~ conexionTPA.connect ~ sql:", sql)
                            
                
                conexionTPA.query(sql, (error, result) => {
                  if (error) {
                    console.error(`Error al realizar la inserción de la nominación mensual: ${error.stack}`.bgRed)
                    logger.error(`Error al realizar la inserción de la nominación mensual: ${error.stack}`)
                    return null
                  }
                  console.log(`Agregado a las nominaciones mensuales TPA: ${nomination.ID} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                  logger.info(`Agregado a las nominaciones mensuales TPA: ${nomination.ID} - subgrupo: ${subgrupoTPA.clave}`)
                  nomination.nominacion_diaria.forEach(nomDay => {
                    
                    const sql2 = `INSERT INTO nominaciones(unidadNeg, nominacion, fecha_nominacion)
                                  VALUES('${subgrupoTPA.clave}', ${parseInt(nomDay.TPA)}, '${nomDay.fecha}')`
                    console.log("🚀 ~ file: index.js:544 ~ conexionTPA.query ~ sql2:", sql2)
                                  
                    conexionTPA.query(sql2, (error, result) => {
                      if (error) {
                        console.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`.bgRed)
                        logger.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`)
                        return null
                      }
                      console.log(`Agregado a las nominaciones diarias TPA: ID: ${nomDay.ID_DIA} - ${nomDay.fecha} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                      logger.info(`Agregado a las nominaciones diarias TPA: ID: ${nomDay.ID_DIA} - ${nomDay.fecha} - subgrupo: ${subgrupoTPA.clave}`)
                      

                      // Enviara actualización del id de nominación
                      const url_update_daily_nomination = `${api_url}/daily_nominations`
                      let dataForm = new FormData()
                      dataForm.append('indentifier', nomDay.ID_DIA)

                      let configDaily = {
                        method: 'post',
                        url: url_update_daily_nomination,
                        headers: {
                          ...dataForm.getHeaders()
                        },
                        data: dataForm
                      }
                      axios.request(configDaily)
                        .then( response => {
                          console.log(`${response.data.message}`.bgGreen)
                          logger.info(`${response.data.message}`)
                        })
                        .catch((error) => {
                          console.log(`Error: ${error}`.bgRed)
                          logger.error(`Error: ${error}`)
                        })
                    })

                  })
                  conexionTPA.end()
                  // Enviara actualización del id de nominación
                  const url_update_nomination = `${api_url}/nominations`
                  let dataForm = new FormData()
                  dataForm.append('indentifier', nomination.ID)

                  let config = {
                    method: 'post',
                    url: url_update_nomination,
                    headers: {
                      ...dataForm.getHeaders()
                    },
                    data: dataForm
                  }

                  axios.request(config)
                    .then( response => {
                      console.log(`${response.data.message}`.bgGreen)
                      logger.info(`${response.data.message}`)
                    })
                    .catch((error) => {
                      console.log(`Error: ${error}`.bgRed)
                      logger.error(`Error: ${error}`)
                    })
                })
                conexionTPA.end()
              })
            } else {
              console.log('Error: subgrupo vacío en TPA.'.bgRed)
              logger.error('Error: subgrupo vacío en TPA.')
            }
          }

          if (nomination.volumen_dda > 0) {
            console.log(`Registrando nominación mensual en IRGE con id: ${nomination.ID}`.yellow)
            const conexionIRGE= mysql.createConnection({
              host: dbHostIRGE,
              user: dbUserIRGE,
              password: dbPasswordIRGE,
              database: dbDatabaseIRGE,
            })

            const anioIRGE = parseInt(nomination.fecha_final.substr(0,4))
            const monthIRGE = nomination.fecha_final.substr(5,2)
            const subgrupoIRGE = nomination.subgrupos.find( s => s.terminal === 'DDA')
            if (subgrupoIRGE) {
              conexionIRGE.connect((error) => {
                if (error) {
                  console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
                  logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
                  return null
                }
                
                const sql = `INSERT INTO nominacion_mensual(unidadNeg, anio, mes, nominacion)
                            VALUES('${subgrupoIRGE.clave}', ${anioIRGE}, '${monthIRGE}', ${nomination.volumen_dda})`

                console.log("🚀 ~ file: index.js:633 ~ conexionIRGE.connect ~ sql:", sql)
                console.log(`Agregado a las nominaciones mensuales IRGE: ${nomination.ID} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)
                logger.info(`Agregado a las nominaciones mensuales IRGE: ${nomination.ID} - subgrupo: ${subgrupoIRGE.clave}`)
                conexionIRGE.query(sql, (error, result) => {
                  if (error) {
                    console.error(`Error al realizar la inserción de la nominación: ${error.stack}`.bgRed)
                    logger.error(`Error al realizar la inserción de la nominación: ${error.stack}`)
                    return null
                  }
                  
                  nomination.nominacion_diaria.forEach(nomDay => {
    
                    const sql2 = `INSERT INTO nominaciones(unidadNeg, nominacion, fecha_nominacion)
                                  VALUES('${subgrupoIRGE.clave}', ${parseInt(nomDay.DDA)}, '${nomDay.fecha}')`
                    console.log(`🚀 ~ file: index.js:642 ~ conexionIRGE.query ~ sql2: ${sql2}`.cyan)
                                  
                    conexionIRGE.query(sql2, (error, result) => {
                      if (error) {
                        console.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`.bgRed)
                        logger.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`)
                        return null
                      }
                      console.log(`Agregado a las nominaciones diarias IRGE: ID: ${nomDay.ID_DIA} - ${nomDay.fecha} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)
                      logger.info(`Agregado a las nominaciones diarias IRGE: ID: ${nomDay.ID_DIA} - ${nomDay.fecha} - subgrupo: ${subgrupoIRGE.clave}`)

                      // Enviara actualización del id de nominación
                      const url_update_daily_nomination = `${api_url}/daily_nominations`
                      let dataForm = new FormData()
                      dataForm.append('indentifier', nomDay.ID_DIA)

                      let configDaily = {
                        method: 'post',
                        url: url_update_daily_nomination,
                        headers: {
                          ...dataForm.getHeaders()
                        },
                        data: dataForm
                      }

                      axios.request(configDaily)
                        .then( response => {
                          console.log(`${response.data.message}`.bgGreen)
                          logger.info(`${response.data.message}`)
                        })
                        .catch((error) => {
                          console.log(`Error: ${error}`.bgRed)
                          logger.error(`Error: ${error}`)
                        })
                    })
                  })
    
                  // Enviara actualización del id de subgrupo
                  const url_update_nomination = `${api_url}/nominations`
                  let dataForm = new FormData()
                  dataForm.append('indentifier', nomination.ID)

                  let config = {
                    method: 'post',
                    url: url_update_nomination,
                    headers: {
                      ...dataForm.getHeaders()
                    },
                    data: dataForm
                  }

                  axios.request(config)
                    .then( response => {
                      console.log(`${response.data.message}`.bgGreen)
                      logger.info(`${response.data.message}`)
                    })
                    .catch((error) => {
                      console.log(`Error: ${error}`.bgRed)
                      logger.error(`Error: ${error}`)
                    })
                    conexionIRGE.end()
                })
              })
            } else {
              console.log('Error: subgrupo vacío en IRGE.'.bgRed)
              logger.error('Error: subgrupo vacío en IRGE.')
            }
          }
        })
        
      } else {
        console.log('No existen las nominaciones mensuales nuevas.'.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })
  await getDailyNominations()
}

/**
 * Retrieves the daily nominations from the API and updates the corresponding records in the database.
 *
 * @return {Promise<void>} A Promise that resolves when the nominations have been updated.
 */
async function getDailyNominations()
{
  const url_nominations = `${api_url}/daily_nominations`

  await axios.get(url_nominations)
    .then(response => {
      const { data } = response.data

      if (data.length > 0) {
        data.forEach(daily_nom => {
          console.log(`Registrando nominación diaria con id: ${daily_nom.ID}`.yellow)
          
          // TPA
          const conexionTPA = mysql.createConnection({
            host: dbHostTPA,
            user: dbUserTPA,
            password: dbPasswordTPA,
            database: dbDatabaseTPA,
          })

          const subgrupoTPA = daily_nom.subgrupos.find( s => s.terminal === 'TPA')

          if (subgrupoTPA) {
            conexionTPA.connect((error) => {
              if (error) {
                console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
                logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
                return null
              }

              const sql = `UPDATE nominaciones SET nominacion = ${parseInt(daily_nom.volumen_tpa)} WHERE unidadNeg='${subgrupoTPA.clave}' AND fecha_nominacion='${daily_nom.fecha}'`
                                  
              conexionTPA.query(sql, (error, result) => {
                if (error) {
                  console.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`.bgRed)
                  logger.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`)
                  return null
                }
                console.log(`Actualizada a las nominación diaria TPA: ${daily_nom.fecha} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                logger.info(`Actualizada a las nominación diaria TPA: ${daily_nom.fecha} - subgrupo: ${subgrupoTPA.clave}`)
                conexionTPA.end()

                const url_update_nomination = `${api_url}/daily_nominations`
                  let dataForm = new FormData()
                  dataForm.append('indentifier', daily_nom.ID)

                  let config = {
                    method: 'post',
                    url: url_update_nomination,
                    headers: {
                      ...dataForm.getHeaders()
                    },
                    data: dataForm
                  }

                  axios.request(config)
                    .then( response => {
                      console.log(`${response.data.message}`.bgGreen)
                      logger.info(`${response.data.message}`)
                    })
                    .catch((error) => {
                      console.log(`Error: ${error}`.bgRed)
                      logger.error(`Error: ${error}`)
                    })
              })
            })
          }  else {
            console.log('Error: Nominaciones Diarias subgrupo vacío en TPA.'.bgRed)
            logger.error('Error: Nominaciones Diarias subgrupo vacío en TPA.')
          }

          // IRGE
          const conexionIRGE = mysql.createConnection({
            host: dbHostIRGE,
            user: dbUserIRGE,
            password: dbPasswordIRGE,
            database: dbDatabaseIRGE,
          })

          const subgrupoIRGE = daily_nom.subgrupos.find( s => s.terminal === 'DDA')

          if (subgrupoIRGE) {
            conexionIRGE.connect((error) => {
              if (error) {
                console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
                logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
                return null
              }

              const sql = `UPDATE nominaciones SET nominacion = ${parseInt(daily_nom.volumen_dda)} WHERE unidadNeg='${subgrupoIRGE.clave}' AND fecha_nominacion='${daily_nom.fecha}'`
                                  
              conexionIRGE.query(sql, (error, result) => {
                if (error) {
                  console.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`.bgRed)
                  logger.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`)
                  return null
                }
                console.log(`Actualizada a las nominación diaria IRGE: ${daily_nom.fecha} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)
                logger.info(`Actualizada a las nominación diaria IRGE: ${daily_nom.fecha} - subgrupo: ${subgrupoIRGE.clave}`)
                conexionIRGE.end()

                const url_update_nomination = `${api_url}/daily_nominations`
                let dataForm = new FormData()
                dataForm.append('indentifier', daily_nom.ID)

                let config = {
                  method: 'post',
                  url: url_update_nomination,
                  headers: {
                    ...dataForm.getHeaders()
                  },
                  data: dataForm
                }

                axios.request(config)
                  .then( response => {
                    console.log(`${response.data.message}`.bgGreen)
                    logger.info(`${response.data.message}`)
                  })
                  .catch((error) => {
                    console.log(`Error: ${error}`.bgRed)
                    logger.error(`Error: ${error}`)
                  })
              })
            })
          }  else {
            console.log('Error: subgrupo vacío en IRGE.'.bgRed)
            logger.error('Error: subgrupo vacío en IRGE.')
          }
        })
      } else {
        console.log('No existen las nominaciones diarias actualizadas.'.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })

  await getProgramTPA()
}


/**
 * Retrieves the program TPA from the API and inserts it into the database.
 *
 * @return {Promise<void>} - A promise that resolves when the program TPA is retrieved and inserted.
 */
async function getProgramTPA()
{
  const url_program = `${api_url}/programs?terminal=tpa`

  await axios.get(url_program)
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {
        
        data.forEach(program => {
          const conexion = mysql.createConnection({
            host: dbHostTPA,
            user: dbUserTPA,
            password: dbPasswordTPA,
            database: dbDatabaseTPA,
          })

          const fecha = new Date()
          const fechaFormateada = format_date(fecha, 'yyyy-MM-dd HH:mm:ss')
          const fechaReporte = getDateReport(fechaFormateada)
          const subgrupo = program.subgrupos.find( s => s.terminal === 'TPA')

          conexion.connect((error) => {
            if (error) {
              console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
              logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
              return null
            }
  
            const sql = `INSERT INTO accesos (claveAcceso, fechaLlegada, embarque, estado, presion, fechaReporte, pg, idUser_reg, usuario_reg, subgrupo, programa, id_programa_energy)
                        VALUES ('${program.clave}', '${fechaFormateada}', 0, 1, 0, '${fechaReporte}', '${program.pg}', '${id_user_reg}', '${user_reg}', '${subgrupo.clave}', 1, ${program.ID})`
            console.log("🚀 ~ file: index.js:912 ~ conexion.connect ~ sql:", sql)
                                
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del programa diaria: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del programa diaria: ${error.stack}`)
                return null
              }
              console.log(`Se insertó la programación en TPA: ${program.pg} - subgrupo: ${subgrupo.clave}`.bgGreen)
              logger.info(`Se insertó la programación en TPA: ${program.pg} - subgrupo: ${subgrupo.clave}`)
              

              const url_update_program = `${api_url}/programs`
                let dataForm = new FormData()
                dataForm.append('indentifier', program.ID)

                let config = {
                  method: 'post',
                  url: url_update_program,
                  headers: {
                    ...dataForm.getHeaders()
                  },
                  data: dataForm
                }

                axios.request(config)
                  .then( response => {
                    console.log(`${response.data.message}`.bgGreen)
                    logger.info(`${response.data.message}`)
                  })
                  .catch((error) => {
                    console.log(`Error: ${error}`.bgRed)
                    logger.error(`Error: ${error}`)
                  })
            })
            conexion.end()
          })
        })
      }  else {
        console.log(`No hay programas nuevos en TPA`.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })
  await getProgramIRGE()
}


/**
 * Retrieves the program from the API and inserts it into the database.
 *
 * @return {Promise<void>} Returns a promise that resolves when the program is successfully inserted into the database.
 */
async function getProgramIRGE()
{
  const url_program = `${api_url}/programs?terminal=irge`

  await axios.get(url_program)
    .then(response => {
      const { data } = response.data
      
      
      if (data.length > 0) {
        
        data.forEach(program => {
          const conexion = mysql.createConnection({
            host: dbHostIRGE,
            user: dbUserIRGE,
            password: dbPasswordIRGE,
            database: dbDatabaseIRGE,
          })

          const fecha = new Date()
          const fechaFormateada = format_date(fecha, 'yyyy-MM-dd HH:mm:ss')
          const fechaReporte = getDateReport(fechaFormateada)
          const subgrupo = program.subgrupos.find( s => s.terminal === 'DDA')

          conexion.connect((error) => {
            if (error) {
              console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
              logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
              return null
            }
  
            const sql = `INSERT INTO accesos (claveAcceso, fechaLlegada, embarque, estado, presion, fechaReporte, pg, idUser_reg, usuario_reg, subgrupo, programa, id_programa_energy)
                        VALUES ('${program.clave}', '${fechaFormateada}', 0, 1, 0, '${fechaReporte}', '${program.pg}', '${id_user_reg}', '${user_reg}', '${subgrupo.clave}', 1, ${program.ID})`
            console.log("🚀 ~ file: index.js:998 ~ conexion.connect ~ sql:", sql)
                                
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del programa diaria: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del programa diaria: ${error.stack}`)
                return null
              }
              console.log(`Se insertó la programación en IRGE: ${program.pg} - subgrupo: ${subgrupo.clave}`.bgGreen)
              logger.info(`Se insertó la programación en IRGE: ${program.pg} - subgrupo: ${subgrupo.clave}`)
              
              const url_update_program = `${api_url}/programs`
              let dataForm = new FormData()
              dataForm.append('indentifier', program.ID)

              let config = {
                method: 'post',
                url: url_update_program,
                headers: {
                  ...dataForm.getHeaders()
                },
                data: dataForm
              }

              axios.request(config)
                .then( response => {
                  console.log(`${response.data.message}`.bgGreen)
                  logger.info(`${response.data.message}`)
                })
                .catch((error) => {
                  console.log(`Error: ${error}`.bgRed)
                  logger.error(`Error: ${error}`)
                })
            })
            conexion.end()
          })
        })
        
      } else {
        console.log(`No hay programas nuevos en IRGE`.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })
}

/**
 * Generates a report date based on the formatted input date.
 *
 * @param {string} fechaFormateada - The formatted input date.
 * @return {string} The generated report date.
 */
function getDateReport(fechaFormateada)
{
  const fecha = new Date(fechaFormateada)
  const hora = format_date(fecha, 'HH')
  let fechaReporte = ''

  if (parseInt(hora) < 5) {
    fechaReporte = format_date(subDays(fecha, 1), 'yyyy-MM-dd')
  } else {
    fechaReporte = format_date(fecha, 'yyyy-MM-dd')
  }

  return fechaReporte

}

monitorearEnergy()