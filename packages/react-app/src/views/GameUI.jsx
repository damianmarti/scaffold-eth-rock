import { SyncOutlined } from "@ant-design/icons";
import { utils } from "ethers";
import { Button, Card, DatePicker, Divider, Input, Row, Col, Radio, notification, InputNumber, Table, List, Image } from "antd";
import React, { useState, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import { Address, Balance, Events } from "../components";
import { useEventListener } from "eth-hooks/events/useEventListener";
import humanizeDuration from "humanize-duration";
import Text from "antd/lib/typography/Text";
import { useContractReader } from "eth-hooks";
import { gql, useQuery } from "@apollo/client";

const { ethers } = require("ethers");

export default function GameUI({
  address,
  mainnetProvider,
  localProvider,
  tx,
  readContracts,
  writeContracts,
  DEBUG,
}) {
  // Possible Game States:
  const UIState = {
    NoGame: -1, // Show join / host options
    JoinPhase: 0,
    CommitPhase: 1,
    RevealPhase: 2,
    ResultPhase: 3,
  };
  const GameResult = {
    None: -1, // Show join / host options
    P1Win: 0,
    P2Win: 1,
    Draw: 2,
  };

  const activeGame = useParams().game;

  console.log("activeGame: ", activeGame);

  const history = useHistory();

  const [joinAddress, setJoinAddress] = useState();
  const [commitChoice, setCommitChoice] = useState();
  const [total, setTotal] = useState();
  const [commitSalt, setCommitSalt] = useState("");
  const [gameRoundsData, setGameRoundsData] = useState([]);

/*
  const filter = readContracts.Morra.filters.PlayerReveal(activeGame);

  console.log("filter: ", filter);

  const playerRevealEvents = useEventListener(readContracts, "Morra", "PlayerReveal", localProvider, 1);

  console.log("playerRevealEvents: ", playerRevealEvents);

  const roundEndEvents = useEventListener(readContracts, "Morra", "RoundEnd"); //, localProvider, 12686990);

  console.log("roundEndEvents: ", roundEndEvents);

  const playerCommitEvents = useEventListener(readContracts, "Morra", "PlayerCommit"); //, localProvider, 12686990);

  console.log("playerCommitEvents: ", playerCommitEvents);
*/

  const ROUNDS_GRAPHQL = `
    query($gameHash: String) {
      gameRounds(where: {game: $gameHash}) {
        id
        round
        total
        finished
        gameRoundPlayers {
          id
          commited
          revealed
          number
          total
          gamePlayer {
            id
            address
          }
        }
      }
    }
  `;

  const ROUNDS_GQL = gql(ROUNDS_GRAPHQL);
  const roundsResult = useQuery(ROUNDS_GQL, { variables: { gameHash: activeGame.toLowerCase() }, pollInterval: 1000 });

  console.log("roundsResult: ", roundsResult.data);

  const PLAYERS_GRAPHQL = `
    query($gameHash: String) {
      gamePlayers(where: {game: $gameHash}) {
        id
        address
      }
    }
  `;

  const PLAYERS_GQL = gql(PLAYERS_GRAPHQL);
  const playersResult = useQuery(PLAYERS_GQL, { variables: { gameHash: activeGame.toLowerCase() }, pollInterval: 1000 });

  console.log("playersResult: ", playersResult.data);

  //const activeGameData = useContractReader(readContracts, "Morra", "getActiveGameData", [address]);
  const activeGameData = useContractReader(readContracts, "Morra", "games", [activeGame]);
  console.log("activeGameData: ", activeGameData);

  const [players, setPlayers] = useState([]);
  const [pointsToWin, setPointsToWin] = useState(0);

  useEffect(() => {
    const updateRoundsData = async () => {
      console.log("Updating rounds data...", roundsResult.data, playersResult.data);
      if (playersResult.data && playersResult.data.gamePlayers.length > 0) {
        console.log("Updating rounds data2...");
        const roundsData = [];
        let pointsByPlayer = {};

        playersResult.data.gamePlayers.forEach(function (player) {
          pointsByPlayer[player.address] = 0;
        });

        if (roundsResult.data && roundsResult.data.gameRounds.length > 0) {
          roundsResult.data.gameRounds.forEach(function (round) {
            let roundData = { round: round.round, total: round.total, finished: round.finished };

            let playersByAddress = {};

            round.gameRoundPlayers.forEach(function (gameRoundPlayer) {
              playersByAddress[gameRoundPlayer.gamePlayer.address] = {
                commited: gameRoundPlayer.commited,
                revealed: gameRoundPlayer.revealed,
                number: gameRoundPlayer.number,
                total: gameRoundPlayer.total,
              };
            });

            const players = [];

            playersResult.data.gamePlayers.forEach(function (player) {
              let playerRoundData = { address: player.address, commited: false, revealed: false };

              const playerFromRound = playersByAddress[player.address];

              if (playerFromRound) {
                playerRoundData.commited = playerFromRound.commited;
                if (playerFromRound.revealed) {
                  playerRoundData.revealed = true;
                  playerRoundData.number = playerFromRound.number;
                  playerRoundData.total = playerFromRound.total;
                  if (round.finished) {
                    let points = playersResult.data.gamePlayers.length * 5 - Math.abs(playerFromRound.total - round.total);
                    playerRoundData.points = points;
                    pointsByPlayer[player.address] += points;
                  }
                }
              }
              players.push(playerRoundData);
            });

            roundData.players = players;
            roundsData.push(roundData);
          });

          console.log("roundsData: ", roundsData);
          setGameRoundsData(roundsData);
        }

        let playersWithPoints = [];

        playersResult.data.gamePlayers.forEach(function (player) {
          playersWithPoints.push({ address: player.address, points: pointsByPlayer[player.address] });
        });
        playersWithPoints.sort((a, b) => b.points - a.points);
        setPlayers(playersWithPoints);
      }
    };
    updateRoundsData();
  }, [DEBUG, roundsResult.data, playersResult.data]);

  const [playerData, setPlayerData] = useState([]);

  useEffect(() => {
    const updatePlayerData = async () => {
      console.log("Updating player data...");
      if (activeGameData) {
        const currentRoundData = gameRoundsData.find(roundData => roundData.round === activeGameData.round);
        console.log("currentRoundData: ", currentRoundData);
        if (currentRoundData) {
          const currentRoundDataForPlayer = currentRoundData.players.find(playerData => playerData.address === address.toLowerCase());
          console.log("currentRoundDataForPlayer: ", currentRoundDataForPlayer);
          if (currentRoundDataForPlayer) {
            setPlayerData(currentRoundDataForPlayer);
          }
        } else {
          setPlayerData(null);
        }
      }
    };
    updatePlayerData();
  }, [DEBUG, activeGameData, gameRoundsData, address]);

  useEffect(() => {
    const updatePointsToWin = async () => {
      console.log("Updating points to win..");
      if (players && players.length > 0) {
        setPointsToWin(players.length * 5 * 3);
      }
    };
    updatePointsToWin();
  }, [players]);

  function getRandomString(bytes) {
    const randomValues = new Uint8Array(bytes);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues).map(intToHex).join('');
  }

  function intToHex(nr) {
    return nr.toString(16).padStart(2, '0');
  }

  let revealTimeLeft;
  let commitTimeLeft;
  let playerHasCommitted = false;
  let playerHasRevealed = false;
  let currentUIState = UIState.NoGame;
  if (activeGameData) {
    const { initialized, gameState } = activeGameData;
    if (initialized) {
      currentUIState = gameState;
    }
  }
  if (playerData) {
    playerHasCommitted = playerData.commited;
    playerHasRevealed = playerData.revealed;
  }
  let gameStateMessage = "";
  if (currentUIState === UIState.JoinPhase) gameStateMessage = "Waiting for players to join";
  if (currentUIState === UIState.CommitPhase) {
    gameStateMessage = playerHasCommitted ? "Waiting for other player to play" : "Waiting for you to play";
    const timestamp = Math.round(Date.now() / 1000); //TODO Change to use block timestamp
    commitTimeLeft = activeGameData.commitDeadline > timestamp ? activeGameData.commitDeadline - timestamp : 0;
    console.log("commitTimeLeft", commitTimeLeft, typeof commitTimeLeft);
  }
  if (currentUIState === UIState.RevealPhase) {
    gameStateMessage = playerHasRevealed ? "Waiting for other player to reveal" : "Waiting for you to reveal";
    const timestamp = Math.round(Date.now() / 1000); //TODO Change to use block timestamp
    revealTimeLeft = activeGameData.revealDeadline > timestamp ? activeGameData.revealDeadline - timestamp : 0;
    console.log("revealTimeLeft", revealTimeLeft, typeof revealTimeLeft);
  }
  let winners;
  if (currentUIState === UIState.ResultPhase) {
    console.log("players: ", players);
    const maxPoints = Math.max(
      ...players.map(function (player) {
        return player.points;
      }),
    );
    console.log("maxPoints: ", maxPoints);
    const playersWithMaxPoints = players.filter(function (player) {
      return player.points === maxPoints;
    });
    winners =
      playersWithMaxPoints &&
      playersWithMaxPoints.map(function (player) {
        return player.address;
      });

    console.log("winners: ", winners);

    if (address && winners.includes(address.toLowerCase())) {
      gameStateMessage = <Image src='/images/win.png' alt='You Win!' title='You Win!' />;
    } else {
      gameStateMessage = <Image src='/images/lost.png' alt='You Win!' title='You Win!' />;
    }
  }

  const txnUpdate = update => {
    console.log("📡 Transaction Update:", update);
    if (update && (update.status === "confirmed" || update.status === 1)) {
      console.log(" 🍾 Transaction " + update.hash + " finished!");
      console.log(
        " ⛽️ " +
          update.gasUsed +
          "/" +
          (update.gasLimit || update.gas) +
          " @ " +
          parseFloat(update.gasPrice) / 1000000000 +
          " gwei",
      );
    }
  };
  const logTxn = async result => {
    console.log("awaiting metamask/web3 confirm result...", result);
    console.log(await result);
  };

  const joinGame = async () => {
    const result = tx(writeContracts.Morra.joinGame(joinAddress), txnUpdate);
    await logTxn(result);
  };
  const createGame = async () => {
    const result = tx(writeContracts.Morra.createGame(), txnUpdate);
    await logTxn(result);
  };
  const startGame = async () => {
    const result = tx(writeContracts.Morra.startGame(activeGame), txnUpdate);
    await logTxn(result);
  };
  const commit = async () => {
    if (!commitChoice) {
      notification["warning"]({
        message: "No choice selected",
        description: "Please choose a number between 0 and 5",
      });
      return;
    }
    if (!total) {
      notification["warning"]({
        message: "No total guess",
        description: "Please complete your total",
      });
      return;
    }

    const password = getRandomString(10);
    setCommitSalt(password);

    const hash = ethers.utils.solidityKeccak256(["uint8", "uint8", "string"], [commitChoice, total, password]);

    const result = tx(writeContracts.Morra.commit(hash), txnUpdate);
    await logTxn(result);
  };
  const reveal = async () => {
    if (!commitChoice) {
      notification["warning"]({
        message: "No choice selected",
        description: "Please choose a number between 0 and 5",
      });
      return;
    }
    if (!total) {
      notification["warning"]({
        message: "No total guess",
        description: "Please complete your total",
      });
      return;
    }
    const result = tx(writeContracts.Morra.reveal(commitChoice, total, commitSalt), txnUpdate);
    await logTxn(result);
  };
  const finishRound = async () => {
    const result = tx(writeContracts.Morra.determineWinnersAfterRevealTimeout(activeGame), txnUpdate);
    await logTxn(result);
  };
  const finishCommit = async () => {
    const result = tx(writeContracts.Morra.finishCommitPhaseAfterCommitTimeout(activeGame), txnUpdate);
    await logTxn(result);
  };
  const leaveGame = async () => {
    const result = tx(writeContracts.Morra.leaveGame(), txnUpdate);
    await logTxn(result);
    history.push("/");
  };

  const handleChangeTotal = value => {
    console.log("Total: ", value);
    setTotal(value);
  };

  const playersColumns = [
    {
      title: "#",
      dataIndex: "#",
      render: (text, record, index) => {
        return index + 1;
      },
    },
    {
      title: "Player",
      dataIndex: "player",
      render: (text, record, index) => {
        return <Address noCopy={true} value={record.address} ensProvider={mainnetProvider} fontSize={12} />;
      },
    },
    {
      title: "Score",
      dataIndex: "score",
      render: (text, record, index) => {
        return record.points;
      },
    },
  ];

  useEffect(() => {
    console.log("commitChoice: ", commitChoice);
    if (typeof commitChoice !== "undefined") {
      localStorage.setItem("commitChoice", JSON.stringify(commitChoice));
    }
  }, [commitChoice]);

  useEffect(() => {
    console.log("total: ", total);
    if (typeof total !== "undefined") {
      localStorage.setItem("total", JSON.stringify(total));
    }
  }, [total]);

  useEffect(() => {
    console.log("commitSalt: ", commitSalt);
    if (typeof commitSalt !== "undefined" && commitSalt !== "") {
      localStorage.setItem("commitSalt", JSON.stringify(commitSalt));
    }
  }, [commitSalt]);

  useEffect(() => {
    const commitChoiceText = localStorage.getItem("commitChoice");
    console.log("commitChoiceText: ", commitChoiceText);
    if (commitChoiceText !== "undefined") {
      const commitChoiceFromStorage = JSON.parse(commitChoiceText);
      if (commitChoiceFromStorage) {
        setCommitChoice(commitChoiceFromStorage);
      }
    }
    const totalFromStorageText = localStorage.getItem("total");
    console.log("totalFromStorageText: ", totalFromStorageText);
    if (totalFromStorageText !== "undefined") {
      const totalFromStorage = JSON.parse(totalFromStorageText);
      if (totalFromStorage) {
        setTotal(totalFromStorage);
      }
    }
    const commitSaltText = localStorage.getItem("commitSalt");
    console.log("commitSaltText: ", commitSaltText);
    if (commitSaltText !== "undefined") {
      const commitSaltFromStorage = JSON.parse(commitSaltText);
      if (commitSaltFromStorage) {
        setCommitSalt(commitSaltFromStorage);
      }
    }
  }, []);

  return (
    <div class="container">
      <div class="scores">
        <div class="corners">
          <ul >
              <li></li>
              <li></li>
          </ul>
          <ul >
              <li></li>
              <li></li>
          </ul>
        </div>
        <div class="content">
          {players && (
            <Table
              dataSource={players}
              columns={playersColumns}
              pagination={false}
            />
          )}
          <div className="points-to-win">*{pointsToWin} points to win or best of 5 rounds*</div>
        </div>
      </div>
      <div class="main">
        <div class="inside-main">
          <div class="inside-inside-main">
            <div class="active-game">
              <h2>Active Game</h2>
              {activeGame === "0x0000000000000000000000000000000000000000" || !activeGameData ? (
                <h3>-</h3>
              ) : (
                <>
                  <Address address={activeGame} ensProvider={mainnetProvider} fontSize={18} />
                </>
              )}
            </div>
            {currentUIState === UIState.NoGame && (
              <>
                <h2>Join Game</h2>
                <div style={{ margin: 8 }}>
                  <Input
                    placeholder="Game Address"
                    style={{ textAlign: "center" }}
                    onChange={e => {
                      setJoinAddress(e.target.value);
                    }}
                  />
                  <Button style={{ marginTop: 8 }} onClick={joinGame}>
                    Join
                  </Button>
                </div>
                <Divider />
                <h2>Create new Game</h2>
                <div style={{ margin: 8 }}>
                  <Button style={{ marginTop: 8 }} onClick={createGame}>
                    Create
                  </Button>
                </div>
                <Divider />
              </>
            )}
            {currentUIState === UIState.JoinPhase && (
              <>
                <h1>{gameStateMessage}</h1>

                <h3>Send them the game address above so they can join</h3>

                {activeGameData.creator === address && (
                  <div style={{ margin: 8 }}>
                    <Button type="primary" style={{ marginTop: 8, marginBottom: 20, width: 250, height: 50, fontSize: 24 }} onClick={startGame}>
                      Start
                    </Button>
                  </div>
                )}
              </>
            )}
            {currentUIState === UIState.CommitPhase && (
              <>
                <div className="game-data">
                  <h2>Your Points: {activeGameData && activeGameData.points && activeGameData.points.toString()}</h2>
                  <h2>Round {activeGameData.round.toString()}</h2>
                  <h1>{gameStateMessage}</h1>
                </div>
                {!playerHasCommitted ? (
                  <>
                    <div id="hands-play" style={{ margin: 8 }}>
                      <Radio.Group buttonStyle="solid">
                        <Radio.Button
                          value="0"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 33,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/0.png"} alt="0" title="0" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>0</div>
                        </Radio.Button>
                        <Radio.Button
                          value="1"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 18,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/1.png"} alt="1" title="1" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>1</div>
                        </Radio.Button>
                        <Radio.Button
                          value="2"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 9,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/2.png"} alt="2" title="2" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>2</div>
                        </Radio.Button>
                        <Radio.Button
                          value="3"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 11,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/3.png"} alt="3" title="3" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>3</div>
                        </Radio.Button>
                        <Radio.Button
                          value="4"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 8,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/4.png"} alt="4" title="4" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>4</div>
                        </Radio.Button>
                        <Radio.Button
                          value="5"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 19,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/5.png"} alt="5" title="5" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>5</div>
                        </Radio.Button>
                      </Radio.Group>
                      <div style={{ display: "flex", marginTop: 30, justifyContent: "center" }}>
                        <div style={{ margin: 0, width: 150 }}>
                          <label style={{ fontSize: 20 }}>Your guess</label>
                          <InputNumber
                            value={total}
                            min="0"
                            max="100"
                            step="1"
                            placeholder="Total"
                            onChange={handleChangeTotal}
                            style={{ width: 126 }}
                          />
                        </div>
                        <div style={{ margin: 0, width: 150 }}>
                          <Button className="play-button" onClick={commit}>
                            Play
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="commit-timeout">
                    <h2>Time left</h2>
                    {commitTimeLeft !== undefined && (
                      <>
                        <h2>{humanizeDuration(commitTimeLeft * 1000)}</h2>
                        <h3>If the other players fails to play in time, you can finish the play phase and move to the reveal phase</h3>
                      </>
                    )}
                    {commitTimeLeft === 0 && (
                      <Button className="move-to-reveal-button" onClick={finishCommit}>
                        Move to Reveal Phase
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
            {currentUIState === UIState.RevealPhase && (
              <>
                <div style={{ margin: 8 }}>
                  <h2>Round {activeGameData.round.toString()}</h2>
                  <h1>{gameStateMessage}</h1>
                </div>
                <div id="hands-reveal" style={{ margin: 8 }}>
                  {!playerHasRevealed ? (
                    <>
                      <Radio.Group buttonStyle="solid" value={commitChoice}>
                        <Radio.Button
                          value="0"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 33,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/0.png"} alt="0" title="0" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>0</div>
                        </Radio.Button>
                        <Radio.Button
                          value="1"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 18,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/1.png"} alt="1" title="1" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>1</div>
                        </Radio.Button>
                        <Radio.Button
                          value="2"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 9,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/2.png"} alt="2" title="2" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>2</div>
                        </Radio.Button>
                        <Radio.Button
                          value="3"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 11,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/3.png"} alt="3" title="3" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>3</div>
                        </Radio.Button>
                        <Radio.Button
                          value="4"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 8,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/4.png"} alt="4" title="4" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>4</div>
                        </Radio.Button>
                        <Radio.Button
                          value="5"
                          style={{
                            height: 121,
                            width: 121,
                            paddingTop: 19,
                            boxShadow: "5px 5px rgb(66,61,69)",
                            marginRight: 10,
                            marginTop: 10,
                          }}
                          onChange={e => setCommitChoice(e.target.value)}
                        >
                          <Image preview={false} src={"/images/hands/5.png"} alt="5" title="5" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>5</div>
                        </Radio.Button>
                      </Radio.Group>
                      <div style={{ display: "flex", marginTop: 30, justifyContent: "center" }}>
                        <div style={{ margin: 0, width: 150 }}>
                          <label style={{ fontSize: 20 }}>Your guess</label>
                          <InputNumber
                            value={total}
                            min="0"
                            max="100"
                            step="1"
                            placeholder="Total"
                            disabled={true}
                          />
                        </div>
                        <div style={{ margin: 0, width: 150 }}>
                          <Button className="play-button" onClick={reveal}>
                            Reveal
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="reveal-timeout">
                      <h2>Time left</h2>
                      {revealTimeLeft !== undefined && (
                        <>
                          <h2>{humanizeDuration(revealTimeLeft * 1000)}</h2>
                          <h3>If the other players fails to reveal in time, you can finish this round</h3>
                        </>
                      )}
                      {revealTimeLeft === 0 && (
                        <Button className="finish-round-button" onClick={finishRound}>
                          Finish Round
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {currentUIState === UIState.ResultPhase && (
              <>
                <div style={{ margin: 8 }}>
                  <h2>Your Points: <strong>{address && players.find(player => player.address === address.toLowerCase()).points}</strong></h2>
                  <h1>{gameStateMessage}</h1>
                </div>
                <div style={{ margin: 8 }}>
                  <h3>Winners</h3>
                  <Row>
                    {winners && winners.map(function(player, i) {
                      return (
                        <Col
                          span={12}
                          style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
                        >
                          <Address address={player} ensProvider={mainnetProvider} fontSize={14} />
                        </Col>
                      )
                    })}
                  </Row>
                </div>
                <Divider />
                <Button style={{ marginTop: 8 }} onClick={leaveGame}>
                  New Game 🔁
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div class="rounds">
        <div class="rounds-corners">
            <ul >
                <li></li>
                <li></li>
            </ul>
            <ul >
                <li></li>
                <li></li>
            </ul>
        </div>
        <div class="content">
          <List
            itemLayout="vertical"
            size="large"
            pagination={{
              pageSize: 1,
            }}
            dataSource={gameRoundsData}
            renderItem={item => (
              <List.Item key={item.round}>
                <h3>Round {item.round}</h3>
                {item.finished ? <h4>Ended - Total {item.total}</h4> : <h4>Playing</h4>}
                <List
                  grid={{ column: 2 }}
                  className="round-data"
                  dataSource={item.players}
                  renderItem={player => (
                    <List.Item>
                      <Card title={
                        <Row
                          span={12}
                          style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
                        >
                          <Address noCopy={true} value={player.address} ensProvider={mainnetProvider} fontSize={12} />
                        </Row>
                      }>
                        {item.finished && player.revealed && (
                          <div class="finished"><Image style={{width: 20 }} src={"/images/hands/"+player.number+".png"} alt={player.number} title={player.number} /> Total: {player.total} (<strong>{player.points}</strong>)</div>
                        )}
                        {item.finished && !player.revealed && (
                          <span class="noplayed">No played!</span>
                        )}
                        {!item.finished && currentUIState === UIState.CommitPhase && player.commited && (
                          <span class="commited">Played</span>
                        )}
                        {!item.finished && currentUIState === UIState.CommitPhase && !player.commited && (
                          <span class="uncommited">Waiting to play</span>
                        )}
                        {!item.finished && currentUIState === UIState.RevealPhase && player.revealed && (
                          <span class="revealed">Revealed</span>
                        )}
                        {!item.finished && currentUIState === UIState.RevealPhase && !player.revealed && (
                          <span class="unrevealed">Waiting to reveal</span>
                        )}
                      </Card>
                    </List.Item>
                  )}
                />
              </List.Item>
            )}
          />
        </div>
      </div>
    </div>
  );
}
