require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

// const CAH_CARDS = require("./CAH_cards")
// const CAH = require("./CAH")
// const Game = CAH.Game

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
    GAME.join(BODY)
  }
}

function joinUserToGame(BODY) {
  console.log("JOIN")
  if(GAME != null) {
    GAME.join(BODY)
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
        'to_jid': BODY.payload.userJid, // TRYING SOMETHING
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
        this.sendMessage("Waiting for " + (this.NUMBER_OF_PLAYERS - this.USERS.length) + " player(s)")
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

      this.sendMessage("You have chosen " + CARD_INDICES, USER)

      if(this.CURRENTLY_PLAYED_NUMBER_OF_PLAYERS >= this.NUMBER_OF_PLAYERS - 1) {
         this.startJudgingRound()
      }
    } else {
      this.sendMessage("You are the Czar, you can't play at this point.", USER)
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
    this.sendMessage("You are the Czar for this round.", USER)
    this.sendMessage("Wait until everyone is finished and then pick the funniest combination.", USER)
  }

  sendPlayerMessage(USER, INDEX) {
    this.sendMessage("YOUR DECK:", USER)
    this.printDeckForUser(USER, INDEX)
    this.sendMessage("Please select the funniest card(s).", USER)
  }

  printDeckForUser(USER, INDEX) {
    for(var i = 0; i < this.USERS_DECKS[INDEX].length; i++) {
      this.sendMessage((i) + ":  " + this.USERS_DECKS[INDEX][i], USER)
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

  sendMessage(text, USER = this.GAME_CHATBOT_STATE_DICT) {
    sendChat(USER.payload.userJid, USER.payload.accountId, "Cards Against Boredom", text, CHATBOT_TOKEN)
  }
}

var CHATBOT_TOKEN = "";

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
      if (!error && body.code != 7010) {
        console.log("Chat successful...")
        console.log(body)
      } else {
        console.log("Refreshing token...")
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
            console.log('Succesfully obtained the chatbot token from Zoom...')
            body = JSON.parse(body)
            CHATBOT_TOKEN = body.access_token
            sendChat(toJid, accountId, head, text, body.access_token)
          }
        })
      }
    })
  }

/*
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
*/

function getDeck() {
  return { black: black(), white: white() };
}

