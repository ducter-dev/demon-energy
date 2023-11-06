require('dotenv').config()
const mysql = require('mysql')
const axios = require('axios')
var colors = require('colors')
const { parse } = require('path')


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

/**
 * Monitors energy24-7.
 *
 * @return {Promise<void>} Returns a promise that resolves when the monitoring is complete.
 */
async function monitorearEnergy() {
  console.log('🚀 Iniciando monitoreo de energy24-7'.bgBlue)
  await getNominations()
  //setTimeout(monitorearEnergy, 3000)
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

        data.forEach(subgrupo => {
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
              return null
            }
            const idCompania = subgrupo.compania == 1 ? subgrupo.compania : 3
            const sql = `INSERT INTO subgrupos(id, orden, nombre, activo, compania, grupo)
                        VALUES('${subgrupo.clave}', 0, '${subgrupo.nombre}', 1, ${idCompania}, 1)`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del subgrupo: ${error.stack}`.bgRed)
                return null
              }
              console.log(`Creado en subgrupos: ${subgrupo.nombre}`.bgGreen)
              console.log(`Ha sido registrado subgrupo: ${result}`.bgGreen)
              const sql2 = `INSERT INTO nominaciones_orden(subgrupo, orden, color, textColor, label, button)
                            VALUES('${subgrupo.clave}', 0, '#D1D1D1', 'black','black','#B3AEAE')`
              conexion.query(sql2, (error, result) => {
                if (error) {
                  console.error(`Error al realizar la inserción del subgrupo: ${error.stack}`.bgRed)
                  return null
                }
                console.log(`Agregado al grupo de nominaciones: ${subgrupo.nombre}`.bgGreen)
              })
              // Enviara actualización del id de subgrupo
              conexion.end()
            })
          })

        })
      } else {
        console.log('No existen subgrupos nuevos.'.bgYellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
    })

  // Obtener operadores nuevos
  //getOperatorsNews()

}


/**
 * Retrieves the latest news from the operators API and registers them in the database.
 *
 * @return {Promise<void>} This function does not return anything.
 */
async function getOperatorsNews() {
  // Obtener la información del api tpa
  const url_tpa = `${api_url}/operators?terminal=tpa` 
  console.log(url_tpa.bgCyan)
  await axios.get(url_tpa)
    .then(response => {
      const { data } = response.data
      console.log("🚀 ~ file: index.js:150 ~ getOperatorsNews ~ data:", data)
      
      if (data.length > 0) {

        data.forEach(operator => {
          console.log(`Registrando operator ${operator.nombre}`.bgGreen)
          
          const conexion = mysql.createConnection({
            host: dbHostTPA,
            user: dbUserTPA,
            password: dbPasswordTPA,
            database: dbDatabaseTPA,
          })
          
          conexion.connect((error) => {
            if (error) {
              console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
            }
            const sql = `INSERT INTO operador(id_operador, nombre_operador, grupo, telefonoOperador, identificacion)
                        VALUES('${operator.ID}', '${operator.nombre}', 'Nieto', '', '${operator.clave_elector}')`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del operador: ${error.stack}`.bgRed)
              }
              console.log(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
              // Enviara actualización del id de operador
              conexion.end()
            })
          })
        })

        // Actualizar Autotanques
      } else {
        console.log('No existen operadores nuevos en TPA.'.bgYellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
    })


  // Obtener la información del api irge
  const url_irge = `${api_url}/operators?terminal=irge` 
  console.log(url_irge.bgCyan)
  await axios.get(url_irge)
  .then(response => {
    const { data } = response.data
    console.log("🚀 ~ file: index.js:200 ~ getOperatorsNews ~ data:", data)
    
    if (data.length > 0) {

      data.forEach(operator => {
        console.log(`Registrando operator ${operator.nombre}`.bgGreen)
        
        const conexion = mysql.createConnection({
          host: dbHostIRGE,
          user: dbUserIRGE,
          password: dbPasswordIRGE,
          database: dbDatabaseIRGE,
        })
        
        conexion.connect((error) => {
          if (error) {
            console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
            return null
          }
          const sql = `INSERT INTO operador(id_operador, nombre_operador, grupo, telefonoOperador, identificacion)
                      VALUES('${operator.ID}', '${operator.nombre}', 'Nieto', '', '${operator.clave_elector}')`
          conexion.query(sql, (error, result) => {
            if (error) {
              console.error(`Error al realizar la inserción del operador: ${error.stack}`.bgRed)
              return null
            }
            console.log(`Ha sido registrado operador ${operator.nombre} en la terminal ${operator.terminal}`.bgGreen)
            // Enviara actualización del id de operador
            conexion.end()
          })
        })
      })
      
      // Actualizar Autotanques
    } else {
      console.log('No existen operadores nuevos en IRGE.'.bgYellow)
    }
  })
  .catch(error => {
    console.log(`Error: ${error}`.bgRed)
  })
  // Obtener autotanques nuevos
  console.log('Buscar autanques'.bgYellow)
}


/**
 * Retrieves the latest information about equipments from the API and registers them in the database.
 *
 * @return {Promise<void>} A Promise that resolves when the function completes.
 */
