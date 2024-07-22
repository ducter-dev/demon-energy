const axios = require('axios')
const CryptoJS = require('crypto-js')

const api_key = process.env.API_KEY
const api_webhooks_key = process.env.API_WEBHOOKS_KEY
const api_url = process.env.API_URL
const apiWebhooks = axios.create({ baseURL: api_url})

apiWebhooks.interceptors.request.use(
  config => {
    config.headers['API-KEY'] = api_key
    config.headers['X-Decrypt-Responses'] = true
    return config
  },
  error => {
    return Promise.reject(error)
  }
)


/* apiWebhooks.interceptors.response.use(
  response => {
    var encrypted_json = JSON.parse(atob(response.data))

    var decrypted = CryptoJS.AES.decrypt(encrypted_json.value, CryptoJS.enc.Base64.parse(api_webhooks_key), {
      iv: CryptoJS.enc.Base64.parse(encrypted_json.iv)
    })
    const new_obj = { ...response, data: JSON.parse(decrypted.toString(CryptoJS.enc.Utf8)) }
    return new_obj
  },
  error => {
    if (error.response) {
      if (error.response.status == 404) {
        return Promise.reject(error.response)
      }

      if (error.response.status == 401) {
        return Promise.reject(error.response)
      }

      var Error_encrypted_json = JSON.parse(atob(error.response.data))

      var decryptedError = CryptoJS.AES.decrypt(
        Error_encrypted_json.value,
        CryptoJS.enc.Base64.parse(api_webhooks_key),
        {
          iv: CryptoJS.enc.Base64.parse(Error_encrypted_json.iv)
        }
      )

      const new_obj = {
        ...error.response,
        data: JSON.parse(decryptedError.toString(CryptoJS.enc.Utf8))
      }

      return Promise.reject(new_obj)
    } else if (error.request) {
      // La petición fue hecha pero no se recibió respuesta
      // `error.request` es una instancia de XMLHttpRequest en el navegador y una instancia de
      // http.ClientRequest en node.js

      return Promise.reject({
        status: null,
        error: { message: 'Conexión rechazada con nuestros servidores. Código de error: 000001' }
      })
    } else {
      return Promise.reject({
        status: null,
        error: {
          message:
            'Ha ocurrido un error inesperado, por favor vuelve a intentarlo. Código de error: 000000'
        }
      })
    }
  }
) */


module.exports = apiWebhooks