function black() {
  return [
    "A romantic candlelit dinner would be incomplete without __________.",
    "After Hurricane Katrina, Sean Penn brought __________ to the people of New Orleans.",
    "After the earthquake, Sean Penn brought __________ to the people of Haiti.",
    "Alternative medicine is now embracing the curative powers of __________.",
    "And I would have gotten away with it, too, if it hadn't been for __________.",
    "Anthropologists have recently discovered a primitive tribe that worships __________.",
    "BILLY MAYS HERE FOR __________.",
    "Betcha can't have just one!",
    "But before I kill you, Mr. Bond, I must show you __________.",
    "Coming to Broadway this season, __________: The Musical.",
    "Dear Abby, I'm having some trouble with __________ and would like your advice.",
    "Due to a PR fiasco, Walmart no longer offers __________.",
    "During Picasso's often-overlooked Brown Period, he produced hundreds of paintings of __________.",
    "During sex, I like to think about __________.",
    "He who controls __________ controls the world.",
    "How am I maintaining my relationship status?",
    "I do not know with what weapons World War III will be fought, but World War IV will be fought with __________.",
    "I drink to forget __________.",
    "I got 99 problems but __________ ain't one.",
    "I learned the hard way that you can't cheer up a grieving friend with __________.",
    "I wish I hadn't lost the instruction manual for __________.",
    "I'm sorry, Professor, but I couldn't complete my homework because of __________.",
    "In 1,000 years, when paper money is but a distant memory, __________ will be our currency.",
    "In L.A. County Jail, word is you can trade 200 cigarettes for __________.",
    "In Michael Jackson's final moments, he thought about __________.",
    "In Rome, there are whisperings that the Vatican has a secret room devoted to __________.",
    "In an attempt to reach a wider audience, the Smithsonian Museum of Natural History has opened an interactive exhibit on __________.",
    "In his new self-produced album, Kanye West raps over the sounds of __________.",
    "In its new tourism campaign, Detroit proudly proclaims that it has finally eliminated __________.",
    "In the distant future, historians will agree that __________ marked the beginning of America's decline.",
    "In the new Disney Channel Original Movie, Hannah Montana struggles with __________ for the first time. ",
    "Instead of coal, Santa now gives the bad children __________.",
    "It's a pity that kids these days are all getting involved with __________.",
    "It's a trap!",
    "Life for American Indians was forever changed when the White Man introduced them to __________.",
    "Life was difficult for cavemen before __________.",
    "MTV's new reality show features eight washed-up celebrities living with __________.",
    "Major League Baseball has banned __________ for giving players an unfair advantage.",
    "Maybe she's born with it. Maybe it's __________.",
    "Next from J.K. Rowling: Harry Potter and the Chamber of __________.",
    "Next on ESPN2: The World Series of __________.",
    "Science will never explain the origin of __________.",
    "Sorry everyone, I just __________.",
    "Studies show that lab rats navigate mazes 50% faster after being exposed to __________.",
    "TSA guidelines now prohibit __________ on airplanes.",
    "The CIA now interrogates enemy agents by repeatedly subjecting them to __________.",
    "The U.S. has begun airdropping __________ to the children of Afghanistan.",
    "The class field trip was completely ruined by __________.",
    "The socialist governments of Scandinavia have declared that access to __________ is a basic human right.",
    "This is the way the world ends / This is the way the world ends / Not with a bang but with __________.",
    "This season on Man vs. Wild, Bear Grylls must survive in the depths of the Amazon with only __________ and his wits. ",
    "War! What is it good for?",
    "What am I giving up for Lent?",
    "What are my parents hiding from me?",
    "What brought the orgy to a grinding halt?",
    "What did I bring back from Mexico?",
    "What did Vin Diesel eat for dinner?",
    "What did the US airdrop to the children of Afghanistan?",
    "What do old people smell like?",
    "What does Dick Cheney prefer?",
    "What don't you want to find in your Chinese food?",
    "What ended my last relationship?",
    "What gets better with age?",
    "What gives me uncontrollable gas?",
    "What has been making life difficult at the nudist colony?",
    "What helps Obama unwind?",
    "What is Batman's guilty pleasure?",
    "What never fails to liven up the party?",
    "What will I bring back in time to convince people that I am a powerful wizard?",
    "What will always get you laid?",
    "What would grandma find disturbing, yet oddly charming?",
    "What's Teach for America using to inspire inner city students to succeed?",
    "What's a girl's best friend?",
    "What's my anti-drug?",
    "What's my secret power?",
    "What's that smell?",
    "What's that sound?",
    "What's the crustiest?",
    "What's the gift that keeps on giving?",
    "What's the most emo?",
    "What's the new fad diet?",
    "What's the next Happy Meal toy?",
    "What's there a ton of in heaven?",
    "When I am President of the United States, I will create the Department of __________.",
    "When I am a billionaire, I shall erect a 50-foot statue to commemorate __________.",
    "When I pooped, what came out of my butt?",
    "When I'm in prison, I'll have __________ smuggled in.",
    "When Pharaoh remained unmoved, Moses called down a Plague of __________.",
    "When all else fails, I can always masturbate to __________.",
    "While the United States raced the Soviet Union to the moon, the Mexican government funneled millions of pesos into research on __________.",
    "White people like __________.",
    "Who stole the cookies from the cookie jar?",
    "Why am I sticky?",
    "Why can't I sleep at night?",
    "Why do I hurt all over?",
    "__________. Betcha can't have just one!",
    "__________. High five, bro.",
    "__________. It's a trap!",
    "__________. That's how I want to die.",
    "__________: Good to the last drop.",
    "__________: Kid-tested, mother-approved.",
    "__________: good to the last drop.",
    "__________: kid tested, mother approved.",
    "__________? There's an app for that.",
  ];
}