async function getEquipmentsNews() {
  // Obtener la información del api tpa
  const url_tpa = `${api_url}/equipments?terminal=tpa` 
  console.log(url_tpa.bgCyan)
  const idBase = 2650

  await axios.get(url_tpa)
    .then(response => {
      const { data } = response.data
      console.log("🚀 ~ file: index.js:253 ~ getEquipmentsNews ~ data:", data)
      
      if (data.length > 0) {

        data.forEach(equipment => {
          console.log(`Registrando autotanque ${equipment.nombre}`.bgGreen)
          
          const conexion = mysql.createConnection({
            host: dbHostTPA,
            user: dbUserTPA,
            password: dbPasswordTPA,
            database: dbDatabaseTPA,
          })
          
          conexion.connect((error) => {
            if (error) {
              console.error(`Error al conectar a la base de datos:  ${error.stack}`.bgRed)
            }
            const sql = `INSERT INTO autotanques(SbiID, pg, capacidad, placa, embarque, fechaMod, idCRE)
                        VALUES('${idBase + equipment.ID}', '${equipment.pg}','${equipment.capacidad}', '${equipment.placa}', 0, '${equipment.fecha_creacion}', '${equipment.idCRE}')`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del autotanque: ${error.stack}`.bgRed)
              }
              console.log(`Ha sido registrado autotanque ${equipment.pg} en la terminal TPA`.bgGreen)
              // Enviara actualización del id de operador
              conexion.end()
            })
          })
        })

        // Actualizar Autotanques
      } else {
        console.log('No existen operadores nuevos en TPA.'.bgYellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
    })


  // Obtener la información del api irge
  const url_irge = `${api_url}/equipments?terminal=irge` 
  console.log(url_irge.bgCyan)
  await axios.get(url_irge)
    .then(response => {
      const { data } = response.data
      console.log("🚀 ~ file: index.js:253 ~ getEquipmentsNews ~ data:", data)
      
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
            }
            const sql = `INSERT INTO autotanques(SbiID, pg, capacidad, placa, embarque, fechaMod, idCRE)
                        VALUES('${idBase + equipment.ID}', '${equipment.pg}','${equipment.capacidad}', '${equipment.placa}', 0, '${equipment.fecha_creacion}', '${equipment.idCRE}')`
            conexion.query(sql, (error, result) => {
              if (error) {
                console.error(`Error al realizar la inserción del autotanque: ${error.stack}`.bgRed)
              }
              console.log(`Ha sido registrado autotanque ${equipment.pg} en la terminal IRGE`.bgGreen)
              // Enviara actualización del id de operador
              conexion.end()
            })
          })
        })

        // Actualizar Autotanques
      } else {
        console.log('No existen operadores nuevos en IRGE.'.bgYellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
    })
  // Obtener autotanques nuevos
  console.log('Buscar autanques'.bgYellow)
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
          console.log(`Registrando nominación mensual con id: ${nomination.ID}`.bgYellow)

          // Ver si tiene nominacion en TPA
          
          
          if (nomination.volumen_tpa > 0) {
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
                  return null
                }
                
                const sql = `INSERT INTO nominacion_mensual(unidadNeg, anio, mes, nominacion)
                            VALUES('${subgrupoTPA.clave}', ${anioTPA}, '${monthTPA}', ${nomination.volumen_tpa})`
                            
                console.log(`Agregado a las nominaciones mensuales TPA: ${nomination.ID} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                conexionTPA.query(sql, (error, result) => {
                  if (error) {
                    console.error(`Error al realizar la inserción de la nominación mensual: ${error.stack}`.bgRed)
                    return null
                  }
                  
                  nomination.nominacion_diaria.forEach(nomDay => {
    
                    const sql2 = `INSERT INTO nominaciones(unidadNeg, nominacion, fecha_nominacion)
                                  VALUES('${subgrupoTPA.clave}', ${parseInt(nomDay.TPA)}, '${nomDay.fecha}')`
                                  
                    conexionTPA.query(sql2, (error, result) => {
                      if (error) {
                        console.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`.bgRed)
                        return null
                      }
                      console.log(`Agregado a las nominaciones diarias TPA: ${nomDay.fecha} - subgrupo: ${subgrupoTPA.clave}`.bgGreen)
                    })
                  })
    
                  // Enviara actualización del id de subgrupo
                })
              })
            } else {
              console.log('Error: subgrupo vacío en TPA.'.bgRed)
            }
          }

          if (nomination.volumen_dda > 0) {
            // Ver si tiene nominacion en IRGE
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
                  return null
                }
                
                const sql = `INSERT INTO nominacion_mensual(unidadNeg, anio, mes, nominacion)
                            VALUES('${subgrupoIRGE.clave}', ${anioIRGE}, '${monthIRGE}', ${nomination.volumen_dda})`
    
                console.log(`Agregado a las nominaciones mensuales IRGE: ${nomination.ID} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)
                conexionIRGE.query(sql, (error, result) => {
                  if (error) {
                    console.error(`Error al realizar la inserción de la nominación: ${error.stack}`.bgRed)
                    return null
                  }
                  
                  nomination.nominacion_diaria.forEach(nomDay => {
    
                    const sql2 = `INSERT INTO nominaciones(unidadNeg, nominacion, fecha_nominacion)
                                  VALUES('${subgrupoIRGE.clave}', ${parseInt(nomDay.DDA)}, '${nomDay.fecha}')`
                                  
                    conexionIRGE.query(sql2, (error, result) => {
                      if (error) {
                        console.error(`Error al realizar la inserción del nominación diaria: ${error.stack}`.bgRed)
                        return null
                      }
                      console.log(`Agregado a las nominaciones diarias IRGE: ${nomDay.fecha} - subgrupo: ${subgrupoIRGE.clave}`.bgGreen)

                    })
                  })
    
                  // Enviara actualización del id de subgrupo
    
                })
              })
            } else {
              console.log('Error: subgrupo vacío en IRGE.'.bgRed)
            }
          }
        })
      } else {
        console.log('No existen las nominaciones mensuales nuevas.'.bgYellow)
      }
    })
    .catch(error => {
      console.log(`Error: ${error}`.bgRed)
    })
}

monitorearEnergy()