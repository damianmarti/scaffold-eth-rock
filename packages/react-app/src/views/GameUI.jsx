import {
  Button,
  Card,
  Divider,
  Row,
  Col,
  Radio,
  notification,
  InputNumber,
  Table,
  List,
  Image,
  Modal,
  Popconfirm,
  Spin,
} from "antd";
import React, { useState, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import { Address, GameAddress } from "../components";
import humanizeDuration from "humanize-duration";
import { useContractReader } from "eth-hooks";
import { gql, useQuery } from "@apollo/client";

const { ethers } = require("ethers");

export default function GameUI({ address, mainnetProvider, tx, readContracts, writeContracts, DEBUG }) {
  // Possible Game States:
  const UIState = {
    NoGame: -1, // Show join / host options
    JoinPhase: "JoinPhase",
    CommitPhase: "CommitPhase",
    RevealPhase: "RevealPhase",
    ResultPhase: "ResultPhase",
  };

  const activeGame = useParams().game;
  if (DEBUG) console.log("activeGame: ", activeGame);

  const history = useHistory();

  const [commitChoice, setCommitChoice] = useState();
  const [total, setTotal] = useState();
  const [commitSalt, setCommitSalt] = useState("");
  const [gameRoundsData, setGameRoundsData] = useState([]);
  const [players, setPlayers] = useState([]);
  const [pointsToWin, setPointsToWin] = useState(0);
  const [playerData, setPlayerData] = useState();
  const [playerJoined, setPlayerJoined] = useState(false);
  const [roundsCurrentPage, setRoundsCurrentPage] = useState(1);
  const [isFinishRoundModalVisible, setIsFinishRoundModalVisible] = useState(false);
  const [finishRoundModalTitle, setFinishRoundModalTitle] = useState("");
  const [endedRoundData, setEndedRoundData] = useState();
  const [activeGameFromContract, setActiveGameFromContract] = useState();
  const [commitDisabled, setCommitDisabled] = useState(false);
  const [revealDisabled, setRevealDisabled] = useState(false);
  const [joinDisabled, setJoinDisabled] = useState(false);
  const [startDisabled, setStartDisabled] = useState(false);
  const [currentUIState, setCurrentUIState] = useState(UIState.NoGame);

  let revealTimeLeft = 180;
  let commitTimeLeft = 180;
  let playerHasCommitted = false;
  let playerHasRevealed = false;

  useEffect(() => {
    const updateActiveGameFromContract = async () => {
      if (readContracts.Morra) {
        const activeGamefromContractValue = await readContracts.Morra.activeGame(address);
        if (DEBUG) console.log("activeGamefromContractValue: ", activeGamefromContractValue);
        setActiveGameFromContract(activeGamefromContractValue);
      }
    };
    updateActiveGameFromContract();
  }, [DEBUG, readContracts.Morra, address]);

  const showFinishRoundModal = () => {
    setIsFinishRoundModalVisible(true);
  };

  const handleFinishRoundModalOk = () => {
    setIsFinishRoundModalVisible(false);
  };

/*
  const GAME_GRAPHQL = `
    query($gameHash: String) {
      game(id: $gameHash) {
        id
        creator
        status
        started
      }
    }
  `;

  const GAME_GQL = gql(GAME_GRAPHQL);
  const gameResult = useQuery(GAME_GQL, { variables: { gameHash: activeGame.toLowerCase() }, pollInterval: 500 });

  if (DEBUG) console.log("gameResult: ", gameResult.data);
*/

  const ROUNDS_GRAPHQL = `
    query($gameHash: String) {
      game(id: $gameHash) {
        id
        creator
        status
        started
        gameRounds {
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
    }
  `;

  const ROUNDS_GQL = gql(ROUNDS_GRAPHQL);
  const roundsResult = useQuery(ROUNDS_GQL, { variables: { gameHash: activeGame.toLowerCase() }, pollInterval: 500 });

  if (DEBUG) console.log("roundsResult: ", roundsResult.data);

  const PLAYERS_GRAPHQL = `
    query($gameHash: String) {
      gamePlayers(where: {game: $gameHash}) {
        id
        address
      }
    }
  `;

  const PLAYERS_GQL = gql(PLAYERS_GRAPHQL);
  const playersResult = useQuery(PLAYERS_GQL, {
    variables: { gameHash: activeGame.toLowerCase() },
    pollInterval: 500,
  });

  if (DEBUG) console.log("playersResult: ", playersResult.data);

  const activeGameData = useContractReader(readContracts, "Morra", "games", [activeGame], 500);
  if (DEBUG) console.log("activeGameData: ", activeGameData);

  useEffect(() => {
    const updateCurrentUIState = async () => {
      if (DEBUG) console.log("Updating current UI state...");
      if (roundsResult && roundsResult.data && roundsResult.data.game) {
        if (roundsResult.data.game) {
          setCurrentUIState(roundsResult.data.game.status);
        }
      }
    };
    updateCurrentUIState();
  }, [DEBUG, roundsResult && roundsResult.data]);

  useEffect(() => {
    const updateRoundsData = async () => {
      if (DEBUG) console.log("Updating rounds data...", roundsResult.data, playersResult.data);
      if (playersResult.data && playersResult.data.gamePlayers.length > 0) {
        if (DEBUG) console.log("Updating rounds data2...");
        const roundsData = [];
        let pointsByPlayer = {};

        playersResult.data.gamePlayers.forEach(function (player) {
          pointsByPlayer[player.address] = 0;
        });

        if (roundsResult.data && roundsResult.data.game && roundsResult.data.game.gameRounds.length > 0) {
          roundsResult.data.game.gameRounds.forEach(function (round) {
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
                    let points =
                      playersResult.data.gamePlayers.length * 5 - Math.abs(playerFromRound.total - round.total);
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

          if (DEBUG) console.log("roundsData: ", roundsData);
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

  useEffect(() => {
    const updatePlayerData = async () => {
      if (DEBUG) console.log("Updating player data...");
      if (activeGameData) {
        const currentRoundData = gameRoundsData.find(roundData => roundData.round === activeGameData.round);
        if (DEBUG) console.log("currentRoundData: ", currentRoundData);
        if (currentRoundData) {
          const currentRoundDataForPlayer = currentRoundData.players.find(
            playerData => playerData.address === address.toLowerCase(),
          );
          if (DEBUG) console.log("currentRoundDataForPlayer: ", currentRoundDataForPlayer);
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
    const updatePlayerJoined = async () => {
      if (DEBUG) console.log("Updating player joined...");
      if (playersResult.data && playersResult.data.gamePlayers.length > 0 && address) {
        const joined = playersResult.data.gamePlayers.some(player => player.address === address.toLowerCase());
        setPlayerJoined(joined);
      }
    };
    updatePlayerJoined();
  }, [DEBUG, address, playersResult.data]);

  useEffect(() => {
    const updatePointsToWin = async () => {
      if (DEBUG) console.log("Updating points to win..");
      if (players && players.length > 0) {
        setPointsToWin(players.length * 5 * 3);
      }
    };
    updatePointsToWin();
  }, [DEBUG, players]);

  useEffect(() => {
    const updateRoundsCurrentPage = async () => {
      if (DEBUG) console.log("Updating rounds pagination..");
      if (
        (currentUIState === UIState.ResultPhase || currentUIState === UIState.CommitPhase) &&
        gameRoundsData.length > 0
      ) {
        const currentRound = gameRoundsData[gameRoundsData.length - 1].round;
        if (DEBUG) console.log("Updating rounds pagination: ", currentRound);
        setRoundsCurrentPage(currentRound);
        if (currentRound > 1) {
          let endedRound;
          if (currentUIState === UIState.ResultPhase) {
            endedRound = currentRound;
          } else {
            endedRound = currentRound - 1;
          }
          setFinishRoundModalTitle("Round " + endedRound + " Ended");
          const roundData = gameRoundsData.find(item => item.round === endedRound);
          setEndedRoundData(roundData);
          showFinishRoundModal();
        }
      }
    };
    updateRoundsCurrentPage();
  }, [DEBUG, currentUIState]);

  function getRandomString(bytes) {
    const randomValues = new Uint8Array(bytes);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues).map(intToHex).join("");
  }

  function intToHex(nr) {
    return nr.toString(16).padStart(2, "0");
  }

  /*
  if (activeGameData) {
    const { initialized, gameState } = activeGameData;
    if (initialized) {
      currentUIState = gameState;
    }
  }
  */
  if (playerData) {
    playerHasCommitted = playerData.commited;
    playerHasRevealed = playerData.revealed;
  } else {
    playerHasCommitted = true;
    playerHasRevealed = true;
  }
  let gameStateMessage = "";
  if (activeGameData) {
    if (currentUIState === UIState.JoinPhase) gameStateMessage = "Waiting for players to join";
    if (currentUIState === UIState.CommitPhase) {
      gameStateMessage = playerHasCommitted ? "Waiting for other player to play" : "Waiting for you to play";
      const timestamp = Math.round(Date.now() / 1000); //TODO Change to use block timestamp
      commitTimeLeft = activeGameData.commitDeadline > timestamp ? activeGameData.commitDeadline - timestamp : 0;
      if (DEBUG) console.log("commitTimeLeft", commitTimeLeft, typeof commitTimeLeft);
    }
    if (currentUIState === UIState.RevealPhase) {
      gameStateMessage = playerHasRevealed ? "Waiting for other player to reveal" : "Waiting for you to reveal";
      const timestamp = Math.round(Date.now() / 1000); //TODO Change to use block timestamp
      revealTimeLeft = activeGameData.revealDeadline > timestamp ? activeGameData.revealDeadline - timestamp : 0;
      if (DEBUG) console.log("revealTimeLeft", revealTimeLeft, typeof revealTimeLeft);
    }
  }
  let winners;
  let winner = false;
  if (currentUIState === UIState.ResultPhase) {
    if (DEBUG) console.log("players: ", players);
    const maxPoints = Math.max(
      ...players.map(function (player) {
        return player.points;
      }),
    );
    if (DEBUG) console.log("maxPoints: ", maxPoints);
    const playersWithMaxPoints = players.filter(function (player) {
      return player.points === maxPoints;
    });
    winners =
      playersWithMaxPoints &&
      playersWithMaxPoints.map(function (player) {
        return player.address;
      });

    if (DEBUG) console.log("winners: ", winners);

    if (address && winners.includes(address.toLowerCase())) {
      winner = true;
      gameStateMessage = <Image preview={false} src="/images/win.png" alt="You Win!" title="You Win!" />;
    } else {
      gameStateMessage = <Image preview={false} src="/images/lost.png" alt="You Lost!" title="You Lost!" />;
    }
  }

  const txnUpdate = update => {
    if (DEBUG) console.log("📡 Transaction Update:", update);
    if (update && (update.status === "confirmed" || update.status === 1)) {
      if (DEBUG) console.log(" 🍾 Transaction " + update.hash + " finished!");
      if (DEBUG)
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
    if (DEBUG) console.log("awaiting metamask/web3 confirm result...", result);
    if (DEBUG) console.log(await result);
  };

  const joinGame = async () => {
    setJoinDisabled(true);
    const entryFee = await readContracts.Morra.entryFee();
    try {
      const txCur = await tx(writeContracts.Morra.joinGame(activeGame, { value: entryFee }));
      await txCur.wait();
    } catch (e) {
      console.log("Failed to join game", e);
    }
    setJoinDisabled(false);
  };
  const startGame = async () => {
    setStartDisabled(true);
    const result = tx(writeContracts.Morra.startGame(activeGame), txnUpdate);
    await logTxn(result);
    setStartDisabled(false);
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

    setCommitDisabled(true);
    const result = tx(writeContracts.Morra.commit(hash, { gasLimit: 300000 }), txnUpdate);
    await logTxn(result);
    setCommitDisabled(false);
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

    setRevealDisabled(true);
    const result = tx(writeContracts.Morra.reveal(commitChoice, total, commitSalt, { gasLimit: 300000 }), txnUpdate);
    await logTxn(result);
    setRevealDisabled(false);
  };
  const finishRound = async () => {
    const result = tx(writeContracts.Morra.determineWinnersAfterRevealTimeout(activeGame, { gasLimit: 300000 }), txnUpdate);
    await logTxn(result);
  };
  const finishCommit = async () => {
    const result = tx(writeContracts.Morra.finishCommitPhaseAfterCommitTimeout(activeGame, { gasLimit: 300000 }), txnUpdate);
    await logTxn(result);
  };
  const leaveGame = async () => {
    // const result = tx(writeContracts.Morra.leaveGame(), txnUpdate);
    // await logTxn(result);
    history.push("/");
  };
  const claimPrize = async () => {
    const result = tx(writeContracts.Morra.claimPrize(activeGame, { gasLimit: 300000 }), txnUpdate);
    await logTxn(result);
  };

  const handleChangeTotal = value => {
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
    if (typeof commitChoice !== "undefined") {
      localStorage.setItem("commitChoice", JSON.stringify(commitChoice));
    }
  }, [commitChoice]);

  useEffect(() => {
    if (typeof total !== "undefined") {
      localStorage.setItem("total", JSON.stringify(total));
    }
  }, [total]);

  useEffect(() => {
    if (typeof commitSalt !== "undefined" && commitSalt !== "") {
      localStorage.setItem("commitSalt", JSON.stringify(commitSalt));
    }
  }, [commitSalt]);

  useEffect(() => {
    const commitChoiceText = localStorage.getItem("commitChoice");
    if (commitChoiceText !== "undefined") {
      const commitChoiceFromStorage = JSON.parse(commitChoiceText);
      if (commitChoiceFromStorage) {
        setCommitChoice(commitChoiceFromStorage);
      }
    }
    const totalFromStorageText = localStorage.getItem("total");
    if (totalFromStorageText !== "undefined") {
      const totalFromStorage = JSON.parse(totalFromStorageText);
      if (totalFromStorage) {
        setTotal(totalFromStorage);
      }
    }
    const commitSaltText = localStorage.getItem("commitSalt");
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
          <ul>
            <li></li>
            <li></li>
          </ul>
          <ul>
            <li></li>
            <li></li>
          </ul>
        </div>
        <div class="content">
          {players && <Table dataSource={players} columns={playersColumns} pagination={false} />}
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
                <GameAddress address={activeGame} ensProvider={mainnetProvider} fontSize={18} />
              )}
            </div>
            {currentUIState === UIState.NoGame && (
              <>
                <h2>Game not found!</h2>
              </>
            )}
            {currentUIState === UIState.JoinPhase && (
              <>
                <h1>{gameStateMessage}</h1>

                {playerJoined && <h3>Send them the game address above so they can join</h3>}
                {!playerJoined && activeGameFromContract === "0x0000000000000000000000000000000000000000" && (
                  <>
                    <Button style={{ marginTop: 8 }} onClick={joinGame} disabled={joinDisabled}>
                      Join (1 MATIC)
                    </Button>
                    {joinDisabled && <Spin />}
                  </>
                )}
                {!playerJoined && activeGameFromContract !== "0x0000000000000000000000000000000000000000" && (
                  <Popconfirm
                    title="Are you sure to join this game? If you didn't finish your current game session you will lose your entry fee."
                    onConfirm={joinGame}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button style={{ marginTop: 8 }} disabled={joinDisabled}>
                      Join (1 MATIC)
                    </Button>
                    {joinDisabled && <Spin />}
                  </Popconfirm>
                )}
                {activeGameData && activeGameData.creator === address && (
                  <div style={{ margin: 8 }}>
                    <Button
                      type="primary"
                      style={{ marginTop: 8, marginBottom: 20, width: 250, height: 50, fontSize: 24 }}
                      onClick={startGame}
                       disabled={startDisabled}
                    >
                      Start
                    </Button>
                    {startDisabled && <Spin />}
                  </div>
                )}
              </>
            )}
            {currentUIState === UIState.CommitPhase && (
              <>
                <div className="game-data">
                  <h2>Your Points: {activeGameData && activeGameData.points && activeGameData.points.toString()}</h2>
                  <h2>Round {activeGameData && activeGameData.round.toString()}</h2>
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
                          <Button className="play-button" onClick={commit} disabled={commitDisabled}>
                            Play
                          </Button>
                          {commitDisabled && <Spin />}
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
                  <h2>Round {activeGameData && activeGameData.round.toString()}</h2>
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
                        >
                          <Image preview={false} src={"/images/hands/5.png"} alt="5" title="5" />
                          <div style={{ position: "absolute", top: 85, right: 5, fontSize: 20 }}>5</div>
                        </Radio.Button>
                      </Radio.Group>
                      <div style={{ display: "flex", marginTop: 30, justifyContent: "center" }}>
                        <div style={{ margin: 0, width: 150 }}>
                          <label style={{ fontSize: 20 }}>Your guess</label>
                          <InputNumber value={total} min="0" max="200" step="1" placeholder="Total" disabled={true} />
                        </div>
                        <div style={{ margin: 0, width: 150 }}>
                          <Button className="play-button" onClick={reveal} disabled={revealDisabled}>
                            Reveal
                          </Button>
                          {revealDisabled && <Spin />}
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
                  <h2>
                    Your Points:
                    <strong>
                      {address && players.find(player => player.address === address.toLowerCase())?.points}
                    </strong>
                  </h2>
                  <h1 style={{ marginBottom: 0 }}>{gameStateMessage}</h1>
                  {winner && (
                    <Button className="claim-prize-button" style={{ marginTop: 8 }} onClick={claimPrize}>
                      Claim Prize 💰
                    </Button>
                  )}
                </div>
                <div style={{ margin: 20 }}>
                  <h3>Winners</h3>
                  <Row>
                    {winners &&
                      winners.map(function (player, i) {
                        return (
                          <Col
                            span={12}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Address address={player} ensProvider={mainnetProvider} fontSize={14} />
                          </Col>
                        );
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
          <ul>
            <li></li>
            <li></li>
          </ul>
          <ul>
            <li></li>
            <li></li>
          </ul>
        </div>
        <div class="content">
          <List
            itemLayout="vertical"
            size="large"
            pagination={{
              onChange: page => {
                setRoundsCurrentPage(page);
              },
              current: roundsCurrentPage,
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
                      <Card
                        title={
                          <Row
                            span={12}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Address noCopy={true} value={player.address} ensProvider={mainnetProvider} fontSize={12} />
                          </Row>
                        }
                      >
                        {item.finished && player.revealed && (
                          <div class="finished">
                            <Image
                              preview={false}
                              style={{ height: 30, marginTop: 7 }}
                              src={"/images/hands/" + player.number + ".png"}
                              alt={player.number}
                              title={player.number}
                            />
                            <span style={{ marginLeft: 5 }}>
                              Total: {player.total} (<strong>{player.points}</strong>)
                            </span>
                          </div>
                        )}
                        {item.finished && !player.revealed && <span class="noplayed">No played!</span>}
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
      <Modal
        visible={isFinishRoundModalVisible}
        onOk={handleFinishRoundModalOk}
        onCancel={handleFinishRoundModalOk}
        footer={null}
        closable={false}
        className="modal-rounds"
      >
        <div class="rounds">
          <div class="rounds-corners">
            <ul>
              <li></li>
              <li></li>
            </ul>
            <ul>
              <li></li>
              <li></li>
            </ul>
          </div>
          <div class="content">
            <h3>{finishRoundModalTitle}</h3>
            <h4>Total {endedRoundData && endedRoundData.total}</h4>
            <List
              grid={{ column: 2 }}
              className="round-data"
              dataSource={endedRoundData && endedRoundData.players}
              renderItem={player => (
                <List.Item>
                  <Card
                    title={
                      <Row
                        span={12}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Address noCopy={true} value={player.address} ensProvider={mainnetProvider} fontSize={12} />
                      </Row>
                    }
                  >
                    {player.revealed && (
                      <div class="finished">
                        <Image
                          preview={false}
                          style={{ height: 30, marginTop: 7 }}
                          src={"/images/hands/" + player.number + ".png"}
                          alt={player.number}
                          title={player.number}
                        />
                        <span style={{ marginLeft: 5 }}>
                          Total: {player.total} (<strong>{player.points}</strong>)
                        </span>
                      </div>
                    )}
                    {!player.revealed && <span class="noplayed">No played!</span>}
                  </Card>
                </List.Item>
              )}
            />
            <Button className="continue-button" onClick={handleFinishRoundModalOk}>
              Continue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
