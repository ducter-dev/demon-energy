require('dotenv').config()
const mysql = require('mysql')
var colors = require('colors')
const { subDays } = require('date-fns')
const format_date = require('date-fns/format')
const FormData = require('form-data')
const winston = require('winston')
const { format } = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const apiWebhooks = require('./webhooks')

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

/**
 * Monitors energy24-7.
 *
 * @return {Promise<void>} Returns a promise that resolves when the monitoring is complete.
 */
async function monitorearEnergy() {
  console.log('🚀 Iniciando monitoreo de energy24-7'.bgBlue)
  logger.info('🚀 Iniciando monitoreo de energy24-7')
  await getDestinations()
  //setTimeout(monitorearEnergy, 60000)
}

/**
 * Retrieves the latest news about customers from the API.
 *
 * @return {Promise} A promise that resolves with the latest customer news.
 */
async function getCustomersNews() {

  // Obtener la información del api
  await apiWebhooks.get('/subgroups')
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {

        data.forEach(async (subgrupo) => {
          console.log(`Registrando en ${subgrupo.terminal} - subgrupo ${subgrupo.nombre}`.bgGreen)

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
                console.error(`Error al realizar la inserción en ${subgrupo.terminal} del subgrupo: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción en ${subgrupo.terminal} del subgrupo: ${error.stack}`)
                return null
              }
              console.log(`Creado en subgrupos en ${subgrupo.terminal}: ${subgrupo.nombre}`.bgGreen)
              const sql2 = `INSERT INTO nominaciones_orden(subgrupo, orden, color, textColor, label, button)
                            VALUES('${subgrupo.clave}', 0, '#D1D1D1', 'black','black','#B3AEAE')`
              
              conexion.query(sql2, (error, result) => {
                if (error) {
                  console.error(`Error al realizar la inserción del subgrupo en ${subgrupo.terminal}: ${error.stack}`.bgRed)
                  logger.error(`Error al realizar la inserción del subgrupo en ${subgrupo.terminal}: ${error.stack}`)
                  return null
                }
                console.log(`Subgrupo agregado al grupo de nominaciones en ${subgrupo.terminal}: ${subgrupo.nombre}`.bgGreen)
                logger.info(`Subgrupo agregado al grupo de nominaciones en ${subgrupo.terminal}: ${subgrupo.nombre}`)
              })

              conexion.end()

              // Enviara actualización del id de subgrupo
              let dataForm = new FormData()
              dataForm.append('indentifier', subgrupo.ID)
              dataForm.append('terminal', subgrupo.terminal === 'TPA' ? 'tpa' : 'irge' )

              let config = {
                method: 'post',
                url: '/subgroups',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }
              apiWebhooks.request(config)
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

  await apiWebhooks.get('/operators?terminal=tpa')
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
            const sql = `INSERT INTO operador(id_operador, nombre_operador, grupo, telefonoOperador, identificacion, curp)
                        VALUES('${operator.ID}', '${operator.nombre}', 'Nieto', '', '${operator.clave_elector}', '${operator.curp}')`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del operador en TPA: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del operador en TPA: ${error.stack}`)
                return null
              }
              console.log(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
              logger.info(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`)
              conexion.end()

              // Enviara actualización del id de operador
              let dataForm = new FormData()
              dataForm.append('indentifier', operator.ID)
              dataForm.append('terminal', 'tpa')
              dataForm.append('identifier_terminal', operator.ID)

              let config = {
                method: 'post',
                url: '/operators',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }

              apiWebhooks.request(config)
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
  await apiWebhooks.get('/operators?terminal=irge')
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
          const sql = `INSERT INTO operador(id_operador, nombre_operador, grupo, telefonoOperador, identificacion, curp)
                      VALUES('${operator.ID}', '${operator.nombre}', 'Nieto', '', '${operator.clave_elector}', '${operator.curp}')`
          conexion.query(sql, (error, result) => {
            if (error) {
              console.error(`Error al realizar la inserción del operador en IRGE: ${error.stack}`.bgRed)
              logger.error(`Error al realizar la inserción del operador en IRGE: ${error.stack}`)
              return null
            }
            console.log(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
            logger.info(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`)
            conexion.end()

            // Enviara actualización del id de operador
            let dataForm = new FormData()
            dataForm.append('indentifier', operator.ID)
            dataForm.append('terminal', 'irge')
            dataForm.append('identifier_terminal', operator.ID)

            let config = {
              method: 'post',
              url: 'operators',
              headers: {
                ...dataForm.getHeaders(),
              },
              data: dataForm
            }

            apiWebhooks.request(config)
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

async function getOperatorsUpdated() {
  // Obtener operadores actualizado en TPA

  await apiWebhooks.get('/operators/update?terminal=tpa')
    .then(response => {
      const { data } = response.data
      console.log("🚀 ~ file: app.js:323 ~ getOperatorsUpdated ~ data:", data)
      
      if (data.length > 0) {
        data.forEach(operator => {
          console.log(`Actualizando operador ${operator.nombre} en TPA`.bgGreen)
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
            const sql = `UPDATE operador SET nombre_operador = '${operator.nombre}', identificacion = '${operator.clave_elector}', curp = '${operator.curp}'
                        WHERE id_operador = ${operator.ID}`
            console.log("🚀 ~ file: app.js:341 ~ conexion.connect ~ sql:", sql)
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la actualización del operador en TPA: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la actualización del operador en TPA: ${error.stack}`)
                return null
              }
              console.log(`Ha sido actualizado el operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
              logger.info(`Ha sido actualizado el operador ${operator.nombre} en la terminal ${operator.terminal}`)
              conexion.end()

              // Enviara actualización del id de operador
              let dataForm = new FormData()
              dataForm.append('indentifier', operator.ID)
              dataForm.append('terminal', 'tpa')
              dataForm.append('identifier_terminal', operator.ID)

              let config = {
                method: 'post',
                url: '/operators',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }

              apiWebhooks.request(config)
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
        console.log('No existen operadores actualizados en TPA.'.yellow)
      }

    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`.bgRed)
    })

  // Obtener operadores actualizado en TPA

  await apiWebhooks.get('/operators/update?terminal=irge')
    .then(response => {
      const { data } = response.data
      console.log("🚀 ~ file: app.js:395 ~ getOperatorsUpdated ~ data:", data)
      
      if (data.length > 0) {
        data.forEach(operator => {
          console.log(`Actualizando operador ${operator.nombre} en IRGE`.bgGreen)
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
            const sql = `UPDATE operador SET nombre_operador = '${operator.nombre}', identificacion = '${operator.clave_elector}', curp = '${operator.curp}'
                        WHERE id_operador = ${operator.ID}`
            console.log("🚀 ~ file: app.js:416 ~ conexion.connect ~ sql:", sql)
            
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la actualización del operador en IRGE: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la actualización del operador en IRGE: ${error.stack}`)
                return null
              }
              console.log(`Ha sido actualizado el operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
              logger.info(`Ha sido actualizado el operador ${operator.nombre} en la terminal ${operator.terminal}`)
              conexion.end()

              // Enviara actualización del id de operador
              let dataForm = new FormData()
              dataForm.append('indentifier', operator.ID)
              dataForm.append('terminal', 'irge')
              dataForm.append('identifier_terminal', operator.ID)

              let config = {
                method: 'post',
                url: '/operators',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }

              apiWebhooks.request(config)
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
        console.log('No existen operadores actualizados en IRGE.'.yellow)
      }

    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`.bgRed)
    })

}



/**
 * Retrieves the latest information about equipments from the API and registers them in the database.
 *
 * @return {Promise<void>} A Promise that resolves when the function completes.
 */
async function getEquipmentsNewsTPA() {
  // Obtener la información del api tpa
  const idBase = 2650

  await apiWebhooks.get('/equipments?terminal=tpa')
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {

        data.forEach(equipment => {
          console.log(`Registrando autotanque ${equipment.pg} en TPA`.bgGreen)
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
                console.error(`Error al realizar la inserción en TPA del autotanque: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción en TPA del autotanque: ${error.stack}`)
              }
              console.log(`Ha sido registrado autotanque ${equipment.pg} en la terminal TPA`.bgGreen)
              logger.info(`Ha sido registrado autotanque ${equipment.pg} en la terminal TPA`)
              conexion.end()
              
              // Enviara actualización del id de operador
              let dataForm = new FormData()
              dataForm.append('indentifier', equipment.ID)
              dataForm.append('terminal', 'tpa')

              let config = {
                method: 'post',
                url: '/equipments',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }

              apiWebhooks.request(config)
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
  const idBase = 2650
  
  await apiWebhooks.get('/equipments?terminal=irge')
    .then(response => {
      const { data } = response.data
      
      if (data.length > 0) {

        data.forEach(equipment => {
          console.log(`Registrando autotanque ${equipment.pg}`.bgGreen)
          
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
                console.error(`Error al realizar la inserción en IRGE del autotanque: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción en IRGE del autotanque: ${error.stack}`)
              }
              console.log(`Ha sido registrado autotanque ${equipment.pg} en la terminal IRGE`.bgGreen)
              logger.error(`Ha sido registrado autotanque ${equipment.pg} en la terminal IRGE`)
              conexion.end()

              // Enviara actualización del id de operador
              let dataForm = new FormData()
              dataForm.append('indentifier', equipment.ID)
              dataForm.append('terminal', 'irge')

              let config = {
                method: 'post',
                url: '/equipments',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }

              apiWebhooks.request(config)
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
  await apiWebhooks.get('/nominations')
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
                
                conexionTPA.query(sql, (error, result) => {
                  if (error) {
                    console.error(`Error al realizar la inserciónen en TPA de la nominación mensual: ${error.stack}`.bgRed)
                    logger.error(`Error al realizar la inserción en TPA de la nominación mensual: ${error.stack}`)
                    return null
                  }
                  console.log(`Agregado a las nominaciones mensuales TPA: ${nomination.ID} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                  logger.info(`Agregado a las nominaciones mensuales TPA: ${nomination.ID} - subgrupo: ${subgrupoTPA.clave}`)
                  nomination.nominacion_diaria.forEach(nomDay => {
                    
                    const sql2 = `INSERT INTO nominaciones(unidadNeg, nominacion, fecha_nominacion)
                                  VALUES('${subgrupoTPA.clave}', ${parseInt(nomDay.TPA)}, '${nomDay.fecha}')`
                    //console.log("🚀 ~ file: index.js:544 ~ conexionTPA.query ~ sql2:", sql2)
                                  
                    conexionTPA.query(sql2, (error, result) => {
                      if (error) {
                        console.error(`Error al realizar la inserción en TPA del nominación diaria: ${error.stack}`.bgRed)
                        logger.error(`Error al realizar la inserción en TPA del nominación diaria: ${error.stack}`)
                        return null
                      }
                      console.log(`Agregado a las nominaciones diarias TPA: ID: ${nomDay.ID_DIA} - ${parseInt(nomDay.TPA)} - ${nomDay.fecha} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                      logger.info(`Agregado a las nominaciones diarias TPA: ID: ${nomDay.ID_DIA} - ${parseInt(nomDay.TPA)} - ${nomDay.fecha} - subgrupo: ${subgrupoTPA.clave}`)
                      

                      // Enviara actualización del id de nominación
                      let dataForm = new FormData()
                      dataForm.append('indentifier', nomDay.ID_DIA)

                      let configDaily = {
                        method: 'post',
                        url: '/daily_nominations',
                        headers: {
                          ...dataForm.getHeaders(),
                        },
                        data: dataForm
                      }
                      apiWebhooks.request(configDaily)
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
                  
                  // Enviara actualización del id de nominación
                  let dataForm = new FormData()
                  dataForm.append('indentifier', nomination.ID)

                  let config = {
                    method: 'post',
                    url: '/nominations',
                    headers: {
                      ...dataForm.getHeaders(),
                    },
                    data: dataForm
                  }

                  apiWebhooks.request(config)
                    .then( response => {
                      console.log(`${response.data.message}`.bgGreen)
                      logger.info(`${response.data.message}`)
                    })
                    .catch((error) => {
                      console.log(`Error: ${error}`.bgRed)
                      logger.error(`Error: ${error}`)
                    })
                  conexionTPA.end()
                })
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

                //console.log("🚀 ~ file: index.js:633 ~ conexionIRGE.connect ~ sql:", sql)
                console.log(`Agregado a las nominaciones mensuales IRGE: ${nomination.ID} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)
                logger.info(`Agregado a las nominaciones mensuales IRGE: ${nomination.ID} - subgrupo: ${subgrupoIRGE.clave}`)
                conexionIRGE.query(sql, (error, result) => {
                  if (error) {
                    console.error(`Error al realizar la inserción en IRGE de la nominación: ${error.stack}`.bgRed)
                    logger.error(`Error al realizar la inserción en IRGE de la nominación: ${error.stack}`)
                    return null
                  }
                  
                  nomination.nominacion_diaria.forEach(nomDay => {
    
                    const sql2 = `INSERT INTO nominaciones(unidadNeg, nominacion, fecha_nominacion)
                                  VALUES('${subgrupoIRGE.clave}', ${parseInt(nomDay.DDA)}, '${nomDay.fecha}')`
                    //console.log(`🚀 ~ file: index.js:642 ~ conexionIRGE.query ~ sql2: ${sql2}`.cyan)
                                  
                    conexionIRGE.query(sql2, (error, result) => {
                      if (error) {
                        console.error(`Error al realizar la inserción en IRGE del nominación diaria: ${error.stack}`.bgRed)
                        logger.error(`Error al realizar la inserción en IRGE del nominación diaria: ${error.stack}`)
                        return null
                      }
                      console.log(`Agregado a las nominaciones diarias IRGE: ID: ${nomDay.ID_DIA} - ${parseInt(nomDay.DDA)} - ${nomDay.fecha} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)
                      logger.info(`Agregado a las nominaciones diarias IRGE: ID: ${nomDay.ID_DIA} - ${parseInt(nomDay.DDA)} - ${nomDay.fecha} - subgrupo: ${subgrupoIRGE.clave}`)

                      // Enviara actualización del id de nominación
                      let dataForm = new FormData()
                      dataForm.append('indentifier', nomDay.ID_DIA)

                      let configDaily = {
                        method: 'post',
                        url: '/daily_nominations',
                        headers: {
                          ...dataForm.getHeaders(),
                        },
                        data: dataForm
                      }

                      apiWebhooks.request(configDaily)
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
                  let dataForm = new FormData()
                  dataForm.append('indentifier', nomination.ID)

                  let config = {
                    method: 'post',
                    url: '/nominations',
                    headers: {
                      ...dataForm.getHeaders(),
                    },
                    data: dataForm
                  }

                  apiWebhooks.request(config)
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
  await apiWebhooks.get('/daily_nominations')
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
                  console.error(`Error al realizar la inserción de TPA del nominación diaria: ${error.stack}`.bgRed)
                  logger.error(`Error al realizar la inserción de TPA del nominación diaria: ${error.stack}`)
                  return null
                }
                console.log(`Actualizada a las nominación diaria TPA: ${daily_nom.fecha} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                logger.info(`Actualizada a las nominación diaria TPA: ${daily_nom.fecha} - subgrupo: ${subgrupoTPA.clave}`)
                conexionTPA.end()

                let dataForm = new FormData()
                dataForm.append('indentifier', daily_nom.ID)

                let config = {
                  method: 'post',
                  url: '/daily_nominations',
                  headers: {
                    ...dataForm.getHeaders(),
                  },
                  data: dataForm
                }

                apiWebhooks.request(config)
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
            console.log('Info: Nominaciones Diarias subgrupo vacío en TPA.'.bgBlue)
            logger.info('Info: Nominaciones Diarias subgrupo vacío en TPA.')
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
                  console.error(`Error al realizar la inserción de IRGE del nominación diaria: ${error.stack}`.bgRed)
                  logger.error(`Error al realizar la inserción de IRGE del nominación diaria: ${error.stack}`)
                  return null
                }
                console.log(`Actualizada a las nominación diaria IRGE: ${daily_nom.fecha} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)
                logger.info(`Actualizada a las nominación diaria IRGE: ${daily_nom.fecha} - subgrupo: ${subgrupoIRGE.clave}`)
                conexionIRGE.end()

                let dataForm = new FormData()
                dataForm.append('indentifier', daily_nom.ID)

                let config = {
                  method: 'post',
                  url: '/daily_nominations',
                  headers: {
                    ...dataForm.getHeaders(),
                  },
                  data: dataForm
                }

                apiWebhooks.request(config)
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
            console.log('Info: subgrupo vacío en IRGE.'.bgBlue)
            logger.info('Info: subgrupo vacío en IRGE.')
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
  await apiWebhooks.get('/programs?terminal=tpa')
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
                console.error(`Error al realizar la inserción en TPA del programa diaria: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción en TPA del programa diaria: ${error.stack}`)
                return null
              }
              console.log(`Se insertó la programación en TPA: ${program.pg} - subgrupo: ${subgrupo.clave}`.bgGreen)
              logger.info(`Se insertó la programación en TPA: ${program.pg} - subgrupo: ${subgrupo.clave}`)
              

                let dataForm = new FormData()
                dataForm.append('indentifier', program.ID)

                let config = {
                  method: 'post',
                  url: '/programs',
                  headers: {
                    ...dataForm.getHeaders(),
                  },
                  data: dataForm
                }

                apiWebhooks.request(config)
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
  await apiWebhooks.get('/programs?terminal=irge')
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
                console.error(`Error al realizar la inserción en IRGE del programa diaria: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción en IRGE del programa diaria: ${error.stack}`)
                return null
              }
              console.log(`Se insertó la programación en IRGE: ${program.pg} - subgrupo: ${subgrupo.clave}`.bgGreen)
              logger.info(`Se insertó la programación en IRGE: ${program.pg} - subgrupo: ${subgrupo.clave}`)
              
              let dataForm = new FormData()
              dataForm.append('indentifier', program.ID)

              let config = {
                method: 'post',
                url: '/programs',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }

              apiWebhooks.request(config)
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
  await getCarriersTPA()
}

async function getCarriersTPA () {
  await apiWebhooks.get('/carriers?terminal=tpa')
    .then(response => {
      const { data } = response.data
      console.log("🚀 ~ file: app.js:1024 ~ getCarriersTPA ~ data:", data)
      const id_terminal = 303
      
      if (data.length > 0) {
        data.forEach(carrier => {
          const conexion = mysql.createConnection({
            host: dbHostTPA,
            user: dbUserTPA,
            password: dbPasswordTPA,
            database: dbDatabaseTPA,
          })

          const fecha = new Date()

          conexion.connect((error) => {
            if (error) {
              console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
              logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
              return null
            }

            const sql = `INSERT INTO porteador(idporteador, nombrePorteador, clavePorteador, rfcPorteador, grupo, activo) 
                        VALUES ('${id_terminal + carrier.ID}', '${carrier.business_name}', '${carrier.permission_cre}', '${carrier.rfc}', '', 1)`
            console.log("🚀 ~ file: app.js:1046 ~ conexion.connect ~ sql:", sql)

            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción en TPA del transportista: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción en TPA del transportista: ${error.stack}`)
                return null
              }

              console.log(`Se insertó el transportista en TPA: ${carrier.business_name}`.bgGreen)
              logger.info(`Se insertó el transportista en TPA: ${carrier.business_name}`)

              let dataForm = new FormData()
                dataForm.append('indentifier', carrier.ID)
                dataForm.append('terminal', 'tpa')

                let config = {
                  method: 'post',
                  url: '/carriers',
                  headers: {
                    ...dataForm.getHeaders(),
                  },
                  data: dataForm
                }

                apiWebhooks.request(config)
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
        console.log(`No hay transportistas nuevos en TPA`.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })
  await getCarriersIRGE()
}

async function getCarriersIRGE () {
  await apiWebhooks.get('/carriers?terminal=irge')
    .then(response => {
      const { data } = response.data
      
      const id_terminal = 123
      
      if (data.length > 0) {
        data.forEach(carrier => {
          const conexion = mysql.createConnection({
            host: dbHostIRGE,
            user: dbUserIRGE,
            password: dbPasswordIRGE,
            database: dbDatabaseIRGE,
          })

          const fecha = new Date()

          conexion.connect((error) => {
            if (error) {
              console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
              logger.error(`Error al conectar a la base de datos:  ${error.stack}`)
              return null
            }

            const sql = `INSERT INTO porteador(idporteador, nombrePorteador, clavePorteador, rfcPorteador, grupo, activo) 
                        VALUES ('${id_terminal + carrier.ID}', '${carrier.business_name}', '${carrier.permission_cre}', '${carrier.rfc}', '', 1)`
            console.log("🚀 ~ file: app.js:1122 ~ conexion.connect ~ sql:", sql)

            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción en IRGE del transportista: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción en IRGE del transportista: ${error.stack}`)
                return null
              }

              console.log(`Se insertó el transportista en IRGE: ${carrier.business_name}`.bgGreen)
              logger.info(`Se insertó el transportista en IRGE: ${carrier.business_name}`)

              let dataForm = new FormData()
                dataForm.append('indentifier', carrier.ID)
                dataForm.append('terminal', 'irge')

                let config = {
                  method: 'post',
                  url: '/carriers',
                  headers: {
                    ...dataForm.getHeaders(),
                  },
                  data: dataForm
                }

                apiWebhooks.request(config)
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
        console.log(`No hay transportistas nuevos en IRGE`.yellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })
  await getOperatorsUpdated()
}


async function getDestinations() {
  await apiWebhooks.get('/destinations?terminal=tpa')
  .then(response => {
      const { data } = response.data
      console.log("🚀 ~ file: app.js:1325 ~ getDestinantions ~ data:", data)
      const id_destino_bd = 603
      
      if (data.length > 0) {

        data.forEach(destination => {
          console.log(`Registrando destino ${destination.nombre} en TPA`.bgGreen)
          
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
            const subgrupo = destination.subgrupos[0]
            console.log("🚀 ~ file: app.js:1345 ~ conexion.connect ~ subgrupo:", subgrupo)
            
            const sql = `INSERT INTO destinatario(iddestinatario, nombreDestino, direccionDestino, claveDestino, telefonoDestino, grupo, subgrupo)
                        VALUES (${id_destino_bd + destination.ID},'${destination.nombre}','${destination.direccion}','${destination.clave}','${destination.telefono}', 'NIETO','${subgrupo}')`
            console.log("🚀 ~ file: app.js:1346 ~ conexion.connect ~ sql:", sql)
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del destino en TPA: ${error.stack}`.bgRed)
                logger.error(`Error al realizar la inserción del destino en TPA: ${error.stack}`)
                return null
              }
              console.log(`Ha sido registrado destino ${destination.nombre} en la terminal TPA`.bgGreen)
              logger.info(`Ha sido registrado destino ${destination.nombre} en la terminal TPA`)
              conexion.end()

              // Enviara actualización del id de operador
              let dataForm = new FormData()
              dataForm.append('indentifier', destination.ID)
              dataForm.append('terminal', 'tpa')

              let config = {
                method: 'post',
                url: '/destinations',
                headers: {
                  ...dataForm.getHeaders(),
                },
                data: dataForm
              }

              apiWebhooks.request(config)
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
        console.log('No existen destinos nuevos en TPA.'.yellow)
      }
    })
    .catch(error => {
      console.log(`Error 1389: ${error}`.bgRed)
      logger.error(`Error: ${error}`)
    })


  // Obtener la información del api irge
  await apiWebhooks.get('/destinations?terminal=irge')
  .then(response => {
    const { data } = response.data
    console.log("🚀 ~ file: app.js:1399 ~ getDestinantions ~ data:", data)
    const id_destino_bd = 557
    if (data.length > 0) {

      data.forEach(destination => {
        console.log(`Registrando des ${destination.nombre} en IRGE`.bgGreen)

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
          const subgrupo = destination.subgrupos[0]
          console.log("🚀 ~ file: app.js:1345 ~ conexion.connect ~ subgrupo:", subgrupo)
          const sql = `INSERT INTO destinatario(iddestinatario, nombreDestino, direccionDestino, claveDestino, telefonoDestino, grupo, subgrupo)
                      VALUES (${id_destino_bd + destination.ID},'${destination.nombre}','${destination.direccion}','${destination.clave}','${destination.telefono}', 'NIETO','${subgrupo}')`
          conexion.query(sql, (error, result) => {
            if (error) {
              console.error(`Error al realizar la inserción del destino en IRGE: ${error.stack}`.bgRed)
              logger.error(`Error al realizar la inserción del destino en IRGE: ${error.stack}`)
              return null
            }
            console.log(`Ha sido registrado destino ${destination.nombre} en la terminal IRGE`.bgGreen)
            logger.info(`Ha sido registrado destino ${destination.nombre} en la terminal IRGE`)
            conexion.end()

            // Enviara actualización del id de operador
            let dataForm = new FormData()
            dataForm.append('indentifier', destination.ID)
              dataForm.append('terminal', 'irge')

            let config = {
              method: 'post',
              url: 'destinations',
              headers: {
                ...dataForm.getHeaders(),
              },
              data: dataForm
            }

            apiWebhooks.request(config)
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
      console.log('No existen destinos nuevos en IRGE.'.yellow)
    }
  })
  .catch(error => {
    console.log(`Error 1464: ${error}`.bgRed)
    logger.error(`Error: ${error}`.bgRed)
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