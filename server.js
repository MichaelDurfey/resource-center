const express = require('express')
const path = require('path')
const fs = require('fs')
const formidable = require('formidable')
const helper = require('sendgrid').mail
const app = express()
require('dotenv').config()
const PORT = process.env.SERVER_PORT || 9000
// const CLIENT_PORT = process.env.PORT || 3000
const PROTOCOL = process.env.PROTOCOL || 'http'
const HOSTNAME = process.env.HOST || 'localhost'
const UPLOAD_DIR = path.join(__dirname, 'uploads/')
const CORS =
  process.env.NODE_ENV === 'production' ? `${PROTOCOL}://${HOSTNAME}` : `*`

const fromEmail = new helper.Email('test@example.com')
const toEmail = new helper.Email('jesseweigel@gmail.com')
const subject = 'Sending with SendGrid is Fun'
const content = new helper.Content(
  'text/plain',
  'and easy to do anywhere, even with Node.js'
)
const mail = new helper.Mail(fromEmail, subject, toEmail, content)

const sg = require('sendgrid')(process.env.SENDGRID_API_KEY)
const request = sg.emptyRequest({
  method: 'POST',
  path: '/v3/mail/send',
  body: mail.toJSON()
})

if (!fs.existsSync(UPLOAD_DIR)) {
  console.warn('Creating uploads folder...')
  fs.mkdirSync(UPLOAD_DIR)
}
console.info(`Uploads will be saved in ${UPLOAD_DIR}`)

app.use(express.static(path.join(__dirname, 'build')))

app.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
})

app.post('/uploads', function (req, res) {
  const form = new formidable.IncomingForm()

  // In any case send the cors headers (even on error)
  res.header('Access-Control-Allow-Origin', CORS)
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )

  form.parse(req).on('field', function (field, value) {
    console.log(field, value)
  })

  // The events we subscribe to in the form occur in the following order
  // field - multiple times
  // fileBegin then file - once per file
  // error - only if there was a parsing error
  // end - when all other events have been handled and the files have
  //       finished being written to the disk, this event happens even
  //       if there was an error

  form.on('fileBegin', function (name, file) {
    file.path = path.join(UPLOAD_DIR, file.name)
  })

  form.on('file', function (name, file) {
    console.log('Uploaded ' + file.name)
  })

  const fields = {}
  form.on('field', (name, value) => {
    fields[name] = value
  })

  // Handle a possible error while parsing the request
  // We need a variable in this scope to hold whether there was an error
  // because we need to know that in a different callback
  let error = false
  form.on('error', err => {
    error = true
    console.log('Error while parsing request to /uploads: ' + err)
    res
      .status(400) // Bad request
      .json({ success: false, status: 'Error parsing the request' })
  })

  form.on('end', () => {
    // The end event is fired even if an error occurs, so we
    // need to prevent from sending a second response, otherwise the
    // server crashes
    if (error) return
    console.log('Received fields:\n' + JSON.stringify(fields, null, 2))
    // Here is a good place to send the emails since we have the fields
    sg.API(request, function (error, response) {
      if (error) {
        console.log('Error response received')
      }
      console.log(response.statusCode)
      console.log(response.body)
      console.log(response.headers)
    })
    res
      .status(200)
      .json({ success: true, status: 'Form successfully submitted' })
  })
})

app.listen(PORT, _ => console.info(`Server listening on PORT ${PORT}...`))
