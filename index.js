const app = require('express')();
const http = require('http').createServer(app);
const io =  require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Limit number of clients/players/connections to two (two player game)
const connectionsLimit = 2;

io.on('connection', (socket) => {
  // If the number of connections is >= 2, don't allowed connection
  if (io.engine.clientsCount > connectionsLimit) {
    // Emit message to client that they can't join (prompts in browser window)
    socket.emit('err', { message: 'Application has reached the limit of connections'});
    // Disconnect client
    socket.emit('relocate-user');
    socket.disconnect();
    console.log('Disconnected...');
    // Break out of code
    return;
  }

  socket.on('disconnect', function() {
    resetGame();
    io.emit('game-reset');
  });

  console.log('connected');

  // If client is the first player (first connection), make them player one
  if (io.engine.clientsCount == 1) {
    // Send player initial data/turn
    socket.emit('player-info', {player: 1, turn: true});
  }

  // Send player two (second connection) initial data/turn
  if (io.engine.clientsCount == 2) {
    socket.emit('player-info', {player: 2, turn: false});
  }

  // When the player clicks their button to play a card, determine if it is
  // their turn, and update player values, gamestate, and game.
  socket.on('play-card', (playerID) => {
    console.log("Player " + playerID + " played a card");

    io.emit('card-info', ((playerID === 1) ? p1_deck[0] : p2_deck[0]), playerID);

    // Emit to ALL clients to update their turn/boolean value
    io.emit('turn-change');

    // Add one to the amount of cards played.
    cardsPlayedFunc();

    // If two cards have been played, set cardsPlayed back to 0 and call
    // compareCards(), passing in the first two cards (card objects) from each
    // deck (array)
    if (cardsPlayed == 2) {
      cardsPlayed = 0;

      let winnerID = compareCards(0);

      while (winnerID > 2) {
        io.emit('war-card-info', p1_deck[winnerID], p2_deck[winnerID]);
        winnerID = compareCards(winnerID);
      }

      if (winnerID == 1 || winnerID == 2) {
        io.emit('game-ended', winnerID);
        socket.disconnect();
      } else {
        io.emit('round-ended', roundWinnerID, p1_deck.length, p2_deck.length);
      }
    }
  });
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});

const suits = ["spades", "diamonds", "clubs", "hearts"];
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  let deck = new Array();

  for (let suit = 0; suit < suits.length; suit++) {
    for (let value = 0; value < values.length; value++) {
      let card = {Suit: suits[suit], Value: values[value]};
      deck.push(card);
    }
  }
  return deck;
}

function deckShuffle(deck) {
  for (let i = 0; i < 1000; i++) {
    let card1_index = Math.floor(Math.random() * deck.length);
    let card2_index = Math.floor(Math.random() * deck.length);
    let temp = deck[card1_index];

    deck[card1_index] = deck[card2_index];
    deck[card2_index] = temp;
  }
}

// After a round ends, update the player's decks (arrays)
function updateDeck(activeCardIndex, playerDeck) {
  // Create an empty array to store all the cards both players played
  let cardsPlayedArray = [];
  // For each card (index position), from 0 (beginning of deck), to the last
  // card played (activeCardIndex), add that card to the array, and remove that
  // card from its respective deck.
  for (let i = 0; i <= activeCardIndex; i++) {
    cardsPlayedArray.push(p1_deck[0]);
    p1_deck.shift();
    cardsPlayedArray.push(p2_deck[0]);
    p2_deck.shift();
  }
  playerDeck.push(...cardsPlayedArray);
}

// Start of round, zero cards are played
let cardsPlayed = 0;

// Each time a player plays a card, add one. On two (both players have played
// their) card, begin comparing values. Is reset to 0 every round.
function cardsPlayedFunc() {
  cardsPlayed++;
}

let roundWinnerID;

// Compare card values
function compareCards(cardIndex) {
  let activeCardIndex = cardIndex;
  console.log(activeCardIndex);
  // Depending on the round, get card value from card object Value
  let p1_cardValue = cardValue(p1_deck[activeCardIndex]);
  let p2_cardValue = cardValue(p2_deck[activeCardIndex]);

  // If a card value is higher, update the decks
  if (p1_cardValue > p2_cardValue) {
    updateDeck(activeCardIndex, p1_deck);
    roundWinnerID = 1;
  } else if (p2_cardValue > p1_cardValue) {
      updateDeck(activeCardIndex, p2_deck);
      roundWinnerID = 2;
  } else {
      let winnerID = checkWarWin(activeCardIndex + 4);

      if (winnerID == 1) {
        return 1;
      } else if (winnerID == 2) {
        return 2;
      }

      console.log("Enter war phase");
      return activeCardIndex + 4;
      // compareCards(activeCardIndex + 4);
  }

  let winner = checkWin();
  return winner;
}

function checkWin() {
  if (p1_deck.length == 0) {
    return 2;
  } else if (p2_deck.length == 0) {
    return 1;
  } else {
    return 0;
  }
}

function checkWarWin(activeCardIndex) {
  if (p1_deck.length < (activeCardIndex + 1)) {
    return 2;
  } else if (p2_deck.length < (activeCardIndex + 1)) {
    return 1;
  } else {
    return 0;
  }
}

// Take an array object with key's Suit and Value, return the Value as an int
function cardValue(card) {
  // Declare and initialize value
  let value = 0;
  // Switch statement using objects Value value (card.Value)
  switch (card.Value) {
    // Ace (A) high 14, Jack, Queen, King follow (J 11, Q 12, K 13)
    case "A":
      value = 14;
      break;
    case "J":
      value = 11;
      break;
    case "Q":
      value = 12;
      break;
    case "K":
      value = 13;
      break;
    // Everything else is a value 2-10
    default:
      // Convert from string to int
      value = parseInt(card.Value);
  }
  return value;
}

function resetGame() {
  deck = createDeck();
  deckShuffle(deck);
  p1_deck = deck.slice(0,26);
  p2_deck = deck.slice(26);
}

// create the deck
let deck = createDeck();

// Randomize the deck
deckShuffle(deck);

// Split the deck in half, one for each player
let p1_deck = deck.slice(0,26);
let p2_deck = deck.slice(26);

// Test cases
//let p1_deck = [{Value: '1'}, {Value: '3'}, {Value: '2'}, {Value: '1'}, {Value: '3'}, {Value: '10'}, {Value: '3'}, {Value: '2'}, {Value: '1'}, {Value: '3'}, {Value: '10'},{Value: '3'}, {Value: '2'}, {Value: '1'}, {Value: '3'}, {Value: '10'}];
//let p2_deck = [{Value: '2'}, {Value: '3'}, {Value: '1'}, {Value: '2'}, {Value: '4'}, {Value: '10'}, {Value: '3'}, {Value: '2'}, {Value: '1'}, {Value: '3'}, {Value: '10'},{Value: '3'}, {Value: '2'}, {Value: '1'}, {Value: '3'}, {Value: '10'}, {Value: '10'},{Value: '10'},{Value: '10'},{Value: '10'},{Value: '10'}];
