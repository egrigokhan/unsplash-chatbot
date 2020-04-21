class Game {

  GAME_CHATBOT_STATE_DICT = {}

  ENTIRE_DECK = {}

  PHASE = 0

  NUMBER_OF_PLAYERS = 3
  DECK_SIZE = 7

  USERS = []
  USERS_DECKS = []
  USERS_SCORES = []

  CURRENT_CZAR_INDEX = -1
  CURRENTLY_PLAYED_NUMBER_OF_PLAYERS = 0
  CURRENT_INDICES = []
  CURRENT_PLAYED_CARDS = []
  CURRENT_BLACK_CARD = ""

  constructor(NUMBER_OF_PLAYERS = 3, GAME_CHATBOT_STATE_DICT = {}) {
  	this.NUMBER_OF_PLAYERS = NUMBER_OF_PLAYERS
    this.GAME_CHATBOT_STATE_DICT = GAME_CHATBOT_STATE_DICT
    this.createDecks()
    this.createScoreboard()

    this.ENTIRE_DECK = getDeck()
  }
  
  createScoreboard() {
    this.USERS_SCORES = []
    for(var i = 0; i < this.NUMBER_OF_PLAYERS; i++) {
      this.USERS_SCORES.push(0)
    }
  }

  createDecks() {
    this.USERS_DECKS = []
    for(var i = 0; i < this.NUMBER_OF_PLAYERS; i++) {
      this.USERS_DECKS.push([])
    }
  }

  join(user) {
  	if(this.USERS.length < this.NUMBER_OF_PLAYERS) {
  	  this.USERS.push(user)
  	  this.sendMessage(user["payload"]["username"] + " has joined the game.")

  	  if(this.USERS.length == this.NUMBER_OF_PLAYERS) {
  	    this.sendMessage("Starting game...")
        this.startRound()
  	  } else if(this.USERS.length < this.NUMBER_OF_PLAYERS) {
        this.sendMessage("Waiting for " + (this.USERS.length - this.NUMBER_OF_PLAYERS) + " player(s)")
      } else {
    		this.sendMessage("You cannot join anymore, the desired number of players have been reached.")
  	  }
  	}
  }

  refreshDecks() {
    for(var j = 0; j < this.USERS_DECKS.length; j++) {
      console.log(this.DECK_SIZE - this.USERS_DECKS[j].length)
      while(this.USERS_DECKS[j].length < 7) {
        this.USERS_DECKS[j].push(this.getRandomWhiteCard())
      }
    }
  }

  startRound() {
    // SET PHASE TO PLAYING (= 0)
    this.PHASE = 0

    // SET CARD CZAR
    this.CURRENT_CZAR_INDEX = (this.CURRENT_CZAR_INDEX + 1) % this.NUMBER_OF_PLAYERS

    // REFRESH DECKS
    this.refreshDecks()

    // CLEAR OUT PREVIOUS GAME
    this.clearOut()

    // PICK BLACK CARD
    this.CURRENT_BLACK_CARD = this.getRandomBlackCard()

    // NOTIFY PEOPLE
    this.notifyPeople()
  }

  startJudgingRound() {
    // SET PHASE TO JUDGING (= 1)
    this.PHASE = 1

    this.sendMessage("The Card Czar will now select the funniest combination.")

    // SHUFFLE THE PLAYED CARDS
    this.shufflePlayedCards()

    // PRINT THE PLAYED CARDS
    this.printPlayedCardsForAll()

    this.sendMessage("Card Czar will now type in the index of the funniest combination.")
  }

  voteFunniest(CARD_INDEX, USER) {
    if(this.getIndexOfUser(USER) == this.CURRENT_CZAR_INDEX) {
      this.sendMessage("The Czar selected [" + CARD_INDEX + "]")

      var WINNING_PLAYER = this.USERS[this.CURRENT_INDICES[CARD_INDEX]]

      this.sendMessage("POINT -> " + WINNING_PLAYER["payload"])

      this.USERS_SCORES[this.CURRENT_INDICES[CARD_INDEX]] += 1

      // PRINT SCORE BOARD
      this.printScoreBoard()
      
      // REMOVE THE PLAYED CARDS FROM DECK
      for(var i = 0; i < this.CURRENT_PLAYED_CARDS.length; i++) {
        var USER_INDEX = i
        
        if(USER_INDEX != this.CURRENT_CZAR_INDEX) {
          var CARD_INDICES = this.CURRENT_PLAYED_CARDS[USER_INDEX]
          
          for(var CI of CARD_INDICES) {
            this.USERS_DECKS[this.CURRENT_INDICES[USER_INDEX]].splice(CI, 1)
          }
        }
      }

      // START NEW ROUND
      this.startRound()
    }
  }

  printScoreBoard() {
    this.sendMessage("  ")
    this.sendMessage("SCOREBOARD")
    for(var i = 0; i < this.NUMBER_OF_PLAYERS; i++) {
      this.sendMessage(this.USERS[i]["payload"]["username"] + " -> " + this.USERS_SCORES[i])
    }
  }

  printPlayedCardsForAll() {
    console.log("HERE")
    for(var i = 0; i < this.CURRENT_PLAYED_CARDS.length; i++) {
      if(this.CURRENT_INDICES[i] != this.CURRENT_CZAR_INDEX) {
        for(var j = 0; j < this.CURRENT_PLAYED_CARDS[i].length; j++) {
          var C = this.USERS_DECKS[this.CURRENT_INDICES[i]][this.CURRENT_PLAYED_CARDS[i][j]]
          if(j == 0) {
            this.sendMessage((i) + ":  " + C)
          } else {
            this.sendMessage("    " + C)
          }
        }
        this.sendMessage("  ")
        }
    }
  }

  shufflePlayedCards() {
    var skladby = this.CURRENT_PLAYED_CARDS
    var zoznam = this.CURRENT_INDICES

    var i=0, len= skladby.length, next, order=[];
    while(i<len)order[i]= ++i; //[1,2,3...]
    order.sort(function(){return Math.random()-.5});


    for(i= 0; i<len; i++){
        next= order[i];
        skladby.push(skladby[next]);
        zoznam.push(zoznam[next]);
    }
    skladby.splice(1, len);
    zoznam.splice(1, len);

    this.CURRENT_PLAYED_CARDS = skladby
    this.CURRENT_INDICES = zoznam
  }

  playCard(CARD_INDICES, USER) {
    var USER_INDEX = this.getIndexOfUser(USER)

    if(USER_INDEX != this.CURRENT_CZAR_INDEX) {
      this.CURRENT_PLAYED_CARDS[USER_INDEX] = CARD_INDICES
      this.CURRENTLY_PLAYED_NUMBER_OF_PLAYERS += 1

      this.sendMessage("You have chosen " + CARD_INDICES, USER["payload"])

      if(this.CURRENTLY_PLAYED_NUMBER_OF_PLAYERS >= this.NUMBER_OF_PLAYERS - 1) {
         this.startJudgingRound()
      }
    } else {
      this.sendMessage("You are the Czar, you can't play at this point.", USER["payload"])
    }
  }

  notifyPeople() {
    for(var i = 0; i < this.NUMBER_OF_PLAYERS; i++) {
        if(i == this.CURRENT_CZAR_INDEX) {
          this.sendCzarMessage(this.USERS[i])
        } else {
          this.sendPlayerMessage(this.USERS[i], i)
        }
    }
  }

  sendCzarMessage(USER) {
    this.sendMessage("You are the Czar for this round.", USER["payload"])
    this.sendMessage("Wait until everyone is finished and then pick the funniest combination.", USER["payload"])
  }

  sendPlayerMessage(USER, INDEX) {
    this.sendMessage("YOUR DECK:", USER["payload"])
    this.printDeckForUser(USER, INDEX)
    this.sendMessage("Please select the funniest card(s).", USER["payload"])
  }

  printDeckForUser(USER, INDEX) {
    for(var i = 0; i < this.USERS_DECKS[INDEX].length; i++) {
      this.sendMessage((i) + ":  " + this.USERS_DECKS[INDEX][i], USER["payload"])
    }
  }
 
  clearOut() {
    this.CURRENTLY_PLAYED_NUMBER_OF_PLAYERS = 0
    this.CURRENT_INDICES = []
    for(var i = 0; i < this.NUMBER_OF_PLAYERS; i++) {
        this.CURRENT_INDICES.push(i)
    }
    this.CURRENT_PLAYED_CARDS = []
    for(var i = 0; i < this.NUMBER_OF_PLAYERs; i++) {
        this.CURRENT_PLAYED_CARDS.push([])
    }
  }

  getRandomWhiteCard() {
    // DEBUG - FIX WITH ACTUAL IMPLEMENTATION
    return this.ENTIRE_DECK["white"][Math.floor(Math.random() * this.ENTIRE_DECK["white"].length)];
  }

  getRandomBlackCard() {
    // DEBUG - FIX WITH ACTUAL IMPLEMENTATION
    return this.ENTIRE_DECK["black"][Math.floor(Math.random() * this.ENTIRE_DECK["black"].length)];
  }

  getIndexOfUser(USER) {
    for(var i = 0; i < this.NUMBER_OF_PLAYERS; i++) {
      if(this.USERS[i]["payload"]["username"] == USER["payload"]["username"]) {
        return i
      }
    }
    return -1
  }

  sendMessage(head = "", text, USER) {
    console.log("(" + to + ") " + msg)
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
        sendChat(USER.toJid, USER.accountId, head, text, body.accessToken)
      }
    })
  }
}

function sendChat(toJid, accountId, head, text, chatbotToken) {
    request({
      url: 'https://api.zoom.us/v2/im/chat/messages',
      method: 'POST',
      json: true,
      body: {
        'robot_jid': process.env.zoom_bot_jid,
        'to_jid': toJid,
        'account_id': accountId,
        'content': {
          'head': {
            'text': head
          },
          'body': [{
            'type': 'message',
            'text': text
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

const game = new Game(4, 2, 2);
game.join({payload: {"username" : "MoFo"}})
game.join({payload: {"username" : "FoMo"}})
game.join({payload: {"username" : "NoMo"}})
game.join({payload: {"username" : "MoNo"}})

game.playCard([5], {payload: {"username" : "FoMo"}})
game.playCard([4], {payload: {"username" : "NoMo"}})
game.playCard([1], {payload: {"username" : "MoNo"}})

game.voteFunniest(2, {payload: {"username" : "MoFo"}})

game.playCard([2], {payload: {"username" : "MoFo"}})
game.playCard([2], {payload: {"username" : "NoMo"}})
game.playCard([0], {payload: {"username" : "MoNo"}})

game.voteFunniest(0, {payload: {"username" : "FoMo"}})

console.log(game); // 100