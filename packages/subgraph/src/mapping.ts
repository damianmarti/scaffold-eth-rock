import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  GameCreate,
  GameJoin,
  GameStart,
  RoundStart,
  PlayerCommit,
  PlayerReveal,
  RoundEnd,
  CommitEnd,
  GameWinner,
  GameEnd,
} from "../generated/Morra/Morra";
import { Game, GamePlayer, GameRound, GameRoundPlayer } from "../generated/schema";

export function handleGameCreate(event: GameCreate): void {
  let gameString = event.params.gameHash.toHexString();

  let game = new Game(gameString);
  game.creator = event.params.creator;
  game.status = "JoinPhase";
  game.started = false;
  game.playersCount = 1;
  game.round = 0;
  game.createdAt = event.block.timestamp;
  game.save();

  let gamePlayer = new GamePlayer(gameString + "-" + event.params.creator.toHexString());
  gamePlayer.game = gameString;
  gamePlayer.address = event.params.creator;
  gamePlayer.winner = false;
  gamePlayer.save();

/*
  let sender = Sender.load(senderString);

  if (sender === null) {
    sender = new Sender(senderString);
    sender.address = event.params.sender;
    sender.createdAt = event.block.timestamp;
    sender.purposeCount = BigInt.fromI32(1);
  } else {
    sender.purposeCount = sender.purposeCount.plus(BigInt.fromI32(1));
  }

  let purpose = new Purpose(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  purpose.purpose = event.params.purpose;
  purpose.sender = senderString;
  purpose.createdAt = event.block.timestamp;
  purpose.transactionHash = event.transaction.hash.toHex();

  purpose.save();
  sender.save();
  */
}

export function handleGameJoin(event: GameJoin): void {
  let gameString = event.params.gameHash.toHexString();

  let game = Game.load(gameString);
  if (game !== null) {
    game.playersCount += 1;
    game.save();

    let gamePlayer = new GamePlayer(gameString + "-" + event.params.player.toHexString());
    gamePlayer.game = gameString;
    gamePlayer.address = event.params.player;
    gamePlayer.winner = false;
    gamePlayer.save();
  }
}

export function handleGameStart(event: GameStart): void {
  let gameString = event.params.gameHash.toHexString();

  let game = Game.load(gameString);
  if (game !== null) {
    game.started = true;
    game.save();
  }
}

export function handleRoundStart(event: RoundStart): void {
  let gameString = event.params.gameHash.toHexString();
  let gameRoundString = gameString + "-" + event.params.round.toString();

  let game = Game.load(gameString);
  if (game !== null) {
    game.status = "CommitPhase";
    game.round = event.params.round;
    game.save();
  }

  let gameRound = new GameRound(gameRoundString);
  gameRound.game = gameString;
  gameRound.round = event.params.round;
  gameRound.finished = false;
  gameRound.save();
}

export function handlePlayerCommit(event: PlayerCommit): void {
  let gameRoundPlayerString = event.params.gameHash.toHexString() + "-" + event.params.player.toHexString() + "-" + event.params.round.toString();

  let gameRoundPlayer = GameRoundPlayer.load(gameRoundPlayerString);

  if (gameRoundPlayer === null) {
    let gamePlayerString = event.params.gameHash.toHexString() + "-" + event.params.player.toHexString();
    let gameRoundString = event.params.gameHash.toHexString() + "-" + event.params.round.toString();

    gameRoundPlayer = new GameRoundPlayer(gameRoundPlayerString);
    gameRoundPlayer.gameRound = gameRoundString;
    gameRoundPlayer.gamePlayer = gamePlayerString;
  }

  gameRoundPlayer.commited = true;
  gameRoundPlayer.revealed = false;
  gameRoundPlayer.save();
}

export function handleCommitEnd(event: CommitEnd): void {
  let gameString = event.params.gameHash.toHexString();

  let game = Game.load(gameString);
  if (game !== null) {
    game.status = "RevealPhase";
    game.save();
  }
}

export function handlePlayerReveal(event: PlayerReveal): void {
  let gameRoundPlayerString = event.params.gameHash.toHexString() + "-" + event.params.player.toHexString() + "-" + event.params.round.toString();

  let gameRoundPlayer = GameRoundPlayer.load(gameRoundPlayerString);
  if (gameRoundPlayer !== null) {
    gameRoundPlayer.revealed = true;
    gameRoundPlayer.number = event.params.number;
    gameRoundPlayer.total = event.params.total;
    gameRoundPlayer.save();
  }

  let gameRoundString = event.params.gameHash.toHexString() + "-" + event.params.round.toString();

  let gameRound = GameRound.load(gameRoundString);
  if (gameRound !== null) {
    gameRound.total += event.params.number;
    gameRound.save();
  }
}

export function handleRoundEnd(event: RoundEnd): void {
  let gameRoundString = event.params.gameHash.toHexString() + "-" + event.params.round.toString();

  let gameRound = GameRound.load(gameRoundString);
  if (gameRound !== null) {
    gameRound.total = event.params.total;
    gameRound.finished = true;
    gameRound.save();
  }
}

export function handleGameWinner(event: GameWinner): void {
  let gamePlayerString = event.params.gameHash.toHexString() + "-" + event.params.player.toHexString();

  let gamePlayer = GamePlayer.load(gamePlayerString);
  if (gamePlayer !== null) {
    gamePlayer.winner = true;
    gamePlayer.save();
  }
}

export function handleGameEnd(event: GameEnd): void {
  let gameString = event.params.gameHash.toHexString();

  let game = Game.load(gameString);
  if (game !== null) {
    game.status = "ResultPhase";
    game.save();
  }
}
