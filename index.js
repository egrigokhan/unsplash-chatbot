require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const CAH_CARDS = require("./CAH_cards")
const CAH = require("./CAH")
const Game = CAH.Game

const app = express()
const port = process.env.PORT || 4000

app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send('Welcome to the Unsplash Chatbot for Zoom!')
})

app.get('/authorize', (req, res) => {
  res.redirect('https://zoom.us/launch/chat?jid=robot_' + process.env.zoom_bot_jid)
})

app.get('/support', (req, res) => {
  res.send('Contact tommy.gaessler@zoom.us for support.')
})

app.get('/privacy', (req, res) => {
  res.send('The Unsplash Chatbot for Zoom does not store any user data.')
})

app.get('/terms', (req, res) => {
  res.send('By installing the Unsplash Chatbot for Zoom, you are accept and agree to these terms...')
})

app.get('/documentation', (req, res) => {
  res.send('Try typing "island" to see a photo of an island, or anything else you have in mind!')
})

app.get('/zoomverify/verifyzoom.html', (req, res) => {
  res.send(process.env.zoom_verification_code)
})

var GAME;

function createGame(BODY) {
  console.log("CREATE")
  if(GAME == null) {
    console.log("Creating game...")
    
    // TOKENIZE COMMAND
    TOKENS = BODY.payload.cmd.split(" ") // /start <NUMBER OF PLAYERS>

    GAME = new Game(TOKENS[1], BODY);

    // JOIN THE CREATING USER TO THE GAME
    GAME.join(BODY.payload, BODY.payload)
  }
}

function joinUserToGame(BODY) {
  console.log("JOIN")
  if(GAME != null) {
    GAME.join(BODY.payload)
  }
}

function play(BODY) {
  console.log("PLAY")
  if(GAME != null) {
    // TOKENIZE COMMAND
    TOKENS = BODY.payload.cmd.split(" ") // /play <CARD 1 INDEX> <CARD 2 INDEX> ... 

    PLAYED_CARDS = []

    for(var i = 1; i < TOKENS.length; i+=1) {
      PLAYED_CARDS.push(TOKENS[i])
    }

    // JOIN THE CREATING USER TO THE GAME
    GAME.playCard(PLAYED_CARDS, BODY.payload)
  }
}

function vote(BODY) {
  console.log("VOTE")
  if(GAME != null) {
    // TOKENIZE COMMAND
    TOKENS = BODY.payload.cmd.split(" ") // /vote <DECK 1 INDEX> ... 

    // JOIN THE CREATING USER TO THE GAME
    GAME.voteFunniest(TOKENS[1], BODY.payload)
  }
}

function exitGame(BODY) {
  GAME = null
}

function getChatbotToken () {
    request({
      url: `https://api.zoom.us/oauth/token?grant_type=client_credentials`,
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(process.env.zoom_client_id + ':' + process.env.zoom_client_secret).toString('base64')
      }
    }, (error, httpResponse, body) => {
      if (error) {
        console.log('Error getting chatbot_token from Zoom.', error)
      } else {
        body = JSON.parse(body)
        sendChat(body.access_token)
      }
    })
  }

  function sendChat(BODY, chatbotToken) {
    request({
      url: 'https://api.zoom.us/v2/im/chat/messages',
      method: 'POST',
      json: true,
      body: {
        'robot_jid': process.env.zoom_bot_jid,
        'to_jid': BODY.payload.toJid,
        'account_id': BODY.payload.accountId,
        'content': {
          'head': {
            'text': 'Unsplash'
          },
          'body': [{
            'type': 'message',
            'text': 'You sent ' + BODY.payload.cmd
          }]
        }
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + chatbotToken
      }
    }, (error, httpResponse, body) => {
      if (error) {
        console.log('Error sending chat.', error)
      } else {
        console.log(body)
      }
    })
  }

app.post('/testibule', (req, res) => {

  // TOKENIZE COMMAND
  TOKENS = req.body.payload.cmd.split(" ")
  
  console.log(req.body["payload"])

  if(TOKENS[0] == "start") {
    createGame(req.body)
  } else if(TOKENS[0] == "join") {
    joinUserToGame(req.body)
  } else if(TOKENS[0] == "play") {
    play(req.body)
  } else if(TOKENS[0] == "vote") {
    vote(req.body)
  } 
})

app.post('/deauthorize', (req, res) => {
  if (req.headers.authorization === process.env.zoom_verification_token) {
    res.status(200)
    res.send()
    request({
      url: 'https://api.zoom.us/oauth/data/compliance',
      method: 'POST',
      json: true,
      body: {
        'client_id': req.body.payload.client_id,
        'user_id': req.body.payload.user_id,
        'account_id': req.body.payload.account_id,
        'deauthorization_event_received': req.body.payload,
        'compliance_completed': true
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(process.env.zoom_client_id + ':' + process.env.zoom_client_secret).toString('base64'),
        'cache-control': 'no-cache'
      }
    }, (error, httpResponse, body) => {
      if (error) {
        console.log(error)
      } else {
        console.log(body)
      }
    })
  } else {
    res.status(401)
    res.send('Unauthorized request to Unsplash Chatbot for Zoom.')
  }
})

app.listen(port, () => console.log(`Unsplash Chatbot for Zoom listening on port ${port}!`))