function white() {
  return [
   "72 virgins",
   "8 oz. of sweet Mexican black-tar heroin",
   "A Bop It™",
   "A Gypsy curse",
   "A Super Soaker™ full of cat pee",
   "A bag of magic beans",
   "A balanced breakfast",
   "A beached whale",
   "A big black dick",
   "A big hoopla about nothing",
   "A bleached asshole",
   "A bloody pacifier",
   "A brain tumor",
   "A can of whoop-ass",
   "A clandestine butt scratch",
   "A cooler full of organs",
   "A crappy little hand",
   "A death ray",
   "A defective condom",
   "A disappointing birthday party",
   "A drive-by shooting",
   "A falcon with a cap on its head",
   "A fetus",
   "A foul mouth",
   "A gassy antelope",
   "A gentle caress of the inner thigh",
   "A good sniff",
   "A homoerotic volleyball montage",
   "A hot mess",
   "A lifetime of sadness",
   "A look-see",
   "A low standard of living",
   "A mating display",
   "A micropenis",
   "A middle-aged man on roller skates",
   "A mime having a stroke",
   "A moment of silence",
   "A monkey smoking a cigar",
   "A mopey zoo lion",
   "A murder most foul",
   "A nuanced critique",
   "A passionate Latino lover",
   "A really cool hat",
   "A rival dojo",
   "A robust mongoloid",
   "A sad handjob",
   "A salty surprise",
   "A sassy black woman",
   "A sausage festival",
   "A sea of troubles",
   "A snapping turtle biting the tip of your penis",
   "A stray pube",
   "A thermonuclear detonation",
   "A time travel paradox",
   "A tiny horse",
   "A web of lies",
   "A windmill full of corpses",
   "A woman scorned",
   "A zesty breakfast burrito",
   "AIDS",
   "AXE Body Spray",
   "Aaron Burr",
   "Active listening",
   "Actually taking candy from a baby",
   "Adderall™",
   "African children",
   "Agriculture",
   "Alcoholism",
   "All-you-can-eat shrimp for $4.99",
   "Altar boys",
   "American Gladiators",
   "Amputees",
   "An M. Night Shyamalan plot twist",
   "An Oedipus complex",
   "An asymmetric boob job",
   "An erection that lasts longer than four hours",
   "An honest cop with nothing left to lose",
   "An icepick lobotomy",
   "Anal beads",
   "Another goddamn vampire movie",
   "Apologizing",
   "Appreciative snapping",
   "Arnold Schwarzenegger",
   "Asians who aren't good at math",
   "Assless chaps",
   "Attitude",
   "Auschwitz",
   "Authentic Mexican cuisine",
   "Autocannibalism",
   "BATMAN!!",
   "Balls",
   "Barack Obama",
   "Beating your wives",
   "Bees",
   "Being a busy adult with many important things to do",
   "Being a dick to children",
   "Being a dinosaur",
   "Being a motherfucking sorcerer",
   "Being fabulous",
   "Being marginalized",
   "Being on fire",
   "Being rich",
   "Bill Nye the Science Guy",
   "Bingeing and purging",
   "Bitches",
   "Black people",
   "Bling",
   "Booby-trapping the house to foil burglars",
   "Boogers",
   "Bosnian chicken farmers",
   "Breaking out into song and dance",
   "Britney Spears at 55",
   "Cards Against Humanity",
   "Carnies",
   "Catapults",
   "Centaurs",
   "Chainsaws for hands",
   "Charisma",
   "Cheating in the Special Olympics",
   "Child abuse",
   "Child beauty pageants",
   "Children on leashes",
   "Chivalry",
   "Christopher Walken",
   "Chutzpah",
   "Civilian casualties",
   "Clams",
   "Classist undertones",
   "Coat hanger abortions",
   "Cockfights",
   "College",
   "Concealing a boner",
   "Consultants",
   "Copping a feel",
   "Coughing into a vagina",
   "Count Chocula",
   "Crippling debt",
   "Crystal meth",
   "Cuddling",
   "Customer service representatives",
   "Cybernetic enhancements",
   "Daddy issues",
   "Dancing with a broom",
   "Darth Vader",
   "Dead babies",
   "Dead parents",
   "Deflowering the princess",
   "Dental dams",
   "Dick Cheney",
   "Dick fingers",
   "Doin' it in the butt",
   "Doing the right thing",
   "Domino's™ Oreo™ Dessert Pizza",
   "Dorito breath",
   "Drinking alone",
   "Dropping a chandelier on your enemies and riding the rope up",
   "Dry heaving",
   "Dwarf tossing",
   "Dying of dysentery",
   "Dying",
   "Eating all of the cookies before the AIDS bake-sale",
   "Eating an albino",
   "Eating the last known bison",
   "Edible underpants",
   "Elderly Japanese men",
   "Embryonic stem cells",
   "Emotions",
   "Enormous Scandinavian women",
   "Erectile dysfunction",
   "Estrogen",
   "Ethnic cleansing",
   "Eugenics",
   "Euphoria™ by Calvin Klein",
   "Exactly what you'd expect",
   "Exchanging pleasantries",
   "Expecting a burp and vomiting on the floor",
   "Explosions",
   "Fabricating statistics",
   "Famine",
   "Fancy Feast",
   "Farting and walking away",
   "Fear itself",
   "Feeding Rosie O'Donnell",
   "Fiery poops",
   "Figgy pudding",
   "Finding a skeleton",
   "Finger painting",
   "Fingering",
   "Firing a rifle into the air while balls deep in a squealing hog",
   "Five-Dollar Footlongs™",
   "Flash flooding",
   "Flesh-eating bacteria",
   "Flightless birds",
   "Flying sex snakes",
   "Foreskin",
   "Forgetting the Alamo",
   "Former President George W. Bush",
   "Free samples",
   "Friction",
   "Friendly fire",
   "Friends who eat all the snacks",
   "Friends with benefits",
   "Frolicking",
   "Full frontal nudity",
   "Gandalf",
   "Gandhi",
   "Geese",
   "Genetically engineered super-soldiers",
   "Genghis Khan",
   "Genital piercings",
   "George Clooney's musk",
   "German dungeon porn",
   "Getting abducted by Peter Pan",
   "Getting drunk on mouthwash",
   "Getting in her pants, politely",
   "Getting naked and watching Nickelodeon",
   "Getting really high",
   "Getting so angry that you pop a boner",
   "Ghosts",
   "Giving 110 percent",
   "Gladiatorial combat",
   "Glenn Beck being harried by a swarm of buzzards",
   "Glenn Beck catching his scrotum on a curtain hook",
   "Glenn Beck convulsively vomiting as a brood of crab spiders hatches in his brain and erupts from his tear ducts",
   "Global warming",
   "Gloryholes",
   "GoGurt",
   "Goats eating cans",
   "Goblins",
   "God",
   "Golden showers",
   "Good grammar",
   "Grandma",
   "Grave robbing",
   "Guys who don't call",
   "Half-assed foreplay",
   "Harry Potter erotica",
   "Heartwarming orphans",
   "Her Royal Highness, Queen Elizabeth II",
   "Heteronormativity",
   "Hipsters",
   "Historical revisionism",
   "Historically black colleges",
   "Home video of Oprah sobbing into a Lean Cuisine",
   "Homeless people",
   "Hope",
   "Hormone injections",
   "Horrifying laser hair removal accidents",
   "Horse meat",
   "Hot Pockets",
   "Hot cheese",
   "Hot people",
   "Hulk Hogan",
   "Hurricane Katrina",
   "Inappropriate yodeling",
   "Incest",
   "Insatiable bloodlust",
   "Intelligent design",
   "Italians",
   "Jafar",
   "Jean-Claude Van Damme",
   "Jerking off into a pool of children's tears",
   "Jew-fros",
   "Jewish fraternities",
   "Jibber-jabber",
   "John Wilkes Booth",
   "Judge Judy",
   "Just the tip",
   "Justin Bieber",
   "Kamikaze pilots",
   "Kanye West",
   "Keanu Reeves",
   "Keg stands",
   "Kids with ass cancer",
   "Kim Jong-il",
   "Lactation",
   "Lady Gaga",
   "Lance Armstrong's missing testicle",
   "Land mines",
   "Laying an egg",
   "Leaving an awkward voicemail",
   "Leprosy",
   "Leveling up",
   "Licking things to claim them as your own",
   "Literally eating shit",
   "Lockjaw",
   "Loose lips",
   "Lumberjack fantasies",
   "Lunchables™",
   "Mad hacky-sack skills",
   "Making a pouty face",
   "Making the penises kiss",
   "Man meat",
   "Masturbation",
   "Mathletes",
   "Me time",
   "MechaHitler",
   "Media coverage",
   "Medieval Times Dinner and Tournament",
   "Men",
   "Menstruation",
   "Michael Jackson",
   "Michelle Obama's arms",
   "Moral ambiguity",
   "Morgan Freeman's voice",
   "Mouth herpes",
   "Mr. Clean, right behind you",
   "Muhammad (Praise Be Unto Him)",
   "Multiple stab wounds",
   "Mutually-assured destruction",
   "My collection of high-tech sex toys",
   "My genitals",
   "My humps",
   "My inner demons",
   "My machete",
   "My relationship status",
   "My sex life",
   "My soul",
   "My vagina",
   "Natalie Portman",
   "Natural male enhancement",
   "Natural selection",
   "Nazis",
   "Necrophilia",
   "Neil Patrick Harris",
   "New Age music",
   "Nickelback",
   "Nicolas Cage",
   "Nipple blades",
   "Nocturnal emissions",
   "Not giving a shit about the Third World",
   "Not reciprocating oral sex",
   "Nubile slave boys",
   "Obesity",
   "Object permanence",
   "Old-people smell",
   "Ominous background music",
   "One thousand Slim Jims",
   "Oompa-Loompas",
   "Opposable thumbs",
   "Overcompensation",
   "Overpowering your father",
   "Oversized lollipops",
   "Pabst Blue Ribbon",
   "Pac-Man uncontrollably guzzling cum",
   "Panda sex",
   "Panty raids",
   "Parting the Red Sea",
   "Party poopers",
   "Passable transvestites",
   "Passing a kidney stone",
   "Passive-aggressive Post-it notes",
   "Pedophiles",
   "Peeing a little bit",
   "Penis envy",
   "Picking up girls at the abortion clinic",
   "Pictures of boobs",
   "Pistol-whipping a hostage",
   "Pixelated bukkake",
   "Police brutality",
   "Pooping back and forth. Forever",
   "Poor life choices",
   "Poor people",
   "Poorly-timed Holocaust jokes",
   "Porn stars",
   "Powerful thighs",
   "Prancing",
   "Praying the gay away",
   "Preteens",
   "Pretending to care",
   "Pterodactyl eggs",
   "Puberty",
   "Public ridicule",
   "Pulling out",
   "Puppies",
   "Queefing",
   "Quiche",
   "Quivering jowls",
   "Racially-biased SAT questions",
   "Racism",
   "Raptor attacks",
   "Re-gifting",
   "Repression",
   "Republicans",
   "Revenge fucking",
   "Riding off into the sunset",
   "Ripping into a man's chest and pulling out his still-beating heart",
   "Road head",
   "Robert Downey, Jr",
   "RoboCop",
   "Ronald Reagan",
   "Roofies",
   "Ryan Gosling riding in on a white horse",
   "Same-sex ice dancing",
   "Santa Claus",
   "Sarah Palin",
   "Saxophone solos",
   "Scalping",
   "Science",
   "Scientology",
   "Scrotum tickling",
   "Scrubbing under the folds",
   "Sean Connery",
   "Sean Penn",
   "Seduction",
   "Self-loathing",
   "Seppuku",
   "Serfdom",
   "Sexting",
   "Sexual humiliation",
   "Sexual tension",
   "Sexy Siamese twins",
   "Sexy pillow fights",
   "Shaft",
   "Shapeshifters",
   "Shaquille O'Neal's acting career",
   "Sharing needles",
   "Skeletor",
   "Slow motion",
   "Smallpox blankets",
   "Smegma",
   "Sniffing glue",
   "Soiling oneself",
   "Soup that is too hot",
   "Space muffins",
   "Spectacular abs",
   "Sperm whales",
   "Spontaneous human combustion",
   "Statistically validated stereotypes",
   "Stephen Hawking talking dirty",
   "Stifling a giggle at the mention of Hutus and Tutsis",
   "Stranger danger",
   "Sudden Poop Explosion Disease",
   "Suicidal thoughts",
   "Sunshine and rainbows",
   "Surprise sex",
   "Sweet, sweet vengeance",
   "Switching to Geico",
   "Swooping",
   "Take-backsies",
   "Taking off your shirt",
   "Tangled Slinkys",
   "Tasteful sideboob",
   "Teaching a robot to love",
   "Team-building exercises",
   "Teenage pregnancy",
   "Tentacle porn",
   "Testicular torsion",
   "That thing that electrocutes your abs",
   "The American Dream",
   "The Amish",
   "The Big Bang",
   "The Blood of Christ",
   "The Care Bear Stare",
   "The Chinese gymnastics team",
   "The Dance of the Sugar Plum Fairy",
   "The Donald Trump Seal of Approval™",
   "The Fanta girls",
   "The Force",
   "The Gulags",
   "The Hamburglar",
   "The Holy Bible",
   "The Hustle",
   "The Jews",
   "The KKK",
   "The Kool-Aid Man",
   "The Little Engine That Could",
   "The Make-A-Wish Foundation",
   "The Pope",
   "The Rapture",
   "The Rev. Dr. Martin Luther King, Jr",
   "The South",
   "The Tempur-Pedic Swedish Sleep System™",
   "The Three-Fifths compromise",
   "The Trail of Tears",
   "The Underground Railroad",
   "The Virginia Tech Massacre",
   "The World of Warcraft",
   "The boners of the elderly",
   "The chronic",
   "The clitoris",
   "The economy",
   "The folly of man",
   "The forbidden fruit",
   "The four arms of Vishnu",
   "The gays",
   "The glass ceiling",
   "The hardworking Mexican",
   "The harsh light of day",
   "The heart of a child",
   "The hiccups",
   "The homosexual agenda",
   "The inevitable heat death of the universe",
   "The invisible hand",
   "The milk man",
   "The miracle of childbirth",
   "The placenta",
   "The profoundly handicapped",
   "The shambling corpse of Larry King",
   "The taint; the grundle; the fleshy fun-bridge",
   "The terrorists",
   "The token minority",
   "The true meaning of Christmas",
   "The violation of our most basic human rights",
   "The Übermensch",
   "Third base",
   "Tom Cruise",
   "Toni Morrison's vagina",
   "Too much hair gel",
   "Tripping balls",
   "Tweeting",
   "Two midgets shitting into a bucket",
   "Unfathomable stupidity",
   "Uppercuts",
   "Vehicular manslaughter",
   "Viagra",
   "Vigilante justice",
   "Vigorous jazz hands",
   "Vikings",
   "Waiting ‘til marriage",
   "Waking up half-naked in a Denny's parking lot",
   "Waterboarding",
   "Wearing underwear inside-out to avoid doing laundry",
   "When you fart and a little bit comes out",
   "Whipping it out",
   "White people",
   "White privilege",
   "Wifely duties",
   "William Shatner",
   "Winking at old people",
   "Wiping her butt",
   "Women in yogurt commercials",
   "Women's suffrage",
   "Words, words, words",
   "World peace",
   "YOU MUST CONSTRUCT ADDITIONAL PYLONS",
   "Yeast",
   "Zeus's sexual appetites",
  ];
}
